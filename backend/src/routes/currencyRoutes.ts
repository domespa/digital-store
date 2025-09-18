import { Router } from "express";
import { CurrencyController } from "../controllers/currencyController";
import { requireAdmin } from "../middleware/auth";

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
router.get("/cache-stats", requireAdmin, CurrencyController.getCacheStats);
router.post("/clear-cache", requireAdmin, CurrencyController.clearCache);

export default router;
