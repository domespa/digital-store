import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { catchAsync } from "../utils/catchAsync";
import { CustomError } from "../utils/customError";
import { stripe } from "../services/stripe";
import { paypalService } from "../services/paypal";
import EmailService from "../services/emailService";
const emailService = new EmailService();
import { formatOrderResponse } from "../controllers/orderController";

const prisma = new PrismaClient();

export class PaymentController {
  // STRIPE
  // POST /api/payments/webhook/stripe
  static stripeWebhook = catchAsync(async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new CustomError("Stripe webhook secret not configured", 500);
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return res.status(400).json({
        success: false,
        message: "Webhook signature verification failed",
      });
    }

    console.log(`Received Stripe event: ${event.type}`);

    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await PaymentController.handleStripePaymentSucceeded(
            event.data.object
          );
          break;

        case "payment_intent.payment_failed":
          await PaymentController.handleStripePaymentFailed(event.data.object);
          break;

        case "payment_intent.canceled":
          await PaymentController.handleStripePaymentCanceled(
            event.data.object
          );
          break;

        case "charge.dispute.created":
          await PaymentController.handleStripeDispute(event.data.object);
          break;

        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      res.status(500).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  });
  // PAYPAL
  // POST /api/payments/webhook/paypal
  static paypalWebhook = catchAsync(async (req: Request, res: Response) => {
    const event = req.body;

    console.log(`Received PayPal event: ${event.event_type}`);

    try {
      switch (event.event_type) {
        case "CHECKOUT.ORDER.APPROVED":
          await PaymentController.handlePayPalOrderApproved(event.resource);
          break;

        case "PAYMENT.CAPTURE.COMPLETED":
          await PaymentController.handlePayPalCaptureCompleted(event.resource);
          break;

        case "PAYMENT.CAPTURE.DENIED":
          await PaymentController.handlePayPalCaptureFailed(event.resource);
          break;

        default:
          console.log(`Unhandled PayPal event type: ${event.event_type}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error processing PayPal webhook:", error);
      res.status(500).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  });
  // PRENDI PAGAMENTO
  // POST /api/payments/capture/:orderId
  static capturePayPalPayment = catchAsync(
    async (req: Request, res: Response) => {
      const { orderId } = req.params;

      // VALIDAZIONE
      if (!orderId || !/^[a-zA-Z0-9-]+$/.test(orderId)) {
        throw new CustomError("Invalid order ID format", 400);
      }

      // TROVA ORDINE
      const order = await prisma.order.findUnique({
        where: { id: orderId },
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

      if (!order) {
        throw new CustomError("Order not found", 404);
      }

      if (!order.paypalOrderId) {
        throw new CustomError("No PayPal order ID found", 400);
      }

      if (order.paymentStatus === "SUCCEEDED") {
        return res.json({
          success: true,
          message: "Payment already captured",
          order: formatOrderResponse(order, req.user?.role === "ADMIN"),
        });
      }

      try {
        // CATTURA PAYPAL
        const captureResult = await paypalService.captureOrder(
          order.paypalOrderId
        );

        if (captureResult.status === "COMPLETED") {
          // INVIALO AL DB
          const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              paymentStatus: "SUCCEEDED",
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
                      filePath: req.user?.role === "ADMIN",
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

          const orderResponse = formatOrderResponse(
            updatedOrder,
            req.user?.role === "ADMIN"
          );

          // INVIO EMAIL DI CONFERMA
          try {
            await emailService.sendOrderStatusUpdate(orderResponse, "PENDING");
            console.log(
              `Payment confirmation email sent for order: ${orderId}`
            );
          } catch (emailError) {
            console.error(
              "Failed to send payment confirmation email:",
              emailError
            );
          }

          res.json({
            success: true,
            message: "Payment captured successfully",
            order: orderResponse,
          });
        } else {
          throw new CustomError("Payment capture failed", 400);
        }
      } catch (error) {
        console.error("PayPal capture error:", error);

        // ORDINE NON ANDATO A BUONFINE
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "FAILED",
            paymentStatus: "FAILED",
          },
        });

        throw new CustomError("Payment capture failed", 400);
      }
    }
  );
  // RIMBORSO
  // POST /api/payments/refund/:orderId
  static refundPayment = catchAsync(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { amount, reason } = req.body;

    // SOLO IO
    if (req.user?.role !== "ADMIN") {
      throw new CustomError("Admin access required", 403);
    }

    if (!orderId || !/^[a-zA-Z0-9-]+$/.test(orderId)) {
      throw new CustomError("Invalid order ID format", 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
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

    if (!order) {
      throw new CustomError("Order not found", 404);
    }

    if (order.paymentStatus !== "SUCCEEDED") {
      throw new CustomError("Order payment not successful, cannot refund", 400);
    }

    if (order.status === "REFUNDED") {
      throw new CustomError("Order already refunded", 400);
    }

    const refundAmount = amount || order.total.toNumber();

    try {
      let refundResult;

      if (order.stripePaymentIntentId) {
        // RIMBORSO VIA STRIPE
        refundResult = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: Math.round(refundAmount * 100),
          reason: reason || "requested_by_customer",
          metadata: {
            orderId: order.id,
            adminId: req.user.id,
          },
        });

        console.log(`Stripe refund created: ${refundResult.id}`);
      } else if (order.paypalOrderId) {
        // Per PayPal, dovresti implementare l'API dei rimborsi
        // Qui un esempio semplificato
        console.log(
          `PayPal refund requested for order: ${order.paypalOrderId}`
        );
        // TODO: Implementare PayPal refund API
        throw new CustomError("PayPal refunds not yet implemented", 501);
      } else {
        throw new CustomError("No payment method found for refund", 400);
      }

      // AGGIORNA ORDINE
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "REFUNDED",
          paymentStatus: "REFUNDED",
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

      // INVIA EMAIL DI RIMBORSO
      try {
        await emailService.sendOrderStatusUpdate(orderResponse, "PAID");
        console.log(`Refund notification email sent for order: ${orderId}`);
      } catch (emailError) {
        console.error("Failed to send refund notification email:", emailError);
      }

      res.json({
        success: true,
        message: "Refund processed successfully",
        order: orderResponse,
        refundAmount,
        refundId: refundResult?.id,
      });
    } catch (error) {
      console.error("Refund error:", error);
      throw new CustomError("Refund processing failed", 500);
    }
  });
  // STATO PAGAMENTO
  // GET /api/payments/status/:orderId
  static getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
    const { orderId } = req.params;

    if (!orderId || !/^[a-zA-Z0-9-]+$/.test(orderId)) {
      throw new CustomError("Invalid order ID format", 400);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        stripePaymentIntentId: true,
        paypalOrderId: true,
        total: true,
        currency: true,
        userId: true,
      },
    });

    if (!order) {
      throw new CustomError("Order not found", 404);
    }
    const isOwner = req.user && order.userId === req.user.id;
    const isAdmin = req.user && req.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new CustomError("Access denied", 403);
    }

    let externalStatus = null;

    try {
      if (order.stripePaymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          order.stripePaymentIntentId
        );
        externalStatus = {
          provider: "STRIPE",
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
        };
      } else if (order.paypalOrderId) {
        const paypalOrder = await paypalService.getOrderDetails(
          order.paypalOrderId
        );
        externalStatus = {
          provider: "PAYPAL",
          status: paypalOrder.status,
          amount: order.total.toNumber(),
          currency: order.currency,
        };
      }
    } catch (error) {
      console.error("Error fetching external payment status:", error);
    }

    res.json({
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total.toNumber(),
        currency: order.currency,
        externalStatus,
      },
    });
  });

  // ============== HANDLER PRIVATI ==============

  private static async handleStripePaymentSucceeded(paymentIntent: any) {
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
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

    if (!order) {
      console.error(`Order not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    if (order.paymentStatus === "SUCCEEDED") {
      console.log(`Payment already processed for order: ${order.id}`);
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "SUCCEEDED",
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

    try {
      await emailService.sendOrderStatusUpdate(orderResponse, "PENDING");
      console.log(`Payment success email sent for order: ${order.id}`);
    } catch (emailError) {
      console.error("Failed to send payment success email:", emailError);
    }

    console.log(`Payment succeeded for order: ${order.id}`);
  }

  private static async handleStripePaymentFailed(paymentIntent: any) {
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!order) {
      console.error(`Order not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        paymentStatus: "FAILED",
      },
    });

    console.log(`Payment failed for order: ${order.id}`);
  }

  private static async handleStripePaymentCanceled(paymentIntent: any) {
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!order) {
      console.error(`Order not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        paymentStatus: "FAILED",
      },
    });

    console.log(`Payment canceled for order: ${order.id}`);
  }

  private static async handleStripeDispute(charge: any) {
    console.log(`Dispute created for charge: ${charge.id}`);
    // TODO: Implementare gestione dispute
    // Potresti voler bloccare l'accesso ai file o notificare gli admin
  }

  private static async handlePayPalOrderApproved(resource: any) {
    console.log(`PayPal order approved: ${resource.id}`);
    // L'ordine è stato approvato ma non ancora catturato
    // Non aggiorniamo lo stato qui, aspettiamo la cattura
  }

  private static async handlePayPalCaptureCompleted(resource: any) {
    // Trova l'ordine tramite PayPal order ID
    const order = await prisma.order.findFirst({
      where: { paypalOrderId: resource.id },
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

    if (!order) {
      console.error(`Order not found for PayPal order: ${resource.id}`);
      return;
    }

    if (order.paymentStatus === "SUCCEEDED") {
      console.log(`Payment already processed for order: ${order.id}`);
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "SUCCEEDED",
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

    try {
      await emailService.sendOrderStatusUpdate(orderResponse, "PENDING");
      console.log(`PayPal payment success email sent for order: ${order.id}`);
    } catch (emailError) {
      console.error("Failed to send PayPal payment success email:", emailError);
    }

    console.log(`PayPal payment completed for order: ${order.id}`);
  }

  private static async handlePayPalCaptureFailed(resource: any) {
    const order = await prisma.order.findFirst({
      where: { paypalOrderId: resource.id },
    });

    if (!order) {
      console.error(`Order not found for PayPal order: ${resource.id}`);
      return;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        paymentStatus: "FAILED",
      },
    });

    console.log(`PayPal payment failed for order: ${order.id}`);
  }
}
