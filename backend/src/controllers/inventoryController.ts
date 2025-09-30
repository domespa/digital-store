import { Request, Response } from "express";
import { InventoryService } from "../services/inventoryService";
import { prisma } from "../utils/prisma";

export class InventoryController {
  static async getInventoryStats(req: Request, res: Response) {
    try {
      const stats = await InventoryService.getInventoryStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get inventory stats error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch inventory stats",
      });
    }
  }

  static async getLowStockProducts(req: Request, res: Response) {
    try {
      const lowStockProducts = await InventoryService.getLowStockProducts();

      res.json({
        success: true,
        data: lowStockProducts,
        count: lowStockProducts.length,
      });
    } catch (error) {
      console.error("Get low stock products error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch low stock products",
      });
    }
  }

  static async checkAvailability(req: Request, res: Response) {
    try {
      const { productId, variantId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: "productId is required",
        });
      }

      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          error: "quantity must be at least 1",
        });
      }

      const availability = await InventoryService.checkStockAvailability(
        productId,
        variantId,
        quantity
      );

      res.json({
        success: true,
        data: {
          productId,
          variantId,
          requestedQuantity: quantity,
          ...availability,
        },
      });
    } catch (error) {
      console.error("Check availability error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check availability",
      });
    }
  }

  static async checkMultipleAvailability(req: Request, res: Response) {
    try {
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: "items must be a non-empty array",
        });
      }

      for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity < 1) {
          return res.status(400).json({
            success: false,
            error: "Each item must have productId and quantity >= 1",
          });
        }
      }

      const results = [];
      for (const item of items) {
        try {
          const availability = await InventoryService.checkStockAvailability(
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

      res.json({
        success: true,
        data: {
          allAvailable,
          items: results,
          summary: {
            total: results.length,
            available: results.filter((item) => item.available).length,
            unavailable: results.filter((item) => !item.available).length,
          },
        },
      });
    } catch (error) {
      console.error("Check multiple availability error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check availability",
      });
    }
  }

  static async updateStock(req: Request, res: Response) {
    try {
      const { productId, quantity, reason } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: "productId is required",
        });
      }

      if (quantity === undefined || typeof quantity !== "number") {
        return res.status(400).json({
          success: false,
          error: "quantity must be a number",
        });
      }

      const currentAvailability = await InventoryService.checkStockAvailability(
        productId
      );

      if (quantity > 0) {
        await InventoryService.restoreStock(productId, undefined, quantity);
      } else if (quantity < 0) {
        await InventoryService.reduceStock(
          productId,
          undefined,
          Math.abs(quantity)
        );
      }

      res.json({
        success: true,
        message: `Stock ${
          quantity > 0 ? "increased" : "decreased"
        } by ${Math.abs(quantity)} units`,
        data: {
          productId,
          change: quantity,
          previousStock: currentAvailability.currentStock,
          newStock: currentAvailability.currentStock + quantity,
          reason: reason || "Manual update",
        },
      });
    } catch (error) {
      console.error("Update stock error:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update stock",
      });
    }
  }

  static async restoreStock(req: Request, res: Response) {
    try {
      const { productId, variantId, quantity, reason, reference } = req.body;

      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          error: "productId and quantity > 0 are required",
        });
      }

      await InventoryService.restoreStock(productId, variantId, quantity);

      res.json({
        success: true,
        message: `Stock restored: +${quantity} units`,
        data: {
          productId,
          variantId,
          quantity,
          reason: reason || "Stock restoration",
          reference,
        },
      });
    } catch (error) {
      console.error("Restore stock error:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to restore stock",
      });
    }
  }

  static async reduceStock(req: Request, res: Response) {
    try {
      const { productId, variantId, quantity, reason } = req.body;

      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          error: "productId and quantity > 0 are required",
        });
      }

      const availability = await InventoryService.checkStockAvailability(
        productId,
        variantId,
        quantity
      );

      if (!availability.available) {
        return res.status(400).json({
          success: false,
          error: availability.message || "Insufficient stock",
        });
      }

      await InventoryService.reduceStock(productId, variantId, quantity);

      res.json({
        success: true,
        message: `Stock reduced: -${quantity} units`,
        data: {
          productId,
          variantId,
          quantity,
          reason: reason || "Stock reduction",
          remainingStock: availability.currentStock - quantity,
        },
      });
    } catch (error) {
      console.error("Reduce stock error:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to reduce stock",
      });
    }
  }

  static async getProductStockStatus(req: Request, res: Response) {
    try {
      const { productId } = req.params;

      const availability = await InventoryService.checkStockAvailability(
        productId
      );

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
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      let status: "in_stock" | "low_stock" | "out_of_stock" | "not_tracked" =
        "not_tracked";

      if (product.trackInventory && !product.isDigital) {
        if (product.stock <= 0) {
          status = "out_of_stock";
        } else if (product.stock <= product.lowStockThreshold) {
          status = "low_stock";
        } else {
          status = "in_stock";
        }
      }

      res.json({
        success: true,
        data: {
          ...product,
          status,
          available: availability.available,
          stockPercentage:
            product.lowStockThreshold > 0
              ? Math.round((product.stock / product.lowStockThreshold) * 100)
              : null,
        },
      });
    } catch (error) {
      console.error("Get product stock status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get product stock status",
      });
    }
  }

  static async getOutOfStockProducts(req: Request, res: Response) {
    try {
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

      const outOfStockProducts = products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        currentStock: product.stock,
        category: product.category?.name,
        status: "out_of_stock",
      }));

      res.json({
        success: true,
        data: outOfStockProducts,
        count: outOfStockProducts.length,
      });
    } catch (error) {
      console.error("Get out of stock products error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch out of stock products",
      });
    }
  }

  static async bulkUpdateStock(req: Request, res: Response) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: "updates must be a non-empty array",
        });
      }

      for (const update of updates) {
        if (!update.productId || update.newStock === undefined) {
          return res.status(400).json({
            success: false,
            error: "Each update must have productId and newStock",
          });
        }

        if (typeof update.newStock !== "number" || update.newStock < 0) {
          return res.status(400).json({
            success: false,
            error: "newStock must be a number >= 0",
          });
        }
      }

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

          const stockDifference = update.newStock - product.stock;

          if (stockDifference > 0) {
            await InventoryService.restoreStock(
              update.productId,
              undefined,
              stockDifference
            );
          } else if (stockDifference < 0) {
            await InventoryService.reduceStock(
              update.productId,
              undefined,
              Math.abs(stockDifference)
            );
          }

          results.push({
            productId: update.productId,
            productName: product.name,
            previousStock: product.stock,
            newStock: update.newStock,
            change: stockDifference,
            reason: update.reason || "Bulk update",
          });
        } catch (error) {
          errors.push({
            productId: update.productId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      res.json({
        success: true,
        message: `Bulk update completed: ${results.length} successful, ${errors.length} errors`,
        data: {
          successful: results.length,
          failed: errors.length,
          results,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (error) {
      console.error("Bulk update stock error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to bulk update stock",
      });
    }
  }

  static async simulateSale(req: Request, res: Response) {
    try {
      const { productId, variantId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: "productId is required",
        });
      }

      const availability = await InventoryService.checkStockAvailability(
        productId,
        variantId,
        quantity
      );

      if (!availability.available) {
        return res.status(400).json({
          success: false,
          error: `Cannot complete sale: ${availability.message}`,
        });
      }

      await InventoryService.reduceStock(productId, variantId, quantity);

      res.json({
        success: true,
        message: `Sale simulation completed: ${quantity} units sold`,
        data: {
          productId,
          variantId,
          quantitySold: quantity,
          remainingStock: availability.currentStock - quantity,
        },
      });
    } catch (error) {
      console.error("Simulate sale error:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to simulate sale",
      });
    }
  }
}
