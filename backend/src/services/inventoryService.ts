import { prisma } from "../utils/prisma";

// ===========================================
//          INVENTORY SERVICE CLASS
// ===========================================

export class InventoryService {
  // ===========================================
  //           STOCK AVAILABILITY
  // ===========================================

  // CONTROLLA DISPONIBILITÀ STOCK PER PRODOTTO/VARIANTE
  static async checkStockAvailability(
    productId: string,
    variantId?: string,
    quantity: number = 1
  ): Promise<{
    available: boolean;
    currentStock: number;
    message?: string;
  }> {
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });

      if (!variant || !variant.isActive || !variant.product.isActive) {
        return {
          available: false,
          currentStock: 0,
          message: "Product not available",
        };
      }

      if (variant.product.isDigital) {
        return { available: true, currentStock: 999999 };
      }

      if (!variant.product.trackInventory) {
        return { available: true, currentStock: 999999 };
      }

      const available =
        variant.product.stock >= quantity || variant.product.allowBackorder;
      return {
        available,
        currentStock: variant.product.stock,
        message: !available
          ? `Only ${variant.product.stock} items available`
          : undefined,
      };
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isActive) {
      return {
        available: false,
        currentStock: 0,
        message: "Product not available",
      };
    }

    if (product.isDigital || !product.trackInventory) {
      return { available: true, currentStock: 999999 };
    }

    const available = product.stock >= quantity || product.allowBackorder;
    return {
      available,
      currentStock: product.stock,
      message: !available ? `Only ${product.stock} items available` : undefined,
    };
  }

  // CONTROLLA DISPONIBILITÀ MULTIPLI PRODOTTI (CARRELLO)
  static async checkMultipleAvailability(
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
    }>
  ) {
    const results = [];

    for (const item of items) {
      try {
        const availability = await this.checkStockAvailability(
          item.productId,
          item.variantId,
          item.quantity
        );

        results.push({
          productId: item.productId,
          variantId: item.variantId,
          requestedQuantity: item.quantity,
          ...availability,
        });
      } catch (error) {
        results.push({
          productId: item.productId,
          variantId: item.variantId,
          requestedQuantity: item.quantity,
          available: false,
          currentStock: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const allAvailable = results.every((item) => item.available);

    return {
      allAvailable,
      items: results,
      summary: {
        total: results.length,
        available: results.filter((item) => item.available).length,
        unavailable: results.filter((item) => !item.available).length,
      },
    };
  }

  // ===========================================
  //           STOCK MANAGEMENT
  // ===========================================

  // RIDUCI STOCK (PER VENDITA)
  static async reduceStock(
    productId: string,
    variantId: string | undefined,
    quantity: number
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.isDigital || !product.trackInventory) {
      return;
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          decrement: quantity,
        },
      },
    });

    const updatedProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (
      updatedProduct &&
      updatedProduct.stock <= updatedProduct.lowStockThreshold
    ) {
      console.warn(
        `⚠️  Low stock alert: Product ${productId} has ${updatedProduct.stock} items left`
      );
    }
  }

  // RIPRISTINA STOCK (PER CANCELLAZIONE ORDINE)
  static async restoreStock(
    productId: string,
    variantId: string | undefined,
    quantity: number
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.isDigital || !product.trackInventory) {
      return;
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantity,
        },
      },
    });

    console.log(`✅ Stock restored: Product ${productId} (+${quantity})`);
  }

  // AGGIORNA STOCK MANUALMENTE
  static async updateStock(
    productId: string,
    quantity: number,
    reason?: string,
    userId?: string
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.isDigital || !product.trackInventory) {
      return {
        success: true,
        message: "Digital product - inventory not tracked",
        previousStock: product.stock,
        newStock: product.stock,
      };
    }

    const newStock = Math.max(0, product.stock + quantity);

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    console.log(
      `📦 Stock Update: ${product.name} - ${product.stock} → ${newStock} (${
        quantity > 0 ? "+" : ""
      }${quantity}) - Reason: ${reason || "Manual update"}`
    );

    return {
      productId,
      productName: product.name,
      previousStock: product.stock,
      newStock: updatedProduct.stock,
      change: quantity,
      reason: reason || "Manual update",
      timestamp: new Date(),
    };
  }

  // AGGIORNAMENTO STOCK IN MASSA
  static async bulkUpdateStock(
    updates: Array<{
      productId: string;
      newStock: number;
      reason?: string;
    }>
  ) {
    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: update.productId },
          select: {
            stock: true,
            name: true,
            trackInventory: true,
            isDigital: true,
          },
        });

        if (!product) {
          errors.push({
            productId: update.productId,
            error: "Product not found",
          });
          continue;
        }

        if (product.isDigital || !product.trackInventory) {
          results.push({
            productId: update.productId,
            skipped: true,
            reason: "Digital product or inventory not tracked",
          });
          continue;
        }

        const stockChange = update.newStock - product.stock;

        const result = await this.updateStock(
          update.productId,
          stockChange,
          update.reason || "Bulk update"
        );

        results.push(result);
      } catch (error) {
        errors.push({
          productId: update.productId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ===========================================
  //            INVENTORY ALERTS
  // ===========================================

  // OTTIENI PRODOTTI CON STOCK BASSO
  static async getLowStockProducts(): Promise<
    Array<{
      id: string;
      name: string;
      currentStock: number;
      threshold: number;
      category?: string;
    }>
  > {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        trackInventory: true,
        stock: {
          lte: prisma.product.fields.lowStockThreshold,
        },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        lowStockThreshold: true,
        category: {
          select: { name: true },
        },
      },
      orderBy: { stock: "asc" },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      currentStock: product.stock,
      threshold: product.lowStockThreshold,
      category: product.category?.name,
    }));
  }

  // OTTIENI PRODOTTI ESAURITI
  static async getOutOfStockProducts() {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        trackInventory: true,
        stock: 0,
        isDigital: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        stock: true,
        category: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      currentStock: product.stock,
      category: product.category?.name,
      status: "out_of_stock" as const,
    }));
  }

  // ===========================================
  //           INVENTORY STATISTICS
  // ===========================================

  // STATISTICHE INVENTARIO GENERALI
  static async getInventoryStats() {
    const [
      totalProducts,
      activeProducts,
      lowStockCount,
      outOfStockCount,
      digitalProductsCount,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({
        where: {
          isActive: true,
          trackInventory: true,
          stock: { lte: prisma.product.fields.lowStockThreshold },
        },
      }),
      prisma.product.count({
        where: {
          isActive: true,
          trackInventory: true,
          stock: 0,
        },
      }),
      prisma.product.count({
        where: { isDigital: true },
      }),
    ]);

    return {
      totalProducts,
      activeProducts,
      lowStockCount,
      outOfStockCount,
      digitalProductsCount,
      physicalProductsCount: totalProducts - digitalProductsCount,
    };
  }

  // STATISTICHE INVENTARIO DETTAGLIATE
  static async getDetailedInventoryStats() {
    const [basicStats, stockDistribution, recentlyUpdated] = await Promise.all([
      // USA LA FUNZIONE ESISTENTE
      this.getInventoryStats(),

      // DISTRIBUZIONE STOCK
      prisma.product.groupBy({
        by: ["trackInventory"],
        where: { isActive: true },
        _count: true,
        _sum: { stock: true },
        _avg: { stock: true },
      }),

      // PRODOTTI AGGIORNATI DI RECENTE
      prisma.product.findMany({
        where: {
          isActive: true,
          trackInventory: true,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // ULTIMI 7 GIORNI
          },
        },
        select: {
          id: true,
          name: true,
          stock: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      ...basicStats,
      stockDistribution,
      recentlyUpdated,
      alerts: {
        lowStock: basicStats.lowStockCount,
        outOfStock: basicStats.outOfStockCount,
        totalAlerts: basicStats.lowStockCount + basicStats.outOfStockCount,
      },
    };
  }

  // ===========================================
  //           PRODUCT STATUS & CONFIG
  // ===========================================

  // OTTIENI STATUS STOCK PRODOTTO
  static async getProductStockStatus(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        stock: true,
        lowStockThreshold: true,
        trackInventory: true,
        allowBackorder: true,
        isActive: true,
        isDigital: true,
        category: {
          select: { name: true },
        },
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    let status: "in_stock" | "low_stock" | "out_of_stock" | "not_tracked" =
      "not_tracked";
    let stockPercentage = null;

    if (product.trackInventory && !product.isDigital) {
      if (product.stock <= 0) {
        status = "out_of_stock";
      } else if (product.stock <= product.lowStockThreshold) {
        status = "low_stock";
      } else {
        status = "in_stock";
      }

      stockPercentage =
        product.lowStockThreshold > 0
          ? Math.round((product.stock / product.lowStockThreshold) * 100)
          : null;
    }

    return {
      ...product,
      status,
      stockPercentage,
      needsAttention: status === "low_stock" || status === "out_of_stock",
    };
  }

  // IMPOSTA SOGLIA STOCK BASSO
  static async setLowStockThreshold(productId: string, threshold: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    return await prisma.product.update({
      where: { id: productId },
      data: { lowStockThreshold: Math.max(0, threshold) },
    });
  }

  // ATTIVA/DISATTIVA TRACKING INVENTARIO
  static async toggleInventoryTracking(
    productId: string,
    trackInventory: boolean
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    return await prisma.product.update({
      where: { id: productId },
      data: { trackInventory },
    });
  }

  // ===========================================
  //             TESTING & SIMULATION
  // ===========================================

  // SIMULA VENDITA (PER TEST)
  static async simulateSale(
    productId: string,
    quantity: number = 1,
    variantId?: string
  ) {
    const availability = await this.checkStockAvailability(
      productId,
      variantId,
      quantity
    );

    if (!availability.available) {
      throw new Error(`Cannot complete sale: ${availability.message}`);
    }

    await this.reduceStock(productId, variantId, quantity);

    return {
      success: true,
      message: `Sale completed: ${quantity} units of product ${productId}`,
      remainingStock: availability.currentStock - quantity,
    };
  }
}
