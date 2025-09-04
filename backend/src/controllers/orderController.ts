// src/controllers/orderController.ts
import { Request, Response } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";
import {
  CreateOrderRequest,
  AdminOrderResponse,
  UserOrderResponse,
  OrderListResponse,
  UserOrderListResponse,
  OrderDetailResponse,
  UserOrderDetailResponse,
  CreateOrderResponse,
  OrderItemData,
  UpdateOrderStatusRequest,
  OrderWithDetails,
  OrderWithAdminDetails,
  OrderWithUserDetails,
  // Alias per compatibilità
  OrderResponse,
} from "../types/order";
import { stripe } from "../services/stripe";
import { paypalService } from "../services/paypal";
import { currencyService } from "../services/currency";
import {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
} from "../services/emailService";

const prisma = new PrismaClient();

// ============== UTILITY FUNCTIONS ==============

const formatAdminOrderResponse = (
  order: OrderWithAdminDetails
): AdminOrderResponse => ({
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
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          fileName: item.product.fileName,
          filePath: item.product.filePath, // Admin può vedere filePath
        }
      : null,
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
): UserOrderResponse => ({
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
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          fileName: item.product.fileName,
          // NO filePath per sicurezza - utenti normali non devono vedere percorsi
        }
      : null,
  })),
  userId: order.userId || undefined,
});

// Funzione generica che decide il formato basato sul ruolo utente
const formatOrderResponse = (
  order: OrderWithDetails,
  isAdmin: boolean = false
): AdminOrderResponse => {
  if (isAdmin) {
    return formatAdminOrderResponse(order as OrderWithAdminDetails);
  }

  // Per gli utenti normali, nascondi filePath
  return {
    ...formatAdminOrderResponse(order as OrderWithAdminDetails),
    orderItems: order.orderItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price.toNumber(),
      productId: item.productId,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            description: item.product.description,
            fileName: item.product.fileName,
            filePath: isAdmin ? item.product.filePath : null, // Condizionale per sicurezza
          }
        : null,
    })),
  };
};

const getStringParam = (param: unknown): string | undefined => {
  return typeof param === "string" ? param : undefined;
};

// ============== CONTROLLER FUNCTIONS ==============

// LISTA ORDINI - ADMIN
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

    const ordersResponse: AdminOrderResponse[] = orders.map(
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
      paymentProvider = "STRIPE",
      currency = "EUR",
    }: CreateOrderRequest & {
      paymentProvider?: "STRIPE" | "PAYPAL";
      currency?: string;
    } = req.body;

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

    // VALIDAZIONE CURRENCY
    const supportedCurrencies = currencyService
      .getSupportedCurrencies()
      .map((c) => c.code);
    if (!supportedCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: `Currency ${currency} not supported. Supported currencies: ${supportedCurrencies.join(
          ", "
        )}`,
      });
    }

    if (!["STRIPE", "PAYPAL"].includes(paymentProvider)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment provider. Must be STRIPE or PAYPAL",
      });
    }

    // VERIFICA DISPONIBILITÀ DEL PRODOTTO
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

      // CALCOLA LO SCONTO
      if (discountCodeRecord.discountType === "PERCENTAGE") {
        discount =
          (subtotal * discountCodeRecord.discountValue.toNumber()) / 100;
      } else {
        discount = discountCodeRecord.discountValue.toNumber();
      }

      // LO SCONTO NON PUÒ SUPERARE IL TOTALE DELL'ORDINE
      discount = Math.min(discount, subtotal);
    }

    const total = subtotal - discount;

    let displayTotal = total;
    let exchangeRate = 1;

    if (currency !== "EUR") {
      const conversion = await currencyService.convertPrice(
        total,
        "EUR",
        currency
      );
      displayTotal = conversion.convertedAmount;
      exchangeRate = conversion.rate;
    }

    // CONTROLLO AMOUNT MINIMO STRIPE
    if (paymentProvider === "STRIPE" && displayTotal < 0.5) {
      return res.status(400).json({
        success: false,
        message: "Stripe requires minimum €0.50",
      });
    }
    // CONTROLLO AMOUNT MINIMO PAYPAL
    if (paymentProvider === "PAYPAL" && displayTotal < 1.0) {
      return res.status(400).json({
        success: false,
        message: "PayPal requires minimum €1.00",
      });
    }

    // VERIFICA SE L'UTENTE È REGISTRATO
    const userId = req.user?.id || null;
    const isAdmin = req.user?.role === "ADMIN";

    // CREAZIONE ORDINE
    const result = await prisma.$transaction(async (tx) => {
      let paymentData: {
        stripePaymentIntentId?: string;
        paypalOrderId?: string;
        clientSecret?: string | null;
        approvalUrl?: string | null;
      } = {};

      if (paymentProvider === "STRIPE") {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(displayTotal * 100),
          currency: currency.toLowerCase(),
          metadata: {
            customerEmail: customerEmail.toLowerCase(),
            originalAmount: total.toString(),
            exchangeRate: exchangeRate.toString(),
            ...(customerFirstName && { customerFirstName }),
            ...(customerLastName && { customerLastName }),
          },
        });
        paymentData = {
          stripePaymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
        };
      } else if (paymentProvider === "PAYPAL") {
        const paypalOrder = await paypalService.createOrder({
          amount: displayTotal,
          currency: currency,
          orderId: `ORDER-${Date.now()}`,
        });
        paymentData = {
          paypalOrderId: paypalOrder.id,
          approvalUrl: paypalOrder.links?.find((link) => link.rel === "approve")
            ?.href,
        };
      }

      // CREA ORDINE - Solo admin vede filePath
      const order = await tx.order.create({
        data: {
          customerEmail: customerEmail.toLowerCase(),
          customerFirstName: customerFirstName?.trim() || null,
          customerLastName: customerLastName?.trim() || null,
          total: total,
          status: "PENDING",
          paymentStatus: "PENDING",
          currency: currency,
          exchangeRate: exchangeRate,
          originalAmount: currency !== "EUR" ? total : null,
          stripePaymentIntentId: paymentData.stripePaymentIntentId || null,
          paypalOrderId: paymentData.paypalOrderId || null,
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
                  filePath: isAdmin,
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

      console.log(
        `Order created: ${order.id}, Provider: ${paymentProvider}, Currency: ${currency}, Amount: ${displayTotal}, Exchange Rate: ${exchangeRate}`
      );

      // AGGIORNA SCONTO SE PRESENTE
      if (discountCodeRecord) {
        await tx.discountCode.update({
          where: { id: discountCodeRecord.id },
          data: { currentUses: { increment: 1 } },
        });
      }

      return {
        order,
        clientSecret: paymentData.clientSecret,
        approvalUrl: paymentData.approvalUrl,
      };
    });

    // INVIA EMAIL DI CONFERMA
    const { order, clientSecret, approvalUrl } = result;
    const orderResponse = formatOrderResponse(order, isAdmin);

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
      ...(clientSecret && { clientSecret }),
      ...(approvalUrl && { approvalUrl }),
      paymentProvider,
      currency,
      displayTotal,
      exchangeRate,
    } as CreateOrderResponse);
  } catch (error: unknown) {
    console.error("Create order error:", error);

    if (error instanceof Error && error.message.includes("stripe")) {
      return res.status(400).json({
        success: false,
        message: "Payment processing error. Please try again.",
      });
    }

    if (
      error instanceof Error &&
      (error.message.includes("paypal") || error.message.includes("PayPal"))
    ) {
      return res.status(400).json({
        success: false,
        message: "PayPal processing error. Please try again.",
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

    const ordersResponse: UserOrderResponse[] = orders.map(
      formatUserOrderResponse
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
    } as UserOrderListResponse);
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

    // CONTROLLO AUTORIZZAZIONI
    const isOwner = req.user && req.user.id;
    const isAdmin = req.user && req.user.role === "ADMIN";

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
                filePath: isAdmin,
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

    // VERIFICA AUTORIZZAZIONI
    const isOrderOwner = req.user && order.userId === req.user.id;

    if (!isOrderOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const orderResponse = formatOrderResponse(order, isAdmin);

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

    // PREPARA I DATI PER L'UPDATE
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
    });

    const orderResponse = formatOrderResponse(updatedOrder, true);

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
