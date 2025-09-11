import { Router, Request, Response, NextFunction } from "express";
import RecommendationController from "../controllers/recommandationController";
import { authenticateToken } from "../middleware/auth";
import {
  handleValidationErrors,
  idValidation,
  paginationValidation,
} from "../middleware/validation";
import {
  generalLimiter,
  authLimiter,
  orderLimiter,
} from "../middleware/rateLimiting";
import RecommendationService from "../services/recommendationService";
import { param, query } from "express-validator";

// ===========================================
//              ROUTE SETUP
// ===========================================

const router = Router();

// ===========================================
//              VALIDATION HELPERS
// ===========================================

// Validazione per productId parameter
const productIdValidation = [idValidation("productId"), handleValidationErrors];

// Validazione per query parameters delle recommendations
const recommendationQueryValidation = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Limit must be between 1 and 20"),
  query("excludeOwned")
    .optional()
    .isBoolean()
    .withMessage("excludeOwned must be a boolean"),
  query("categoryId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid category ID format"),
  handleValidationErrors,
];

// Validazione per trending products
const trendingQueryValidation = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
  query("categoryId")
    .optional()
    .matches(/^c[a-zA-Z0-9]{24}$/)
    .withMessage("Invalid category ID format"),
  query("period")
    .optional()
    .isIn(["week", "month", "quarter"])
    .withMessage("Period must be week, month, or quarter"),
  handleValidationErrors,
];

// Validazione per similar products
const similarProductsValidation = [
  idValidation("productId"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Limit must be between 1 and 20"),
  handleValidationErrors,
];

// Validazione per frequently bought together
const frequentlyBoughtValidation = [
  idValidation("productId"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage("Limit must be between 1 and 10"),
  handleValidationErrors,
];

// Validazione per bulk requests
const bulkValidation = [
  param("productIds").custom((value) => {
    const ids = value.split(",");
    if (ids.length === 0 || ids.length > 5) {
      throw new Error("Must provide 1-5 product IDs separated by commas");
    }
    for (const id of ids) {
      if (!/^c[a-zA-Z0-9]{24}$/.test(id.trim())) {
        throw new Error("Invalid product ID format in list");
      }
    }
    return true;
  }),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage("Limit must be between 1 and 10"),
  query("type")
    .optional()
    .isIn(["similar", "frequently-bought"])
    .withMessage("Type must be similar or frequently-bought"),
  handleValidationErrors,
];

// ===========================================
//              AUTHENTICATED ROUTES
// ===========================================

// GET /api/recommendations/user
// Raccomandazioni personalizzate (richiede autenticazione)
router.get(
  "/user",
  authLimiter, // Rate limiting per utenti autenticati
  authenticateToken, // Middleware di autenticazione obbligatorio
  recommendationQueryValidation,
  RecommendationController.getUserRecommendations
);

// GET /api/recommendations/user/category/:categoryId
// Raccomandazioni per categoria specifica (utenti autenticati)
router.get(
  "/user/category/:categoryId",
  authLimiter,
  authenticateToken,
  [
    idValidation("categoryId"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage("Limit must be between 1 and 30"),
    query("excludeOwned")
      .optional()
      .isBoolean()
      .withMessage("excludeOwned must be a boolean"),
    handleValidationErrors,
  ],
  async (req: Request, res: Response): Promise<void> => {
    // Redirect interno modificando i query params
    req.query.categoryId = req.params.categoryId;
    return RecommendationController.getUserRecommendations(req as any, res);
  }
);

// ===========================================
//              PUBLIC ROUTES
// ===========================================

// GET /api/recommendations/similar/:productId
// Prodotti simili (pubblico con rate limiting)
router.get(
  "/similar/:productId",
  generalLimiter, // Rate limiting generale per ospiti
  similarProductsValidation,
  RecommendationController.getSimilarProducts
);

// GET /api/recommendations/trending
// Prodotti trending (pubblico)
router.get(
  "/trending",
  generalLimiter,
  trendingQueryValidation,
  RecommendationController.getTrendingProducts
);

// GET /api/recommendations/frequently-bought-together/:productId
// Prodotti frequentemente acquistati insieme (pubblico)
router.get(
  "/frequently-bought-together/:productId",
  generalLimiter,
  frequentlyBoughtValidation,
  RecommendationController.getFrequentlyBoughtTogether
);

// GET /api/recommendations/bulk/:productIds
// Raccomandazioni per multipli prodotti (batch processing)
router.get(
  "/bulk/:productIds",
  orderLimiter, // Rate limiting più restrittivo per bulk operations
  bulkValidation,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const productIds = req.params.productIds.split(",").slice(0, 5); // Max 5 prodotti
      const limit = parseInt(req.query.limit as string) || 4;
      const type = (req.query.type as string) || "similar";

      const results = await Promise.all(
        productIds.map(async (productId) => {
          try {
            const trimmedId = productId.trim();
            if (type === "similar") {
              return await RecommendationService.getSimilarProducts(
                trimmedId,
                limit
              );
            } else {
              return await RecommendationService.getFrequentlyBoughtTogether(
                trimmedId,
                limit
              );
            }
          } catch (error) {
            console.error(
              `Error getting recommendations for product ${productId}:`,
              error
            );
            return [];
          }
        })
      );

      const response = {
        success: true,
        message: "Bulk recommendations retrieved successfully",
        results: productIds.map((productId, index) => ({
          productId: productId.trim(),
          recommendations: results[index],
          total: results[index].length,
        })),
        total: results.reduce((sum, recs) => sum + recs.length, 0),
        metadata: {
          requestedProducts: productIds.length,
          type,
          limit,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in bulk recommendations:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve bulk recommendations",
        error: error instanceof Error ? error.message : "Unknown error",
        code: "BULK_001",
      });
    }
  }
);

// ===========================================
//              UTILITY ROUTES
// ===========================================

// GET /api/recommendations/health
// Health check (nessun rate limiting)
router.get("/health", RecommendationController.healthCheck);

// ===========================================
//              ERROR HANDLING
// ===========================================

// Catch-all per rotte non trovate
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Recommendation endpoint not found",
    error: `Route ${req.originalUrl} does not exist`,
    code: "NOT_FOUND_001",
    availableEndpoints: [
      "GET /api/recommendations/user",
      "GET /api/recommendations/similar/:productId",
      "GET /api/recommendations/trending",
      "GET /api/recommendations/frequently-bought-together/:productId",
      "GET /api/recommendations/health",
      "GET /api/recommendations/user/category/:categoryId",
      "GET /api/recommendations/bulk/:productIds",
    ],
  });
});

// Error handler specifico per questo router
router.use((error: Error, req: any, res: any, next: any) => {
  console.error("Recommendation route error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error in recommendation system",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
    code: "ROUTE_ERROR_001",
  });
});

export default router;
