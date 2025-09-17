import { Router } from "express";
import {
  getProducts,
  getProductById,
  convertProductPrice,
} from "../controllers/productController";
import { CurrencyService, currencyService } from "../services/currency";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// MIDDLEWARE PER TROVARE CURRENCY
router.use((req, res, next) => {
  let currency = req.query.currency as string;

  if (!currency) {
    const acceptLanguage = req.headers["accept-language"];
    const country = req.headers["cf-ipcountry"] as string;

    if (country) {
      currency = CurrencyService.detectCurrencyFromCountry(country);
    } else if (acceptLanguage) {
      const locale = acceptLanguage.split(",")[0];
      const countryCode = locale.split("-")[1];
      if (countryCode) {
        currency = CurrencyService.detectCurrencyFromCountry(
          countryCode.toUpperCase()
        );
      }
    }
  }

  req.currency = currency || "EUR";
  next();
});

// LISTA PRODOTTI PUBBLICI
// GET /api/products?currency=USD&country=US
router.get("/", optionalAuth, getProducts);

// DETTAGLIO PRODOTTO
// /api/products/:id?currency=USD
router.get("/:id", optionalAuth, getProductById);

// VALURE SUPPORTATE
// GET /api/products/currencies
router.get("/meta/currencies", (req, res) => {
  try {
    const currencies = currencyService.getSupportedCurrencies();
    const cacheStats = currencyService.getCacheStats();

    res.json({
      success: true,
      data: {
        supported: currencies,
        default: "EUR",
        cache: cacheStats,
      },
    });
  } catch (error) {
    console.error("Currency meta error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch currency info",
    });
  }
});

export default router;
