import { PrismaClient } from "../generated/prisma";
import {
  RecommendationResult,
  SimilarityScore,
  ProductSimilarity,
  WeightedRecommendation,
  ProductWithRecommendationDetails,
  hasValidCategory,
} from "../types/recommendations";

const prisma = new PrismaClient();

// ===========================================
//                CONSTANTS
// ===========================================
const DEFAULT_RECOMMENDATION_LIMIT = 10;
const SIMILAR_PRODUCTS_LIMIT = 6;
const TRENDING_CACHE_MINUTES = 30;
const MIN_REVIEWS_FOR_TRENDING = 3;
const SIMILARITY_THRESHOLD = 0.3;
const PRICE_VARIANCE_FACTOR = 0.3; // ±30% price range

// Pesi per algoritmo hybrid
const COLLABORATIVE_WEIGHT = 0.4;
const CONTENT_BASED_WEIGHT = 0.4;
const TRENDING_WEIGHT = 0.2;

// ===========================================
//              INTERNAL TYPES
// ===========================================

// Definizioni per dati interni al service
interface UserHistoryInternal {
  purchases: {
    productId: string;
    categoryId: string;
  }[];
  wishlist: string[];
  reviews: { productId: string; rating: number }[];
  categories: string[];
}

// ===========================================
//            RECOMMENDATION SERVICE
// ===========================================
class RecommendationService {
  // ===========================================
  //              MAIN METHODS
  // ===========================================

  // Raccomandazioni personalizzate per utente autenticato
  // Hybrid approach: Collaborative + Content-based + Popularity
  async getUserRecommendations(
    userId: string,
    limit: number = DEFAULT_RECOMMENDATION_LIMIT,
    excludeOwned: boolean = true
  ): Promise<RecommendationResult[]> {
    try {
      // Ottieni cronologia utente
      const userHistory = await this.getUserHistory(userId);

      // Se utente nuovo, usa popularity-based
      if (
        userHistory.purchases.length === 0 &&
        userHistory.wishlist.length === 0
      ) {
        return await this.getTrendingProducts(undefined, limit, "new_user");
      }

      // Collaborative Filtering (40% peso)
      const collaborativeRecs = await this.getCollaborativeRecommendations(
        userId,
        userHistory
      );

      // Content-Based Filtering (40% peso)
      const contentRecs = await this.getContentBasedRecommendations(
        userHistory
      );

      // Trending Products (20% peso)
      const trendingRecs = await this.getTrendingProducts(
        undefined,
        Math.ceil(limit * 0.3)
      );

      // Combina e pesa i risultati
      const hybridResults = this.combineRecommendations([
        { recs: collaborativeRecs, weight: COLLABORATIVE_WEIGHT },
        { recs: contentRecs, weight: CONTENT_BASED_WEIGHT },
        { recs: trendingRecs, weight: TRENDING_WEIGHT },
      ]);

      // Filtra prodotti già posseduti (se richiesto)
      let filteredResults = hybridResults;
      if (excludeOwned) {
        const ownedProductIds = userHistory.purchases.map((p) => p.productId);
        filteredResults = hybridResults.filter(
          (rec) => !ownedProductIds.includes(rec.product.id)
        );
      }

      // Rimuovi duplicati e limita risultati
      const uniqueResults = this.removeDuplicates(filteredResults);

      return uniqueResults.slice(0, limit);
    } catch (error) {
      console.error("Error in getUserRecommendations:", error);
      // Fallback to trending products
      return await this.getTrendingProducts(undefined, limit, "fallback");
    }
  }

  // Prodotti simili per pagina prodotto
  // Content-based filtering ottimizzato
  async getSimilarProducts(
    productId: string,
    limit: number = SIMILAR_PRODUCTS_LIMIT
  ): Promise<RecommendationResult[]> {
    try {
      // Ottieni prodotto target
      const targetProduct = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: true,
          images: true,
          reviews: {
            select: { rating: true },
          },
          _count: {
            select: { reviews: true, orderItems: true, wishlists: true },
          },
        },
      });

      if (!targetProduct || !targetProduct.category) {
        throw new Error("Product not found or has no category");
      }

      // Trova prodotti simili
      const similarProducts = await prisma.product.findMany({
        where: {
          AND: [
            { id: { not: productId } }, // Esclude prodotto corrente
            { isActive: true },
            { stock: { gt: 0 } },
            { categoryId: { not: null } }, // Solo prodotti con categoria
            {
              OR: [
                { categoryId: targetProduct.categoryId }, // Stessa categoria
                {
                  price: {
                    gte:
                      Number(targetProduct.price) * (1 - PRICE_VARIANCE_FACTOR),
                    lte:
                      Number(targetProduct.price) * (1 + PRICE_VARIANCE_FACTOR),
                  },
                },
              ],
            },
          ],
        },
        include: {
          category: true,
          images: true,
          reviews: {
            select: { rating: true },
          },
          _count: {
            select: {
              reviews: true,
              orderItems: true,
              wishlists: true,
            },
          },
        },
        take: limit * 2, // Prendiamo più prodotti per calcolare similarity
      });

      // Filtra solo prodotti con categoria valida
      const validProducts = similarProducts.filter(hasValidCategory);

      // Calcola similarity scores
      const recommendations: RecommendationResult[] = [];

      for (const product of validProducts) {
        const similarity = this.calculateProductSimilarity(
          targetProduct,
          product
        );

        if (similarity.score > SIMILARITY_THRESHOLD) {
          const avgRating =
            product.reviews.length > 0
              ? product.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
                product.reviews.length
              : 0;

          recommendations.push({
            product: {
              ...product,
              avgRating,
            },
            score: similarity.score,
            reason: similarity.reasons.join(", "),
          });
        }
      }

      // Ordina per score e limita risultati
      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error("Error in getSimilarProducts:", error);
      return [];
    }
  }

  // Prodotti trending/popolari
  // Basato su vendite, recensioni, wishlist
  async getTrendingProducts(
    categoryId?: string,
    limit: number = DEFAULT_RECOMMENDATION_LIMIT,
    reason: string = "trending"
  ): Promise<RecommendationResult[]> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const products = await prisma.product.findMany({
        where: {
          AND: [
            { isActive: true },
            { stock: { gt: 0 } },
            { categoryId: { not: null } }, // Solo prodotti con categoria
            categoryId ? { categoryId } : {},
          ],
        },
        include: {
          category: true,
          images: true,
          reviews: {
            select: { rating: true, createdAt: true },
          },
          orderItems: {
            where: {
              order: {
                createdAt: { gte: thirtyDaysAgo },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
              orderItems: true,
              wishlists: true,
            },
          },
        },
        take: limit * 2,
      });

      // Filtra prodotti con categoria valida e abbastanza recensioni
      const filteredProducts = products.filter(
        (product) =>
          hasValidCategory(product) &&
          product._count.reviews >= MIN_REVIEWS_FOR_TRENDING
      );

      // Calcola trending score per ogni prodotto
      const recommendations: RecommendationResult[] = [];

      for (const product of filteredProducts) {
        // Dato che filteredProducts usa hasValidCategory, sappiamo che category non è null
        const productWithCategory = product as typeof product & {
          category: NonNullable<typeof product.category>;
        };
        const trendingScore = this.calculateTrendingScore(productWithCategory);

        const avgRating =
          product.reviews.length > 0
            ? product.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
              product.reviews.length
            : 0;

        recommendations.push({
          product: {
            ...product,
            avgRating,
          },
          score: trendingScore,
          reason:
            reason === "new_user"
              ? "Popular choice for new users"
              : reason === "fallback"
              ? "Recommended product"
              : "Trending now",
        });
      }

      // Ordina per score e limita risultati
      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error("Error in getTrendingProducts:", error);
      return [];
    }
  }

  // "Frequently bought together"
  // Trova prodotti spesso acquistati insieme
  async getFrequentlyBoughtTogether(
    productId: string,
    limit: number = 4
  ): Promise<RecommendationResult[]> {
    try {
      // Trova ordini che contengono il prodotto target
      const ordersWithProduct = await prisma.order.findMany({
        where: {
          orderItems: {
            some: { productId },
          },
        },
        include: {
          orderItems: {
            include: {
              product: {
                include: {
                  category: true,
                  images: true,
                  reviews: { select: { rating: true } },
                  _count: {
                    select: {
                      reviews: true,
                      orderItems: true,
                      wishlists: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Conta frequenza di co-acquisto
      const coOccurrenceMap = new Map<string, number>();

      for (const order of ordersWithProduct) {
        const otherProducts = order.orderItems.filter(
          (item) => item.productId !== null && item.productId !== productId
        );

        for (const item of otherProducts) {
          if (item.productId) {
            const count = coOccurrenceMap.get(item.productId) || 0;
            coOccurrenceMap.set(item.productId, count + 1);
          }
        }
      }

      // Converti in recommendations con score basato su frequenza
      const recommendations: RecommendationResult[] = [];
      const totalOrders = ordersWithProduct.length;

      for (const [relatedProductId, frequency] of coOccurrenceMap.entries()) {
        if (frequency < 2) continue; // Minimo 2 co-acquisti

        const orderItem = ordersWithProduct
          .flatMap((o) => o.orderItems)
          .find((item) => item.productId === relatedProductId);

        if (orderItem?.product && hasValidCategory(orderItem.product)) {
          const avgRating =
            orderItem.product.reviews.length > 0
              ? orderItem.product.reviews.reduce(
                  (sum: number, r) => sum + r.rating,
                  0
                ) / orderItem.product.reviews.length
              : 0;

          const score = frequency / totalOrders; // Percentuale di co-acquisto

          recommendations.push({
            product: {
              ...orderItem.product,
              avgRating,
            },
            score,
            reason: `Bought together ${frequency} times (${Math.round(
              score * 100
            )}%)`,
          });
        }
      }

      // Ordina per frequenza e limita risultati
      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error("Error in getFrequentlyBoughtTogether:", error);
      return [];
    }
  }

  // ===========================================
  //            HELPER METHODS
  // ===========================================

  // Ottieni cronologia completa utente
  private async getUserHistory(userId: string): Promise<UserHistoryInternal> {
    const [orderItems, wishlist, reviews] = await Promise.all([
      // Cronologia acquisti
      prisma.orderItem.findMany({
        where: {
          order: {
            userId,
            status: { in: ["COMPLETED"] },
          },
          productId: { not: null },
        },
        include: {
          product: {
            select: { categoryId: true },
          },
        },
      }),

      // Wishlist
      prisma.wishlist.findMany({
        where: { userId },
        select: { productId: true },
      }),

      // Recensioni
      prisma.review.findMany({
        where: { userId },
        select: { productId: true, rating: true },
      }),
    ]);

    // Trasforma i dati in formato semplificato
    const purchases = orderItems
      .filter((item) => item.product && item.product.categoryId)
      .map((item) => ({
        productId: item.productId as string,
        categoryId: item.product!.categoryId as string,
      }));

    // Estrai categorie preferite
    const categoryIds = purchases.map((p) => p.categoryId);
    const categoryFrequency = categoryIds.reduce(
      (acc: Record<string, number>, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      },
      {}
    );

    const preferredCategories = Object.entries(categoryFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([categoryId]) => categoryId);

    return {
      purchases,
      wishlist: wishlist.map((w) => w.productId),
      reviews,
      categories: preferredCategories,
    };
  }

  // Collaborative Filtering - trova utenti simili
  private async getCollaborativeRecommendations(
    userId: string,
    userHistory: UserHistoryInternal
  ): Promise<RecommendationResult[]> {
    // Trova utenti con acquisti simili
    const userProductIds = userHistory.purchases.map((p) => p.productId);

    if (userProductIds.length === 0) {
      return [];
    }

    // Utenti che hanno comprato almeno 1 prodotto in comune
    const similarUsers = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            orders: {
              some: {
                orderItems: {
                  some: {
                    productId: { in: userProductIds },
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        orders: {
          include: {
            orderItems: {
              select: { productId: true },
            },
          },
        },
      },
      take: 20, // Limita per performance
    });

    // Calcola similarity scores
    const similarityScores: SimilarityScore[] = [];

    for (const user of similarUsers) {
      const userProducts = user.orders.flatMap((o) =>
        o.orderItems
          .filter((item) => item.productId !== null)
          .map((item) => item.productId as string)
      );
      const commonProducts = userProductIds.filter((pid) =>
        userProducts.includes(pid)
      );

      if (commonProducts.length >= 2) {
        // Minimo 2 prodotti in comune
        const similarity =
          commonProducts.length /
          Math.sqrt(userProductIds.length * userProducts.length);

        similarityScores.push({
          userId: user.id,
          score: similarity,
          commonPurchases: commonProducts.length,
        });
      }
    }

    // Prendi top similar users
    const topSimilarUsers = similarityScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (topSimilarUsers.length === 0) {
      return [];
    }

    // Trova prodotti raccomandati da utenti simili
    const recommendedProducts = await prisma.product.findMany({
      where: {
        AND: [
          { isActive: true },
          { stock: { gt: 0 } },
          { categoryId: { not: null } }, // Solo prodotti con categoria
          { id: { notIn: userProductIds } }, // Escludi già posseduti
          {
            orderItems: {
              some: {
                order: {
                  userId: { in: topSimilarUsers.map((u) => u.userId) },
                },
              },
            },
          },
        ],
      },
      include: {
        category: true,
        images: true,
        reviews: { select: { rating: true } },
        _count: {
          select: { reviews: true, orderItems: true, wishlists: true },
        },
        orderItems: {
          where: {
            order: {
              userId: { in: topSimilarUsers.map((u) => u.userId) },
            },
          },
          include: {
            order: {
              select: { userId: true },
            },
          },
        },
      },
    });

    // Filtra solo prodotti con categoria valida
    const validProducts = recommendedProducts.filter(hasValidCategory);

    // Calcola score per ogni prodotto raccomandato
    const recommendations: RecommendationResult[] = [];

    for (const product of validProducts) {
      let weightedScore = 0;

      // Peso basato su similarity degli utenti che l'hanno comprato
      for (const orderItem of product.orderItems) {
        const userSimilarity = topSimilarUsers.find(
          (u) => u.userId === orderItem.order?.userId
        );
        if (userSimilarity) {
          weightedScore += userSimilarity.score;
        }
      }

      const avgRating =
        product.reviews.length > 0
          ? product.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
            product.reviews.length
          : 0;

      recommendations.push({
        product: {
          ...product,
          avgRating,
        },
        score: weightedScore,
        reason: "Users with similar taste also bought this",
      });
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  // Content-Based Filtering
  private async getContentBasedRecommendations(
    userHistory: UserHistoryInternal
  ): Promise<RecommendationResult[]> {
    if (userHistory.categories.length === 0) {
      return [];
    }

    // Trova prodotti nelle categorie preferite
    const products = await prisma.product.findMany({
      where: {
        AND: [
          { isActive: true },
          { stock: { gt: 0 } },
          { categoryId: { in: userHistory.categories } },
          { id: { notIn: userHistory.purchases.map((p) => p.productId) } },
        ],
      },
      include: {
        category: true,
        images: true,
        reviews: { select: { rating: true } },
        _count: {
          select: { reviews: true, orderItems: true, wishlists: true },
        },
      },
      take: 20,
    });

    // Filtra solo prodotti con categoria valida
    const validProducts = products.filter(hasValidCategory);

    // Calcola score basato su preferenze utente
    const recommendations: RecommendationResult[] = [];

    for (const product of validProducts) {
      const categoryPreference =
        userHistory.categories.indexOf(product.categoryId!) + 1;
      const categoryScore =
        (userHistory.categories.length - categoryPreference + 1) /
        userHistory.categories.length;

      const avgRating =
        product.reviews.length > 0
          ? product.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
            product.reviews.length
          : 0;

      // Score finale: categoria preferenza + rating + popolarità
      const finalScore =
        categoryScore * 0.6 +
        (avgRating / 5) * 0.3 +
        (Math.min(product._count.orderItems, 100) / 100) * 0.1;

      recommendations.push({
        product: {
          ...product,
          avgRating,
        },
        score: finalScore,
        reason: `Matches your interest in ${product.category!.name}`,
      });
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  // Calcola similarity tra due prodotti
  private calculateProductSimilarity(
    product1: ProductWithRecommendationDetails,
    product2: ProductWithRecommendationDetails
  ): ProductSimilarity {
    // Type guard per assicurarsi che entrambi i prodotti abbiano una categoria
    if (!product1.category || !product2.category) {
      return {
        productId: product2.id,
        score: 0,
        reasons: ["Missing category information"],
      };
    }

    let score = 0;
    const reasons: string[] = [];

    // Stessa categoria (+0.5)
    if (product1.categoryId === product2.categoryId) {
      score += 0.5;
      reasons.push("Same category");
    }

    // Range prezzo simile (+0.3)
    const price1 = Number(product1.price);
    const price2 = Number(product2.price);
    const priceDiff = Math.abs(price1 - price2) / Math.max(price1, price2);
    if (priceDiff <= PRICE_VARIANCE_FACTOR) {
      const priceScore = (1 - priceDiff) * 0.3;
      score += priceScore;
      reasons.push("Similar price range");
    }

    // Rating simile (+0.2)
    const product1Rating =
      product1.reviews.length > 0
        ? product1.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
          product1.reviews.length
        : 0;
    const product2Rating =
      product2.reviews.length > 0
        ? product2.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
          product2.reviews.length
        : 0;

    if (product1Rating > 0 && product2Rating > 0) {
      const ratingDiff = Math.abs(product1Rating - product2Rating) / 5;
      if (ratingDiff <= 0.5) {
        score += (1 - ratingDiff) * 0.2;
        reasons.push("Similar rating");
      }
    }

    return {
      productId: product2.id,
      score,
      reasons,
    };
  }

  // Calcola trending score
  private calculateTrendingScore(
    product: ProductWithRecommendationDetails & {
      category: NonNullable<ProductWithRecommendationDetails["category"]>;
    }
  ): number {
    // Vendite recenti (peso 50%)
    const recentSales = product._count.orderItems;
    const salesScore = (Math.min(recentSales, 20) / 20) * 0.5;

    // Rating medio (peso 30%)
    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((sum: number, r) => sum + r.rating, 0) /
          product.reviews.length
        : 0;
    const ratingScore = (avgRating / 5) * 0.3;

    // Numero recensioni (peso 10%)
    const reviewsScore = (Math.min(product._count.reviews, 50) / 50) * 0.1;

    // Wishlist (peso 10%)
    const wishlistScore = (Math.min(product._count.wishlists, 20) / 20) * 0.1;

    return salesScore + ratingScore + reviewsScore + wishlistScore;
  }

  // Combina recommendations da diversi algoritmi
  private combineRecommendations(
    weightedRecs: WeightedRecommendation[]
  ): RecommendationResult[] {
    const productScores = new Map<
      string,
      { rec: RecommendationResult; totalScore: number }
    >();

    // Combina scores con pesi
    for (const { recs, weight } of weightedRecs) {
      for (const rec of recs) {
        const existing = productScores.get(rec.product.id);
        const weightedScore = rec.score * weight;

        if (existing) {
          existing.totalScore += weightedScore;
        } else {
          productScores.set(rec.product.id, {
            rec: { ...rec, score: weightedScore },
            totalScore: weightedScore,
          });
        }
      }
    }

    // Converti in array e ordina
    return Array.from(productScores.values())
      .map(({ rec, totalScore }) => ({ ...rec, score: totalScore }))
      .sort((a, b) => b.score - a.score);
  }

  // Rimuovi duplicati mantenendo score più alto
  private removeDuplicates(
    recommendations: RecommendationResult[]
  ): RecommendationResult[] {
    const seen = new Set<string>();
    const unique: RecommendationResult[] = [];

    for (const rec of recommendations) {
      if (!seen.has(rec.product.id)) {
        seen.add(rec.product.id);
        unique.push(rec);
      }
    }

    return unique;
  }
}

export default new RecommendationService();
