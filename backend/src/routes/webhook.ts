import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { stripe } from "../services/stripe";
import Stripe from "stripe";
import { prisma } from "../utils/prisma";

const router = express.Router();

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err: unknown) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send("Webhook signature verification failed");
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          await prisma.order.updateMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            data: {
              paymentStatus: "SUCCEEDED",
              status: "PAID",
            },
          });

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
            },
          });

          if (order) {
            const EmailService = (await import("../services/emailService"))
              .default;
            const emailService = new EmailService();

            await emailService.sendOrderStatusUpdate(
              {
                id: order.id,
                customerEmail: order.customerEmail,
                customerFirstName: order.customerFirstName,
                customerLastName: order.customerLastName,
                total: order.total.toNumber(),
                status: order.status,
                paymentStatus: order.paymentStatus,
                paymentProvider: "STRIPE",
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                orderItems: order.orderItems.map((item) => ({
                  id: item.id,
                  quantity: item.quantity,
                  price: item.price.toNumber(),
                  productId: item.productId || "",
                  product: item.product
                    ? {
                        id: item.product.id,
                        name: item.product.name,
                        description: item.product.description || "",
                        fileName: item.product.fileName || "",
                        filePath: item.product.filePath || null,
                      }
                    : null,
                })),
              },
              "PENDING"
            );
            console.log(`Payment success email sent for order: ${order.id}`);
          }

          console.log(
            `Payment succeeded for PaymentIntent: ${paymentIntent.id}`
          );
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          await prisma.order.updateMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            data: {
              paymentStatus: "FAILED",
              status: "FAILED",
            },
          });

          console.log(`Payment failed for PaymentIntent: ${paymentIntent.id}`);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
      return res.status(500).send("Webhook processing failed");
    }

    res.status(200).send("Webhook processed successfully");
  }
);

export default router;
