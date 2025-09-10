import { Router } from "express";
import { SearchController } from "../controllers/searchController";
import { optionalAuth } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();

// ==================== RATE LIMITING ====================

const searchRateLimit = {
  // RICERCHE STANDARD (100 per 15 min)
  standard: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 100,
    message: {
      success: false,
      error: "Troppe ricerche. Riprova tra 15 minuti.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // AUTOCOMPLETE (300 per 15 min - più permissivo)
  autocomplete: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 300,
    message: {
      success: false,
      error: "Troppe richieste autocomplete. Riprova tra 15 minuti.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // RICERCHE ADVANCED (30 per ora - più rigoroso)
  advanced: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 30,
    message: {
      success: false,
      error: "Troppe ricerche avanzate. Riprova tra un'ora.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

// ==================== ROUTE PUBBLICHE ====================

// RICERCA GENERALE PRODOTTI
// GET /api/search?q=query&category=slug&minPrice=10&maxPrice=100...
router.get(
  "/",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.searchProducts
);

// RICERCA RAPIDA FULL-TEXT
// GET /api/search/quick?q=query&limit=10
router.get(
  "/quick",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.quickSearch
);

// AUTOCOMPLETE / SUGGERIMENTI
// GET /api/search/suggestions?q=partial_query&limit=8
router.get(
  "/suggestions",
  optionalAuth,
  searchRateLimit.autocomplete,
  SearchController.getAutocompleteSuggestions
);

// RICERCA PER CATEGORIA
// GET /api/search/category/:categorySlug
router.get(
  "/category/:categorySlug",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.searchByCategory
);

// PRODOTTI SIMILI
// GET /api/search/similar/:productId?limit=6
router.get(
  "/similar/:productId",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.findSimilarProducts
);

// PRODOTTI POPOLARI
// GET /api/search/popular?category=slug&limit=20
router.get(
  "/popular",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.getPopularProducts
);

// RICERCA AVANZATA CON TUTTI I FILTRI
// POST /api/search/advanced
router.post(
  "/advanced",
  optionalAuth,
  searchRateLimit.advanced,
  SearchController.advancedSearch
);

// RICERCA PER RANGE PREZZO
// GET /api/search/price-range?min=10&max=100&category=slug
router.get(
  "/price-range",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.searchByPriceRange
);

// RICERCA PER RATING
// GET /api/search/by-rating?minRating=4&category=slug
router.get(
  "/by-rating",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.searchByRating
);

// PRODOTTI IN OFFERTA
// GET /api/search/on-sale?category=slug&page=1&limit=20
router.get(
  "/on-sale",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.getProductsOnSale
);

// PRODOTTI DIGITALI
// GET /api/search/digital?q=query&category=slug
router.get(
  "/digital",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.searchDigitalProducts
);

// PRODOTTI FEATURED
// GET /api/search/featured?category=slug&page=1&limit=20
router.get(
  "/featured",
  optionalAuth,
  searchRateLimit.standard,
  SearchController.getFeaturedProducts
);

// ==================== HEALTH CHECK ====================

// HEALTH CHECK SEARCH SYSTEM
// GET /api/search/health
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Search system operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      public: [
        "GET /search (general search)",
        "GET /search/quick (full-text search)",
        "GET /search/suggestions (autocomplete)",
        "GET /search/category/:categorySlug",
        "GET /search/similar/:productId",
        "GET /search/popular",
        "POST /search/advanced",
        "GET /search/price-range",
        "GET /search/by-rating",
        "GET /search/on-sale",
        "GET /search/digital",
        "GET /search/featured",
      ],
    },
    rateLimits: {
      standard: "100 per 15 minutes",
      autocomplete: "300 per 15 minutes",
      advanced: "30 per hour",
    },
    features: [
      "Full-text search with relevance scoring",
      "Advanced filtering (price, rating, category, etc.)",
      "Autocomplete suggestions",
      "Similar products recommendation",
      "Popular products discovery",
      "On-sale products filtering",
      "Digital products filtering",
      "Featured products",
      "Search analytics tracking",
      "Faceted search results",
    ],
  });
});

export default router;
