import { PrismaClient } from "../generated/prisma";
import {
  SearchFilters,
  SearchResult,
  SearchResponse,
  SearchFacets,
  SearchSuggestion,
  SearchAnalytics,
  SearchError,
  SearchSortField,
} from "../types/search";

const prisma = new PrismaClient();

export class SearchService {
  // RICERCA PRODOTTI CON FILTRI AVANZATI

  static async searchProducts(filters: SearchFilters): Promise<SearchResponse> {
    const startTime = Date.now();

    const {
      query,
      page = 1,
      limit = 20,
      sortBy = "relevance",
      sortOrder = "desc",
      ...otherFilters
    } = filters;

    const skip = (page - 1) * limit;

    // COSTRUISCI WHERE CLAUSE
    const whereClause = this.buildWhereClause(filters);

    // COSTRUISCI ORDER BY
    const orderBy = this.buildOrderBy(sortBy, sortOrder, query);

    // ESEGUI QUERY PARALLELE PER PERFORMANCE
    const [products, totalCount, facets] = await Promise.all([
      // PRODOTTI CON RELAZIONI
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            where: { isMain: true },
            take: 1,
            select: {
              id: true,
              url: true,
              altText: true,
              isMain: true,
            },
          },
          tags: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),

      // COUNT TOTALE
      prisma.product.count({ where: whereClause }),

      // FACETS PER FILTRI
      this.buildFacets(whereClause),
    ]);

    // CALCOLA RELEVANCE SCORE SE C'È UNA QUERY
    const results = products.map((product) =>
      this.mapToSearchResult(product, query)
    );

    // GENERA SUGGERIMENTI SE POCHI RISULTATI
    const suggestions =
      totalCount < 5 && query ? await this.generateSuggestions(query) : [];

    const searchTime = Date.now() - startTime;

    return {
      results,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      filters: {
        applied: filters,
        available: facets,
      },
      suggestions,
      searchTime,
      totalResults: totalCount,
    };
  }

  // RICERCA FULL-TEXT AVANZATA
  static async fullTextSearch(
    query: string,
    limit = 10
  ): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) {
      throw new SearchError("Query deve essere almeno 2 caratteri", 400);
    }

    const searchTerms = query.trim().toLowerCase().split(/\s+/);

    // QUERY FULL-TEXT CON WEIGHTED SCORING
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              // TITOLO (peso maggiore)
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              // DESCRIZIONE
              {
                description: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              // DESCRIZIONE BREVE
              {
                shortDescription: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              // SLUG
              {
                slug: {
                  contains: query.replace(/\s+/g, "-"),
                  mode: "insensitive",
                },
              },
              // CATEGORIA
              {
                category: {
                  name: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
              // TAGS
              {
                tags: {
                  some: {
                    name: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          where: { isMain: true },
          take: 1,
        },
        tags: true,
      },
      take: limit,
    });

    return products.map((product) => this.mapToSearchResult(product, query));
  }

  // RICERCA PER CATEGORIA CON FILTRI
  static async searchByCategory(
    categorySlug: string,
    filters: Omit<SearchFilters, "categorySlug">
  ): Promise<SearchResponse> {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      throw new SearchError("Categoria non trovata", 404);
    }

    return this.searchProducts({
      ...filters,
      categorySlug,
    });
  }

  // RICERCA PRODOTTI SIMILI
  static async findSimilarProducts(
    productId: string,
    limit = 6
  ): Promise<SearchResult[]> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        tags: true,
      },
    });

    if (!product) {
      throw new SearchError("Prodotto non trovato", 404);
    }

    const similarProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: productId },
        AND: [
          {
            OR: [
              // STESSA CATEGORIA
              {
                categoryId: product.categoryId,
              },
              // STESSI TAG
              {
                tags: {
                  some: {
                    id: {
                      in: product.tags.map((tag) => tag.id),
                    },
                  },
                },
              },
              // RANGE PREZZO SIMILE (+/- 50%)
              {
                AND: [
                  {
                    price: {
                      gte: Number(product.price) * 0.5,
                    },
                  },
                  {
                    price: {
                      lte: Number(product.price) * 1.5,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          where: { isMain: true },
          take: 1,
        },
        tags: true,
      },
      orderBy: [
        { averageRating: "desc" },
        { reviewCount: "desc" },
        { wishlistCount: "desc" },
      ],
      take: limit,
    });

    return similarProducts.map((p) => this.mapToSearchResult(p));
  }

  // PRODOTTI PIÙ POPOLARI
  static async getPopularProducts(
    categorySlug?: string,
    limit = 20
  ): Promise<SearchResult[]> {
    const whereClause = {
      isActive: true,
      ...(categorySlug && {
        category: {
          slug: categorySlug,
        },
      }),
    };

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          where: { isMain: true },
          take: 1,
        },
        tags: true,
      },
      orderBy: [
        { isFeatured: "desc" },
        { wishlistCount: "desc" },
        { viewCount: "desc" },
        { averageRating: "desc" },
        { reviewCount: "desc" },
      ],
      take: limit,
    });

    return products.map((p) => this.mapToSearchResult(p));
  }

  // AUTOCOMPLETE/SUGGESTIONS
  static async getAutocompleteSuggestions(
    query: string,
    limit = 8
  ): Promise<SearchSuggestion[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const [products, categories] = await Promise.all([
      // PRODOTTI
      prisma.product.findMany({
        where: {
          isActive: true,
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          name: true,
          reviewCount: true,
        },
        orderBy: [{ isFeatured: "desc" }, { reviewCount: "desc" }],
        take: limit,
      }),

      // CATEGORIE
      prisma.category.findMany({
        where: {
          isActive: true,
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
        select: {
          name: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        take: Math.floor(limit / 2),
      }),
    ]);

    const suggestions: SearchSuggestion[] = [];

    // AGGIUNGI PRODOTTI
    products.forEach((product) => {
      suggestions.push({
        query: product.name,
        type: "product",
        count: product.reviewCount,
      });
    });

    // AGGIUNGI CATEGORIE
    categories.forEach((category) => {
      suggestions.push({
        query: category.name,
        type: "category",
        count: category._count.products,
      });
    });

    return suggestions.slice(0, limit);
  }

  // TRACKING RICERCHE PER ANALYTICS
  static async trackSearch(analytics: SearchAnalytics): Promise<void> {
    if (process.env.NODE_ENV === "development") {
      console.log("Search Analytics:", {
        query: analytics.query,
        resultsCount: analytics.resultsCount,
        searchTime: analytics.searchTime,
        filters: Object.keys(analytics.filters).length,
      });
    }
  }

  // ==================== METODI HELPER PRIVATI ====================

  // COSTRUISCI WHERE CLAUSE PER PRISMA
  private static buildWhereClause(filters: SearchFilters): any {
    const where: any = {
      isActive: filters.isActive !== false, // Default true
    };

    // QUERY TESTUALE
    if (filters.query) {
      const searchTerms = filters.query.trim().toLowerCase().split(/\s+/);
      where.AND = [
        {
          OR: [
            {
              name: {
                contains: filters.query,
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: filters.query,
                mode: "insensitive",
              },
            },
            {
              shortDescription: {
                contains: filters.query,
                mode: "insensitive",
              },
            },
            {
              category: {
                name: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
            },
          ],
        },
      ];
    }

    // CATEGORIA
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.categorySlug) {
      where.category = {
        slug: filters.categorySlug,
      };
    }

    // PREZZO
    if (filters.minPrice !== undefined) {
      where.price = { ...where.price, gte: filters.minPrice };
    }
    if (filters.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filters.maxPrice };
    }

    // RATING
    if (filters.minRating !== undefined) {
      where.averageRating = { gte: filters.minRating };
    }

    // INVENTARIO
    if (filters.inStock === true) {
      where.stock = { gt: 0 };
    }
    if (filters.trackInventory !== undefined) {
      where.trackInventory = filters.trackInventory;
    }

    // TIPO PRODOTTO
    if (filters.isDigital !== undefined) {
      where.isDigital = filters.isDigital;
    }
    if (filters.isFeatured !== undefined) {
      where.isFeatured = filters.isFeatured;
    }

    // RECENSIONI
    if (filters.minReviews !== undefined) {
      where.reviewCount = { gte: filters.minReviews };
    }
    if (filters.hasReviews === true) {
      where.reviewCount = { gt: 0 };
    }

    // DATE
    if (filters.createdAfter) {
      where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
    }
    if (filters.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
    }

    // TAGS
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        some: {
          slug: {
            in: filters.tags,
          },
        },
      };
    }

    // IMMAGINI E VARIANTI
    if (filters.hasImages === true) {
      where.images = {
        some: {},
      };
    }
    if (filters.hasVariants === true) {
      where.variants = {
        some: {},
      };
    }

    return where;
  }

  // COSTRUISCI ORDER BY CLAUSE
  private static buildOrderBy(
    sortBy: SearchSortField,
    sortOrder: "asc" | "desc",
    query?: string
  ): any {
    switch (sortBy) {
      case "relevance":
        if (query) {
          return [
            { isFeatured: "desc" },
            { averageRating: "desc" },
            { reviewCount: "desc" },
            { createdAt: "desc" },
          ];
        }
        return [
          { isFeatured: "desc" },
          { wishlistCount: "desc" },
          { viewCount: "desc" },
        ];

      case "price":
        return { price: sortOrder };

      case "rating":
        return [{ averageRating: sortOrder }, { reviewCount: "desc" }];

      case "reviews":
        return { reviewCount: sortOrder };

      case "createdAt":
        return { createdAt: sortOrder };

      case "name":
        return { name: sortOrder };

      case "popularity":
        return [
          { wishlistCount: sortOrder },
          { viewCount: sortOrder },
          { reviewCount: "desc" },
        ];

      case "discount":
        return [{ originalPrice: { not: null } }, { originalPrice: "desc" }];

      default:
        return { createdAt: "desc" };
    }
  }

  // COSTRUISCI FACETS PER FILTRI
  private static async buildFacets(whereClause: any): Promise<SearchFacets> {
    const [categories, priceStats, ratings] = await Promise.all([
      // CATEGORIE
      prisma.product
        .groupBy({
          by: ["categoryId"],
          where: whereClause,
          _count: { categoryId: true },
        })
        .then(async (groups) => {
          const categoryIds = groups
            .filter((g) => g.categoryId)
            .map((g) => g.categoryId!);

          if (categoryIds.length === 0) return [];

          const categories = await prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, slug: true },
          });

          return groups
            .map((group) => {
              const category = categories.find(
                (c) => c.id === group.categoryId
              );
              return category
                ? {
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    count: group._count.categoryId,
                  }
                : null;
            })
            .filter(Boolean) as SearchFacets["categories"];
        }),

      // STATISTICHE PREZZO
      prisma.product.aggregate({
        where: whereClause,
        _min: { price: true },
        _max: { price: true },
        _count: { price: true },
      }),

      // RATING DISTRIBUTION
      prisma.product.groupBy({
        by: ["averageRating"],
        where: {
          ...whereClause,
          averageRating: { gt: 0 },
        },
        _count: { averageRating: true },
      }),
    ]);

    // COSTRUISCI PRICE RANGES
    const minPrice = Number(priceStats._min.price) || 0;
    const maxPrice = Number(priceStats._max.price) || 1000;
    const priceRanges = this.generatePriceRanges(minPrice, maxPrice);

    return {
      categories,
      priceRanges,
      ratings: ratings.map((r) => ({
        rating: Math.floor(Number(r.averageRating)),
        count: r._count.averageRating,
      })),
      tags: [], // TODO: Implementa se necessario
      availability: {
        inStock: 0, // TODO: Calcola
        outOfStock: 0,
      },
      productTypes: {
        digital: 0, // TODO: Calcola
        physical: 0,
        featured: 0,
      },
    };
  }
  // GENERA PRICE RANGES DINAMICI
  private static generatePriceRanges(
    min: number,
    max: number
  ): SearchFacets["priceRanges"] {
    const ranges = [];
    const step = Math.ceil((max - min) / 5);

    for (let i = 0; i < 5; i++) {
      const rangeMin = min + i * step;
      const rangeMax = i === 4 ? max : min + (i + 1) * step;

      ranges.push({
        min: rangeMin,
        max: rangeMax,
        count: 0,
        label: `€${rangeMin} - €${rangeMax}`,
      });
    }

    return ranges;
  }

  // GENERA SUGGERIMENTI PER QUERY CON POCHI RISULTATI
  private static async generateSuggestions(query: string): Promise<string[]> {
    // IMPLEMENTA LOGICA SUGGERIMENTI
    // - Correzioni typo
    // - Query simili
    // - Rimozione di parole
    // - Categorie correlate

    const suggestions: string[] = [];

    // Suggerimento base: rimuovi ultima parola
    const words = query.split(" ");
    if (words.length > 1) {
      suggestions.push(words.slice(0, -1).join(" "));
    }

    return suggestions;
  }

  // MAPPA PRODOTTO PRISMA A SEARCH RESULT
  private static mapToSearchResult(product: any, query?: string): SearchResult {
    // CALCOLA RELEVANCE SCORE SE C'È UNA QUERY
    let relevanceScore = 0;
    const matchedFields: string[] = [];

    if (query) {
      const lowerQuery = query.toLowerCase();
      const lowerName = product.name.toLowerCase();
      const lowerDesc = (product.description || "").toLowerCase();

      // EXACT MATCH NEL TITOLO (score alto)
      if (lowerName.includes(lowerQuery)) {
        relevanceScore += 100;
        matchedFields.push("title");
      }

      // MATCH NELLA DESCRIZIONE
      if (lowerDesc.includes(lowerQuery)) {
        relevanceScore += 50;
        matchedFields.push("description");
      }

      // BOOST PER PRODOTTI POPOLARI
      relevanceScore += Math.min(product.reviewCount * 2, 50);
      relevanceScore += Math.min(product.wishlistCount, 30);
      relevanceScore += product.isFeatured ? 25 : 0;
    }

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      price: Number(product.price),
      originalPrice: product.originalPrice
        ? Number(product.originalPrice)
        : undefined,
      discountPercentage: product.originalPrice
        ? Math.round(
            ((Number(product.originalPrice) - Number(product.price)) /
              Number(product.originalPrice)) *
              100
          )
        : undefined,
      averageRating: Number(product.averageRating),
      reviewCount: product.reviewCount,
      stock: product.stock,
      isDigital: product.isDigital,
      isFeatured: product.isFeatured,
      wishlistCount: product.wishlistCount || 0,
      viewCount: product.viewCount || 0,
      downloadCount: product.downloadCount || 0,
      createdAt: product.createdAt,
      category: product.category,
      images: product.images || [],
      tags: product.tags || [],
      relevanceScore,
      matchedFields,
    };
  }
}
