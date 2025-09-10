import { PrismaClient, Prisma } from "../generated/prisma";
import {
  WishlistItem,
  WishlistData,
  AddToWishlistRequest,
  WishlistFilters,
  WishlistStats,
  WishlistError,
} from "../types/wishlist";

const prisma = new PrismaClient();

// ===========================================
//               PRISMA TYPES
// ===========================================

type WishlistWithProduct = Prisma.WishlistGetPayload<{
  include: {
    product: {
      include: {
        images: {
          where: { isMain: true };
          take: 1;
        };
        category: {
          select: {
            id: true;
            name: true;
            slug: true;
          };
        };
      };
    };
  };
}>;

type WishlistWithProductBasic = Prisma.WishlistGetPayload<{
  include: {
    product: {
      include: {
        images: {
          where: { isMain: true };
          take: 1;
        };
      };
    };
  };
}>;

type WishlistBasic = Prisma.WishlistGetPayload<{}>;

// ===========================================
//          WISHLIST SERVICE CLASS
// ===========================================

export class WishlistService {
  // ===========================================
  //            WISHLIST MANAGEMENT
  // ===========================================

  // AGGIUNGI PRODOTTO ALLA WISHLIST
  static async addToWishlist(
    userId: string,
    data: AddToWishlistRequest
  ): Promise<WishlistItem> {
    const { productId } = data;

    // VERIFICA PRODOTTO ATTIVO
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new WishlistError("Product not found", 404);
    }

    if (!product.isActive) {
      throw new WishlistError("Can't add product on wishlist", 400);
    }

    const existingItem = await prisma.wishlist.findUnique({
      where: {
        unique_user_product_wishlist: {
          userId,
          productId,
        },
      },
    });

    if (existingItem) {
      throw new WishlistError("Product already on list", 409);
    }

    // AGGIUNGI PRODOTTO ALLA LISTA
    return await prisma.$transaction(async (tx) => {
      const wishlistItem: WishlistWithProduct = await tx.wishlist.create({
        data: {
          userId,
          productId,
        },
        include: {
          product: {
            include: {
              images: {
                where: { isMain: true },
                take: 1,
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      // AGGIORNA CONTEGGIO WISHLIST
      await tx.product.update({
        where: { id: productId },
        data: {
          wishlistCount: { increment: 1 },
        },
      });
      return this.mapPrismaToWishlistItem(wishlistItem);
    });
  }

  // RIMUOVI PRODOTTO DALLA WISHLIST
  static async removeFromWishlist(
    userId: string,
    productId: string
  ): Promise<void> {
    const existingItem = await prisma.wishlist.findUnique({
      where: {
        unique_user_product_wishlist: {
          userId,
          productId,
        },
      },
    });

    if (!existingItem) {
      throw new WishlistError("Prodotto non presente nella wishlist", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wishlist.delete({
        where: {
          unique_user_product_wishlist: {
            userId,
            productId,
          },
        },
      });

      // AGGIORNA IL CONTEGGIO
      await tx.product.update({
        where: { id: productId },
        data: {
          wishlistCount: { decrement: 1 },
        },
      });
    });
  }

  // SVUOTA COMPLETAMENTE LA WISHLIST
  static async clearWishlist(userId: string): Promise<void> {
    const wishlistItems = await prisma.wishlist.findMany({
      where: { userId },
      select: { productId: true },
    });

    if (wishlistItems.length === 0) return;

    await prisma.$transaction(async (tx) => {
      await tx.wishlist.deleteMany({
        where: { userId },
      });

      // AGGIORNA CONTEGGI PER TUTTI I PRODOTTI
      for (const item of wishlistItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            wishlistCount: { decrement: 1 },
          },
        });
      }
    });
  }

  // ===========================================
  //            WISHLIST RETRIEVAL
  // ===========================================

  // OTTIENI WISHLIST UTENTE CON FILTRI
  static async getUserWishlist(
    userId: string,
    filters: WishlistFilters = {}
  ): Promise<WishlistData> {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      category,
      minPrice,
      maxPrice,
      inStock,
    } = filters;

    const skip = (page - 1) * limit;
    const whereClause: Prisma.WishlistWhereInput = {
      userId,
      product: {
        isActive: true,
        ...(category && {
          category: {
            slug: category,
          },
        }),
        ...(minPrice !== undefined && {
          price: { gte: minPrice },
        }),
        ...(maxPrice !== undefined && {
          price: { lte: maxPrice },
        }),
        ...(inStock === true && {
          stock: { gt: 0 },
        }),
      },
    };

    // DETERMINA ORDINAMENTO
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    const [items, total] = await Promise.all([
      prisma.wishlist.findMany({
        where: whereClause,
        include: {
          product: {
            include: {
              images: {
                where: { isMain: true },
                take: 1,
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.wishlist.count({ where: whereClause }),
    ]);

    return {
      items: items.map(this.mapPrismaToWishlistItem),
      totalItems: total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // CONTROLLA SE PRODOTTO È IN WISHLIST
  static async isInWishlist(
    userId: string,
    productId: string
  ): Promise<boolean> {
    const item = await prisma.wishlist.findUnique({
      where: {
        unique_user_product_wishlist: {
          userId,
          productId,
        },
      },
    });

    return !!item;
  }

  // STATISTICHE WISHLIST UTENTE
  static async getWishlistStats(userId: string): Promise<WishlistStats> {
    const [items, aggregation] = await Promise.all([
      // ITEMS RECENTI CON CATEGORY PER CONSISTENZA
      prisma.wishlist.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              images: {
                where: { isMain: true },
                take: 1,
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // AGGREGAZIONE PREZZI
      prisma.wishlist.findMany({
        where: {
          userId,
          product: { isActive: true },
        },
        include: {
          product: {
            select: {
              price: true,
            },
          },
        },
      }),
    ]);

    const totalItems = aggregation.length;
    const totalValue = aggregation.reduce(
      (sum, item) => sum + Number(item.product.price),
      0
    );
    const averageItemPrice = totalItems > 0 ? totalValue / totalItems : 0;

    const categories = await prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          include: { category: true },
        },
      },
    });

    const uniqueCategories = new Set(
      categories.map((item) => item.product.category?.id).filter(Boolean)
    );

    return {
      totalItems,
      totalValue,
      averageItemPrice,
      categoriesCount: uniqueCategories.size,
      recentlyAdded: items.map(this.mapPrismaToWishlistItem),
    };
  }

  // ===========================================
  //         CART INTEGRATION
  // ===========================================

  // SPOSTA ITEM NEL CARRELLO
  static async moveToCart(userId: string, productId: string): Promise<void> {
    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        unique_user_product_wishlist: {
          userId,
          productId,
        },
      },
    });

    if (!wishlistItem) {
      throw new WishlistError("Prodotto non trovato nella wishlist", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wishlist.delete({
        where: {
          unique_user_product_wishlist: {
            userId,
            productId,
          },
        },
      });
      await tx.product.update({
        where: { id: productId },
        data: {
          wishlistCount: { decrement: 1 },
        },
      });
    });
  }

  // ===========================================
  //           BULK OPERATIONS
  // ===========================================

  // OPERAZIONI BULK SULLA WISHLIST
  static async bulkOperations(
    userId: string,
    operation: "remove" | "moveToCart",
    productIds: string[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const productId of productIds) {
      try {
        if (operation === "remove") {
          await this.removeFromWishlist(userId, productId);
        } else if (operation === "moveToCart") {
          await this.moveToCart(userId, productId);
        }
        success++;
      } catch (error) {
        failed++;
        console.error(`Bulk operation failed for product ${productId}:`, error);
      }
    }

    return { success, failed };
  }

  // ===========================================
  //            HELPER METHODS
  // ===========================================

  // COSTRUISCI CLAUSOLA ORDER BY
  private static buildOrderBy(
    sortBy: string,
    sortOrder: string
  ): Prisma.WishlistOrderByWithRelationInput {
    switch (sortBy) {
      case "productName":
        return { product: { name: sortOrder as Prisma.SortOrder } };
      case "price":
        return { product: { price: sortOrder as Prisma.SortOrder } };
      case "createdAt":
      default:
        return { createdAt: sortOrder as Prisma.SortOrder };
    }
  }

  // MAPPA RISULTATO PRISMA A WISHLIST ITEM
  private static mapPrismaToWishlistItem(
    prismaItem: WishlistWithProduct
  ): WishlistItem {
    return {
      id: prismaItem.id,
      userId: prismaItem.userId,
      productId: prismaItem.productId,
      createdAt: prismaItem.createdAt,
      updatedAt: prismaItem.updatedAt,
      product: prismaItem.product
        ? {
            id: prismaItem.product.id,
            name: prismaItem.product.name,
            slug: prismaItem.product.slug,
            price: Number(prismaItem.product.price),
            originalPrice: prismaItem.product.originalPrice
              ? Number(prismaItem.product.originalPrice)
              : undefined,
            images:
              prismaItem.product.images?.map((img) => ({
                id: img.id,
                url: img.url,
                altText: img.altText ?? undefined,
                isMain: img.isMain,
              })) || [],
            isActive: prismaItem.product.isActive,
            stock: prismaItem.product.stock,
            averageRating: prismaItem.product.averageRating || 0,
            reviewCount: prismaItem.product.reviewCount || 0,
            category: prismaItem.product.category
              ? {
                  id: prismaItem.product.category.id,
                  name: prismaItem.product.category.name,
                  slug: prismaItem.product.category.slug,
                }
              : undefined,
          }
        : undefined,
    };
  }
}
