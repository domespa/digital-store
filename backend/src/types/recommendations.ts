import { Prisma } from "../generated/prisma";

// ===========================================
//              PRISMA TYPES
// ===========================================

// Prodotto con tutti i dettagli per raccomandazioni
export type ProductWithRecommendationDetails = Prisma.ProductGetPayload<{
  include: {
    category: true;
    images: true;
    reviews: {
      select: { rating: true };
    };
    _count: {
      select: {
        reviews: true;
        orderItems: true;
        wishlists: true;
      };
    };
  };
}>;

// Prodotto per trending con dati temporali
export type ProductWithTrendingData = Prisma.ProductGetPayload<{
  include: {
    category: true;
    images: true;
    reviews: {
      select: { rating: true; createdAt: true };
    };
    orderItems: true;
    _count: {
      select: {
        reviews: true;
        orderItems: true;
        wishlists: true;
      };
    };
  };
}>;

// Utente con cronologia ordini
export type UserWithOrderHistory = Prisma.UserGetPayload<{
  include: {
    orders: {
      include: {
        orderItems: {
          select: { productId: true };
        };
      };
    };
  };
}>;

// OrderItem con prodotto
export type OrderItemWithProduct = Prisma.OrderItemGetPayload<{
  include: {
    product: {
      select: { categoryId: true };
    };
  };
}>;

// Prodotto per collaborative filtering
export type ProductForCollaborative = Prisma.ProductGetPayload<{
  include: {
    category: true;
    images: true;
    reviews: { select: { rating: true } };
    _count: {
      select: { reviews: true; orderItems: true; wishlists: true };
    };
    orderItems: {
      include: {
        order: {
          select: { userId: true };
        };
      };
    };
  };
}>;

// ===========================================
//           RECOMMENDATION INTERFACES
// ===========================================

export interface RecommendationResult {
  product: ProductWithRecommendationDetails & {
    avgRating: number;
  };
  score: number;
  reason: string;
}

export interface UserHistory {
  purchases: OrderItemWithProduct[];
  wishlist: string[];
  reviews: { productId: string; rating: number }[];
  categories: string[];
}

export interface SimilarityScore {
  userId: string;
  score: number;
  commonPurchases: number;
}

export interface ProductSimilarity {
  productId: string;
  score: number;
  reasons: string[];
}

export interface WeightedRecommendation {
  recs: RecommendationResult[];
  weight: number;
}

// ===========================================
//              API RESPONSES
// ===========================================

export interface RecommendationResponse {
  success: boolean;
  message: string;
  recommendations: RecommendationResult[];
  total: number;
  algorithm?: string;
  metadata?: {
    userId?: string;
    productId?: string;
    categoryId?: string;
    limit: number;
    reason?: string;
  };
}

export interface SimilarProductsResponse {
  success: boolean;
  message: string;
  targetProduct: {
    id: string;
    name: string;
    category?: string;
  };
  similarProducts: RecommendationResult[];
  total: number;
}

export interface TrendingProductsResponse {
  success: boolean;
  message: string;
  trendingProducts: RecommendationResult[];
  total: number;
  period: string;
  categoryId?: string;
}

export interface FrequentlyBoughtTogetherResponse {
  success: boolean;
  message: string;
  targetProduct: {
    id: string;
    name: string;
  };
  frequentlyBoughtTogether: RecommendationResult[];
  total: number;
}

// ===========================================
//           REQUEST INTERFACES
// ===========================================

export interface GetUserRecommendationsRequest {
  limit?: number;
  excludeOwned?: boolean;
  categoryId?: string;
}

export interface GetSimilarProductsRequest {
  limit?: number;
}

export interface GetTrendingProductsRequest {
  limit?: number;
  categoryId?: string;
  period?: "week" | "month" | "quarter";
}

export interface GetFrequentlyBoughtTogetherRequest {
  limit?: number;
}

// ===========================================
//               FILTERS
// ===========================================

export interface RecommendationFilters {
  categoryId?: string;
  minRating?: number;
  maxPrice?: number;
  minPrice?: number;
  inStock?: boolean;
  featured?: boolean;
}

// ===========================================
//             ERROR TYPES
// ===========================================

export interface RecommendationError {
  success: false;
  message: string;
  error: string;
  code?: string;
}

// ===========================================
//            ALGORITHM TYPES
// ===========================================

export type RecommendationAlgorithm =
  | "hybrid"
  | "collaborative"
  | "content-based"
  | "trending"
  | "frequently-bought-together";

export interface AlgorithmWeights {
  collaborative: number;
  contentBased: number;
  trending: number;
}

export interface RecommendationConfig {
  defaultLimit: number;
  similarProductsLimit: number;
  minReviewsForTrending: number;
  similarityThreshold: number;
  priceVarianceFactor: number;
  weights: AlgorithmWeights;
}

// ===========================================
//             UTILITY TYPES
// ===========================================

export type RecommendationResultWithoutProduct = Omit<
  RecommendationResult,
  "product"
>;

export type ProductForRecommendation = Pick<
  ProductWithRecommendationDetails,
  "id" | "name" | "price" | "categoryId" | "isActive" | "stock"
> & {
  category: { id: string; name: string } | null;
  images: { url: string }[];
  avgRating: number;
  reviewCount: number;
  orderCount: number;
  wishlistCount: number;
};

// ===========================================
//              TYPE GUARDS
// ===========================================

export const isValidRecommendationResult = (
  item: unknown
): item is RecommendationResult => {
  return (
    typeof item === "object" &&
    item !== null &&
    "product" in item &&
    "score" in item &&
    "reason" in item &&
    typeof (item as RecommendationResult).score === "number" &&
    typeof (item as RecommendationResult).reason === "string"
  );
};

export const hasValidCategory = (
  product: ProductWithRecommendationDetails
): product is ProductWithRecommendationDetails & {
  category: NonNullable<ProductWithRecommendationDetails["category"]>;
} => {
  return product.category !== null;
};

export const hasValidCategoryId = (product: {
  categoryId: string | null;
}): product is { categoryId: string } => {
  return product.categoryId !== null;
};
