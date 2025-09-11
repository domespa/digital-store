import { Request, Response } from "express";
import { z } from "zod";
import RecommendationService from "../services/recommendationService";
import {
  RecommendationResponse,
  SimilarProductsResponse,
  TrendingProductsResponse,
  FrequentlyBoughtTogetherResponse,
  RecommendationError,
} from "../types/recommendations";
import { UserProfile } from "../types/auth";

// ===========================================
//              VALIDATION SCHEMAS
// ===========================================

// Schema per validazione query parameters
const getUserRecommendationsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  excludeOwned: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  categoryId: z.string().optional(),
});

const getSimilarProductsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});

const getTrendingProductsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  categoryId: z.string().optional(),
  period: z.enum(["week", "month", "quarter"]).optional(),
});

const getFrequentlyBoughtTogetherSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});

// Schema per validazione parametri URL
const productIdParamSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

// ===========================================
//           AUTHENTICATED USER TYPE
// ===========================================

// Estendi Request per includere user autenticato (usa il tipo esistente)
interface AuthenticatedRequest extends Request {
  user?: (UserProfile & { emailVerified: boolean }) | undefined;
}

// ===========================================
//              CONTROLLER CLASS
// ===========================================

class RecommendationController {
  // ===========================================
  //            USER RECOMMENDATIONS
  // ===========================================

  // GET /api/recommendations/user
  // Raccomandazioni personalizzate per utente autenticato
  async getUserRecommendations(req: Request, res: Response): Promise<void> {
    try {
      // Verifica autenticazione
      if (!req.user?.id) {
        const error: RecommendationError = {
          success: false,
          message: "Authentication required for personalized recommendations",
          error: "UNAUTHORIZED",
          code: "AUTH_001",
        };
        res.status(401).json(error);
        return;
      }

      // Valida query parameters
      const validationResult = getUserRecommendationsSchema.safeParse(
        req.query
      );
      if (!validationResult.success) {
        const error: RecommendationError = {
          success: false,
          message: "Invalid query parameters",
          error: validationResult.error.message,
          code: "VALIDATION_001",
        };
        res.status(400).json(error);
        return;
      }

      const { limit, excludeOwned, categoryId } = validationResult.data;

      // Ottieni raccomandazioni dal service
      const recommendations =
        await RecommendationService.getUserRecommendations(
          req.user.id,
          limit,
          excludeOwned
        );

      // Prepara response
      const response: RecommendationResponse = {
        success: true,
        message: "User recommendations retrieved successfully",
        recommendations,
        total: recommendations.length,
        algorithm: "hybrid",
        metadata: {
          userId: req.user.id,
          limit: limit || 10,
          categoryId,
          reason:
            recommendations.length === 0
              ? "no_recommendations_found"
              : "success",
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in getUserRecommendations controller:", error);

      const errorResponse: RecommendationError = {
        success: false,
        message: "Failed to retrieve user recommendations",
        error: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_001",
      };

      res.status(500).json(errorResponse);
    }
  }

  // ===========================================
  //            SIMILAR PRODUCTS
  // ===========================================

  // GET /api/recommendations/similar/:productId
  // Prodotti simili per pagina prodotto
  async getSimilarProducts(req: Request, res: Response): Promise<void> {
    try {
      // Valida parametri URL
      const paramValidation = productIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const error: RecommendationError = {
          success: false,
          message: "Invalid product ID parameter",
          error: paramValidation.error.message,
          code: "VALIDATION_002",
        };
        res.status(400).json(error);
        return;
      }

      // Valida query parameters
      const queryValidation = getSimilarProductsSchema.safeParse(req.query);
      if (!queryValidation.success) {
        const error: RecommendationError = {
          success: false,
          message: "Invalid query parameters",
          error: queryValidation.error.message,
          code: "VALIDATION_003",
        };
        res.status(400).json(error);
        return;
      }

      const { productId } = paramValidation.data;
      const { limit } = queryValidation.data;

      // Ottieni prodotti simili dal service
      const similarProducts = await RecommendationService.getSimilarProducts(
        productId,
        limit
      );

      // Prepara response con informazioni sul prodotto target
      const response: SimilarProductsResponse = {
        success: true,
        message: "Similar products retrieved successfully",
        targetProduct: {
          id: productId,
          name: "Target Product", // Potresti voler recuperare il nome reale
          category: undefined, // Potresti voler recuperare la categoria reale
        },
        similarProducts,
        total: similarProducts.length,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in getSimilarProducts controller:", error);

      const errorResponse: RecommendationError = {
        success: false,
        message: "Failed to retrieve similar products",
        error: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_002",
      };

      res.status(500).json(errorResponse);
    }
  }

  // ===========================================
  //            TRENDING PRODUCTS
  // ===========================================

  // GET /api/recommendations/trending
  // Prodotti trending/popolari
  async getTrendingProducts(req: Request, res: Response): Promise<void> {
    try {
      // Valida query parameters
      const validationResult = getTrendingProductsSchema.safeParse(req.query);
      if (!validationResult.success) {
        const error: RecommendationError = {
          success: false,
          message: "Invalid query parameters",
          error: validationResult.error.message,
          code: "VALIDATION_004",
        };
        res.status(400).json(error);
        return;
      }

      const { limit, categoryId, period } = validationResult.data;

      // Ottieni prodotti trending dal service
      const trendingProducts = await RecommendationService.getTrendingProducts(
        categoryId,
        limit
      );

      // Prepara response
      const response: TrendingProductsResponse = {
        success: true,
        message: "Trending products retrieved successfully",
        trendingProducts,
        total: trendingProducts.length,
        period: period || "month",
        categoryId,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in getTrendingProducts controller:", error);

      const errorResponse: RecommendationError = {
        success: false,
        message: "Failed to retrieve trending products",
        error: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_003",
      };

      res.status(500).json(errorResponse);
    }
  }

  // ===========================================
  //        FREQUENTLY BOUGHT TOGETHER
  // ===========================================

  // GET /api/recommendations/frequently-bought-together/:productId
  // Prodotti spesso acquistati insieme
  async getFrequentlyBoughtTogether(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // Valida parametri URL
      const paramValidation = productIdParamSchema.safeParse(req.params);
      if (!paramValidation.success) {
        const error: RecommendationError = {
          success: false,
          message: "Invalid product ID parameter",
          error: paramValidation.error.message,
          code: "VALIDATION_005",
        };
        res.status(400).json(error);
        return;
      }

      // Valida query parameters
      const queryValidation = getFrequentlyBoughtTogetherSchema.safeParse(
        req.query
      );
      if (!queryValidation.success) {
        const error: RecommendationError = {
          success: false,
          message: "Invalid query parameters",
          error: queryValidation.error.message,
          code: "VALIDATION_006",
        };
        res.status(400).json(error);
        return;
      }

      const { productId } = paramValidation.data;
      const { limit } = queryValidation.data;

      // Ottieni prodotti frequentemente acquistati insieme dal service
      const frequentlyBoughtTogether =
        await RecommendationService.getFrequentlyBoughtTogether(
          productId,
          limit
        );

      // Prepara response
      const response: FrequentlyBoughtTogetherResponse = {
        success: true,
        message: "Frequently bought together products retrieved successfully",
        targetProduct: {
          id: productId,
          name: "Target Product", // Potresti voler recuperare il nome reale
        },
        frequentlyBoughtTogether,
        total: frequentlyBoughtTogether.length,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in getFrequentlyBoughtTogether controller:", error);

      const errorResponse: RecommendationError = {
        success: false,
        message: "Failed to retrieve frequently bought together products",
        error: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_004",
      };

      res.status(500).json(errorResponse);
    }
  }

  // ===========================================
  //            HEALTH CHECK
  // ===========================================

  // GET /api/recommendations/health
  // Health check per il recommendation system
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const response = {
        success: true,
        message: "Recommendation system is healthy",
        timestamp: new Date().toISOString(),
        service: "RecommendationService",
        version: "1.0.0",
        endpoints: {
          userRecommendations: "/api/recommendations/user",
          similarProducts: "/api/recommendations/similar/:productId",
          trendingProducts: "/api/recommendations/trending",
          frequentlyBoughtTogether:
            "/api/recommendations/frequently-bought-together/:productId",
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error("Error in recommendation health check:", error);

      const errorResponse: RecommendationError = {
        success: false,
        message: "Recommendation system health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
        code: "HEALTH_001",
      };

      res.status(500).json(errorResponse);
    }
  }
}

export default new RecommendationController();
