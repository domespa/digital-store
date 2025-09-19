import { Router } from "express";
import { CurrencyController } from "../controllers/currencyController";
import { requireAuthenticatedAdmin } from "../middleware/auth";

const router = Router();

// =======================
//       ROUTES
// =======================

// PUBBLICHE
router.get("/convert", CurrencyController.convertPrice);
router.post("/convert-batch", CurrencyController.convertPriceList);
router.get("/supported", CurrencyController.getSupportedCurrencies);
router.get("/format", CurrencyController.formatPrice);

// ADMIN
router.get(
  "/cache-stats",
  requireAuthenticatedAdmin,
  CurrencyController.getCacheStats
);
router.post(
  "/clear-cache",
  requireAuthenticatedAdmin,
  CurrencyController.clearCache
);

export default router;
