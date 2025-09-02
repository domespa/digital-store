import { Request, Response } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";
import {
  CreateOrderRequest,
  OrderResponse,
  OrderListResponse,
  OrderDetailResponse,
  CreateOrderResponse,
  OrderItemData,
  OrderFilters,
  UpdateOrderStatusRequest,
} from "../types/order";

const prisma = new PrismaClient();

const getStringParam = (param: unknown): string | undefined => {
  return typeof param === "string" ? param : undefined;
};

// CREAZIONE ORDINE
// POST /api/orders

export const createOrder = async (req: Request, res: Response) => {
  try {
    const {
      customerEmail,
      customerFirstName,
      customerLastName,
      items,
      discountCode,
    }: CreateOrderRequest = req.body;

    // VALIDAZIONE
    if (!customerEmail || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Customer email and items are required",
      });
    }

    // VALIDAZIONE EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // VALIDAZIONE ITEMS
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Each item must have productId and positive quantity",
        });
      }
    }

    // VERIFICA DISPONIBILITà DEL PRODOTTO
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    // CONTROLLA CHE I PRODOTTI ESISTINO
    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      return res.status(400).json({
        success: false,
        message: `Products not found or inactive: ${missingIds.join(", ")}`,
      });
    }

    // CALCOLO TOTALE ORDINE
    let subtotal = 0;
    const orderItemsData: OrderItemData[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      const lineTotal = product.price.toNumber() * item.quantity;
      subtotal += lineTotal;

      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price.toNumber(),
      });
    }

    let discount = 0;
    let discountCodeRecord = null;

    // APPLICA CODICE SCONTO SE PRESENTE
    if (discountCode) {
      discountCodeRecord = await prisma.discountCode.findFirst({
        where: {
          code: discountCode.trim().toUpperCase(),
          isActive: true,
          OR: [{ validFrom: null }, { validFrom: { lte: new Date() } }],
        },
      });

      if (!discountCodeRecord) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired discount code",
        });
      }

      // CONTROLLO SCADENZA SCONTO
      if (
        discountCodeRecord.validUntil &&
        discountCodeRecord.validUntil < new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Discount code has expired",
        });
      }

      // CONTROLLO LIMITI SCONTO USO
      if (
        discountCodeRecord.maxUses &&
        discountCodeRecord.currentUses >= discountCodeRecord.maxUses
      ) {
        return res.status(400).json({
          success: false,
          message: "Discount code usage limit reached",
        });
      }

      // DOPO DI CHE CALCOLA LO SCONTO
      if (discountCodeRecord.discountType === "PERCENTAGE") {
        discount =
          (subtotal * discountCodeRecord.discountValue.toNumber()) / 100;
      } else {
        discount = discountCodeRecord.discountValue.toNumber();
      }

      // LO SCONTO NON PUO SUPERARE IL TOTALE DELL'ORDINE wtf?
      discount = Math.min(discount, subtotal);
    }

    const total = subtotal - discount;

    // VERIFICHIAMO SE L'UTENTE è REGISTRATO
    const userId = req.user?.id || null;

    // CREAZIONE ORDINE
    const result = await prisma.$transaction(async (tx) => {
      // CREA ORDINE
      const order = await tx.order.create({
        data: {
          customerEmail: customerEmail.toLowerCase(),
          customerFirstName: customerFirstName?.trim() || null,
          customerLastName: customerLastName?.trim() || null,
          total: total,
          status: "PENDING",
          paymentStatus: "PENDING",
          userId: userId,
          orderItems: {
            create: orderItemsData,
          },
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  fileName: true,
                  // NON includere filePath per sicurezza
                },
              },
            },
          },
          user: userId
            ? {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              }
            : false,
        },
      });

      // AGGIORNIAMO IL CONTATORE DELLO SCONTO USATO
      if (discountCodeRecord) {
        await tx.discountCode.update({
          where: { id: discountCodeRecord.id },
          data: { currentUses: { increment: 1 } },
        });
      }

      return order;
    });

    // PREPARIAMO LA RESPONSE
    const orderResponse: OrderResponse = {
      id: result.id,
      customerEmail: result.customerEmail,
      customerFirstName: result.customerFirstName,
      customerLastName: result.customerLastName,
      total: result.total.toNumber(),
      status: result.status,
      paymentProvider: result.stripePaymentIntentId
        ? "STRIPE"
        : result.paypalOrderId
        ? "PAYPAL"
        : null,
      paymentStatus: result.paymentStatus,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      orderItems: result.orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price.toNumber(),
        productId: item.productId,
        product: item.product,
      })),
      userId: result.userId || undefined,
    };

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: orderResponse,
    } as CreateOrderResponse);
  } catch (error: unknown) {
    console.error("Create order error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};

// LISTA ORDINI DELL'UTENTE
// GET /api/user/orders
export const getUserOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const page = getStringParam(req.query.page) || "1";
    const limit = getStringParam(req.query.limit) || "10";

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: req.user.id },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  fileName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.order.count({
        where: { userId: req.user.id },
      }),
    ]);

    // CONTERTO DECIMAL IN NUMBER
    const ordersResponse: OrderResponse[] = orders.map((order) => ({
      id: order.id,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      total: order.total.toNumber(),
      status: order.status,
      paymentProvider: order.stripePaymentIntentId
        ? "STRIPE"
        : order.paypalOrderId
        ? "PAYPAL"
        : null,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItems: order.orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price.toNumber(),
        productId: item.productId,
        product: item.product,
      })),
      userId: order.userId || undefined,
    }));

    res.json({
      success: true,
      message: "Orders retrieved successfully",
      orders: ordersResponse,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    } as OrderListResponse);
  } catch (error: unknown) {
    console.error("Get user orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get orders",
    });
  }
};

// DETTAGLIO ORDINE
// GET /api/orders/:id
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                fileName: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // CONTROLLO LE AUTORZZAZIONI
    const isOwner = req.user && order.userId === req.user.id;
    const isAdmin = req.user && req.user.role === "ADMIN";
    const isGuestOwner = !req.user && !order.userId;

    if (!isOwner && !isAdmin && !isGuestOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // PREPARO LA RESPOSNE
    const orderResponse: OrderResponse = {
      id: order.id,
      customerEmail: order.customerEmail,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      total: order.total.toNumber(),
      status: order.status,
      paymentProvider: order.stripePaymentIntentId
        ? "STRIPE"
        : order.paypalOrderId
        ? "PAYPAL"
        : null,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItems: order.orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price.toNumber(),
        productId: item.productId,
        product: item.product,
      })),
      userId: order.userId || undefined,
    };

    res.json({
      success: true,
      message: "Order retrieved successfully",
      order: orderResponse,
    } as OrderDetailResponse);
  } catch (error: unknown) {
    console.error("Get order by id error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get order",
    });
  }
};

// AGGIORNA STATUS ORDINE - ADMIN
// PUT /api/admin/orders/:id/status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: UpdateOrderStatusRequest = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // PREPARIAMO I DATI PER L'UPDATE
    const data: Prisma.OrderUpdateInput = {};

    if (updateData.status) data.status = updateData.status;
    if (updateData.paymentStatus) data.paymentStatus = updateData.paymentStatus;
    if (updateData.stripePaymentIntentId)
      data.stripePaymentIntentId = updateData.stripePaymentIntentId;
    if (updateData.paypalOrderId) data.paypalOrderId = updateData.paypalOrderId;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data,
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                fileName: true,
              },
            },
          },
        },
      },
    });

    // CONVERTO LA RESP
    const orderResponse: OrderResponse = {
      id: updatedOrder.id,
      customerEmail: updatedOrder.customerEmail,
      customerFirstName: updatedOrder.customerFirstName,
      customerLastName: updatedOrder.customerLastName,
      total: updatedOrder.total.toNumber(),
      status: updatedOrder.status,
      paymentProvider: updatedOrder.stripePaymentIntentId
        ? "STRIPE"
        : updatedOrder.paypalOrderId
        ? "PAYPAL"
        : null,
      paymentStatus: updatedOrder.paymentStatus,
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,
      orderItems: updatedOrder.orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price.toNumber(),
        productId: item.productId,
        product: item.product,
      })),
      userId: updatedOrder.userId || undefined,
    };

    res.json({
      success: true,
      message: "Order status updated successfully",
      order: orderResponse,
    });
  } catch (error: unknown) {
    console.error("Update order status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};
