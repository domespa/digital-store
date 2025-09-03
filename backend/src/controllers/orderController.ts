import { Request, Response } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";
import {
  CreateOrderRequest,
  OrderResponse,
  OrderListResponse,
  OrderDetailResponse,
  CreateOrderResponse,
  OrderItemData,
  UpdateOrderStatusRequest,
  OrderWithDetails,
  OrderWithAdminDetails,
  OrderWithUserDetails,
} from "../types/order";
import { stripe } from "../services/stripe";
import {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
} from "../services/emailService";

const prisma = new PrismaClient();

// UTILITY CONV TO RESP
const formatAdminOrderResponse = (
  order: OrderWithAdminDetails
): OrderResponse => ({
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
  user: order.user
    ? {
        id: order.user.id,
        firstName: order.user.firstName,
        lastName: order.user.lastName,
        email: order.user.email,
      }
    : undefined,
});

const formatUserOrderResponse = (
  order: OrderWithUserDetails
): OrderResponse => ({
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
});

const formatOrderResponse = (order: OrderWithDetails): OrderResponse => ({
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
  user: order.user
    ? {
        id: order.user.id,
        firstName: order.user.firstName,
        lastName: order.user.lastName,
        email: order.user.email,
      }
    : undefined,
});

const getStringParam = (param: unknown): string | undefined => {
  return typeof param === "string" ? param : undefined;
};

// LISTA ORDINI  - ADMIN
// GET /api/admin/orders
export const getOrdersAdmin = async (req: Request, res: Response) => {
  try {
    const search = getStringParam(req.query.search);
    const status = getStringParam(req.query.status);
    const paymentStatus = getStringParam(req.query.paymentStatus);
    const startDate = getStringParam(req.query.startDate);
    const endDate = getStringParam(req.query.endDate);
    const sortBy = getStringParam(req.query.sortBy) || "createdAt";
    const sortOrder = getStringParam(req.query.sortOrder) || "desc";
    const page = getStringParam(req.query.page) || "1";
    const limit = getStringParam(req.query.limit) || "20";

    // VALIDAZIONI PARAMETRI
    const validSortFields = ["createdAt", "total", "status"];
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const validSortOrder =
      sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";

    // FILTRI
    const where: Prisma.OrderWhereInput = {};

    // RICERCA
    if (search) {
      where.OR = [
        {
          customerEmail: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerFirstName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customerLastName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          id: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    // FILTRI CON TIPI
    if (status) {
      where.status = status as Prisma.EnumOrderStatusFilter;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus as Prisma.EnumPaymentStatusFilter;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    // PAGINAZIONE
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  fileName: true,
                  filePath: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { [validSortBy]: validSortOrder },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    // USA LA FUNZIONE UTILITY
    const ordersResponse: OrderResponse[] = orders.map(
      formatAdminOrderResponse
    );

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
    console.error("Get admin orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get orders",
    });
  }
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

    // CONTROLLO AMOUNT MINIMO STRIPE
    if (total < 0.5) {
      return res.status(400).json({
        success: false,
        message: "Order total must be at least €0.50",
      });
    }

    // VERIFICHIAMO SE L'UTENTE è REGISTRATO
    const userId = req.user?.id || null;

    // CREAZIONE ORDINE
    const result = await prisma.$transaction(async (tx) => {
      // PAYMENT INTENT STRIPE
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: "eur",
        metadata: {
          customerEmail: customerEmail.toLowerCase(),
          ...(customerFirstName && { customerFirstName }),
          ...(customerLastName && { customerLastName }),
        },
      });
      // CREA ORDINE
      const order = await tx.order.create({
        data: {
          customerEmail: customerEmail.toLowerCase(),
          customerFirstName: customerFirstName?.trim() || null,
          customerLastName: customerLastName?.trim() || null,
          total: total,
          status: "PENDING",
          paymentStatus: "PENDING",
          stripePaymentIntentId: paymentIntent.id,
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

      return { order, clientSecret: paymentIntent.client_secret };
    });

    // INVIA EMAIL DI CONFERMA
    const { order, clientSecret } = result;
    const orderResponse = formatOrderResponse(order);

    try {
      await sendOrderConfirmation(orderResponse);
      console.log(`Order confirmation email sent for order: ${order.id}`);
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: orderResponse,
      clientSecret,
    } as CreateOrderResponse);
  } catch (error: unknown) {
    console.error("Create order error:", error);

    if (error instanceof Error && error.message.includes("stripe")) {
      return res.status(400).json({
        success: false,
        message: "Payment processing error. Please try again.",
      });
    }

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

    const ordersResponse: OrderResponse[] = orders.map(formatUserOrderResponse);

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
            email: true,
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

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const orderResponse = formatOrderResponse(order);

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

    const previousStatus = order.status;

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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const orderResponse = formatOrderResponse(updatedOrder);

    // INVIA EMAIL SE STATUS CAMBIATO
    if (updateData.status && updateData.status !== previousStatus) {
      try {
        await sendOrderStatusUpdate(orderResponse, previousStatus);
        console.log(
          `Order status update email sent for order: ${updatedOrder.id} (${previousStatus} → ${updateData.status})`
        );
      } catch (emailError) {
        console.error("Failed to send order status update email:", emailError);
      }
    }

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
