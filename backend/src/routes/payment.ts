import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

// WEBHOK
router.post("/webhook/stripe", PaymentController.stripeWebhook);
router.post("/webhook/paypal", PaymentController.paypalWebhook);

// OPERAZIONI UTENTI
router.post(
  "/capture/:orderId",
  authenticateToken,
  PaymentController.capturePayPalPayment
);
router.get(
  "/status/:orderId",
  authenticateToken,
  PaymentController.getPaymentStatus
);

// OPERAZIONI ADMIN
router.post("/refund/:orderId", requireAdmin, PaymentController.refundPayment);

export default router;
