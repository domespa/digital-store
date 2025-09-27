import { Request, Response } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";
import {
  CreateOrderRequest,
  AdminOrderResponse,
  UserOrderResponse,
  OrderListResponse,
  UserOrderListResponse,
  OrderDetailResponse,
  CreateOrderResponse,
  OrderItemData,
  UpdateOrderStatusRequest,
  OrderWithDetails,
  OrderWithAdminDetails,
  OrderWithUserDetails,
  OrderResponse,
} from "../types/order";
import { stripe } from "../services/stripe";
import { paypalService } from "../services/paypal";
import { currencyService } from "../services/currencyService";
import EmailService from "../services/emailService";
import { catchAsync } from "../utils/catchAsync";
import { CustomError } from "../utils/customError";

const prisma = new PrismaClient();
const emailService = new EmailService();

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
          filePath: item.product.filePath,
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
        }
      : null,
  })),
  userId: order.userId || undefined,
});

// ESPORTATA per uso nel PaymentController
export const formatOrderResponse = (
  order: OrderWithDetails,
  isAdmin: boolean = false
): AdminOrderResponse => {
  if (isAdmin) {
    return formatAdminOrderResponse(order as OrderWithAdminDetails);
  }

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
            filePath: isAdmin ? item.product.filePath : null,
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
export const getOrdersAdmin = catchAsync(
  async (req: Request, res: Response) => {
    const search = getStringParam(req.query.search);
    const status = getStringParam(req.query.status);
    const paymentStatus = getStringParam(req.query.paymentStatus);
    const startDate = getStringParam(req.query.startDate);
    const endDate = getStringParam(req.query.endDate);
    const sortBy = getStringParam(req.query.sortBy) || "createdAt";
    const sortOrder = getStringParam(req.query.sortOrder) || "desc";
    const page = getStringParam(req.query.page) || "1";
    const limit = getStringParam(req.query.limit) || "20";

    const validSortFields = ["createdAt", "total", "status"];
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const validSortOrder =
      sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";

    const where: Prisma.OrderWhereInput = {};

    if (search) {
      where.OR = [
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerFirstName: { contains: search, mode: "insensitive" } },
        { customerLastName: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
      ];
    }

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
  }
);

// CREAZIONE ORDINE
// POST /api/orders
export const createOrder = catchAsync(async (req: Request, res: Response) => {
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

  // VALIDAZIONI BASE
  if (!customerEmail || !items || items.length === 0) {
    throw new CustomError("Customer email and items are required", 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail)) {
    throw new CustomError("Invalid email format", 400);
  }

  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      throw new CustomError(
        "Each item must have productId and positive quantity",
        400
      );
    }
  }

  const supportedCurrencies = currencyService
    .getSupportedCurrencies()
    .map((c) => c.code);
  if (!supportedCurrencies.includes(currency)) {
    throw new CustomError(`Currency ${currency} not supported`, 400);
  }

  if (!["STRIPE", "PAYPAL"].includes(paymentProvider)) {
    throw new CustomError("Invalid payment provider", 400);
  }

  // VERIFICA PRODOTTI
  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });

  console.log("🔍 PRODUCTS DEBUG:", {
    requestedProductIds: productIds,
    foundProducts: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price.toNumber(),
      isActive: p.isActive,
    })),
    foundCount: products.length,
    requestedCount: productIds.length,
  });

  if (products.length !== productIds.length) {
    const foundIds = products.map((p) => p.id);
    const missingIds = productIds.filter((id) => !foundIds.includes(id));
    throw new CustomError(`Products not found: ${missingIds.join(", ")}`, 400);
  }

  // CALCOLO TOTALE
  let subtotal = 0;
  const orderItemsData: OrderItemData[] = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    const productPrice = product.price.toNumber();
    const lineTotal = productPrice * item.quantity;

    console.log("💰 LINE CALC:", {
      productId: item.productId,
      productName: product.name,
      productPrice: productPrice,
      quantity: item.quantity,
      lineTotal: lineTotal,
    });
    subtotal += lineTotal;

    orderItemsData.push({
      productId: item.productId,
      quantity: item.quantity,
      price: product.price.toNumber(),
    });
  }

  // GESTIONE SCONTO
  let discount = 0;
  let discountCodeRecord = null;

  if (discountCode) {
    discountCodeRecord = await prisma.discountCode.findFirst({
      where: {
        code: discountCode.trim().toUpperCase(),
        isActive: true,
        OR: [{ validFrom: null }, { validFrom: { lte: new Date() } }],
      },
    });

    if (!discountCodeRecord) {
      throw new CustomError("Invalid or expired discount code", 400);
    }

    if (
      discountCodeRecord.validUntil &&
      discountCodeRecord.validUntil < new Date()
    ) {
      throw new CustomError("Discount code has expired", 400);
    }

    if (
      discountCodeRecord.maxUses &&
      discountCodeRecord.currentUses >= discountCodeRecord.maxUses
    ) {
      throw new CustomError("Discount code usage limit reached", 400);
    }

    if (discountCodeRecord.discountType === "PERCENTAGE") {
      discount = (subtotal * discountCodeRecord.discountValue.toNumber()) / 100;
    } else {
      discount = discountCodeRecord.discountValue.toNumber();
    }

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

  // CONTROLLI MINIMI
  if (paymentProvider === "STRIPE" && displayTotal < 0.5) {
    throw new CustomError("Stripe requires minimum €0.50", 400);
  }
  if (paymentProvider === "PAYPAL" && displayTotal < 1.0) {
    throw new CustomError("PayPal requires minimum €1.00", 400);
  }

  const userId = req.user?.id || null;
  const isAdmin = req.user?.role === "ADMIN";

  // CREAZIONE ORDINE CON INTENT PAGAMENTO
  const result = await prisma.$transaction(async (tx) => {
    let paymentData: {
      stripePaymentIntentId?: string;
      paypalOrderId?: string;
      clientSecret?: string | null;
      approvalUrl?: string | null;
    } = {};

    // CREA INTENT PAGAMENTO (ma non processar automaticamente)
    if (paymentProvider === "STRIPE") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(displayTotal * 100),
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
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

    // CREA ORDINE NEL DATABASE
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

    console.log(`Order created: ${order.id}, Provider: ${paymentProvider}`);

    // AGGIORNA SCONTO
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

  const { order, clientSecret, approvalUrl } = result;
  const orderResponse = formatOrderResponse(order, isAdmin);

  // INVIA EMAIL CONFERMA
  try {
    await emailService.sendOrderConfirmation(orderResponse);
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
});

// LISTA ORDINI UTENTE (INVARIATO)
// GET /api/user/orders
export const getUserOrders = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new CustomError("Authentication required", 401);
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
    prisma.order.count({ where: { userId: req.user.id } }),
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
});

// DETTAGLIO ORDINE (INVARIATO)
// GET /api/orders/:id
export const getOrderById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

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
    throw new CustomError("Order not found", 404);
  }

  const isOrderOwner = req.user && order.userId === req.user.id;

  if (!isOrderOwner && !isAdmin) {
    throw new CustomError("Access denied", 403);
  }

  const orderResponse = formatOrderResponse(order, isAdmin);

  res.json({
    success: true,
    message: "Order retrieved successfully",
    order: orderResponse,
  } as OrderDetailResponse);
});

// AGGIORNA STATUS ORDINE
// PUT /api/admin/orders/:id/status
export const updateOrderStatus = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateOrderStatusRequest = req.body;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new CustomError("Order not found", 404);
    }

    const previousStatus = order.status;

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

    if (updateData.status && updateData.status !== previousStatus) {
      try {
        await emailService.sendOrderStatusUpdate(orderResponse, previousStatus);
        console.log(
          `Order status update email sent for order: ${updatedOrder.id}`
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
  }
);
