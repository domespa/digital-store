export interface SearchFilters {
  // TESTO
  query?: string;

  // CATEGORIA
  categoryId?: string;
  categorySlug?: string;

  // PREZZO
  minPrice?: number;
  maxPrice?: number;

  // RATING
  minRating?: number;

  // INVENTARIO
  inStock?: boolean;
  trackInventory?: boolean;

  // TIPO PRODOTTO
  isDigital?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;

  // REVIEW FILTERS
  minReviews?: number;
  hasReviews?: boolean;

  // PAGINAZIONE
  page?: number;
  limit?: number;

  // ORDINAMENTO
  sortBy?: SearchSortField;
  sortOrder?: "asc" | "desc";

  // DATE
  createdAfter?: Date;
  createdBefore?: Date;

  // AVANZATI
  tags?: string[];
  hasImages?: boolean;
  hasVariants?: boolean;
}

export type SearchSortField =
  | "relevance"
  | "price"
  | "rating"
  | "reviews"
  | "createdAt"
  | "name"
  | "popularity"
  | "discount";

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  averageRating: number;
  reviewCount: number;
  stock: number;
  isDigital: boolean;
  isFeatured: boolean;
  wishlistCount: number;
  viewCount: number;
  downloadCount: number;
  createdAt: Date;

  // RELAZIONI
  category?: {
    id: string;
    name: string;
    slug: string;
  };

  images?: Array<{
    id: string;
    url: string;
    altText?: string;
    isMain: boolean;
  }>;

  tags?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  // SEARCH METADATA
  relevanceScore?: number;
  matchedFields?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: {
    applied: SearchFilters;
    available: SearchFacets;
  };
  suggestions?: string[];
  searchTime: number;
  totalResults: number;
}

export interface SearchFacets {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    count: number;
  }>;

  priceRanges: Array<{
    min: number;
    max: number;
    count: number;
    label: string;
  }>;

  ratings: Array<{
    rating: number;
    count: number;
  }>;

  tags: Array<{
    id: string;
    name: string;
    count: number;
  }>;

  availability: {
    inStock: number;
    outOfStock: number;
  };

  productTypes: {
    digital: number;
    physical: number;
    featured: number;
  };
}

export interface SearchSuggestion {
  query: string;
  type: "product" | "category" | "brand" | "correction";
  count?: number;
}

export interface SearchAnalytics {
  query: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resultsCount: number;
  searchTime: number;
  filters: SearchFilters;
  clickedResults?: string[];
  timestamp: Date;
}

export class SearchError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "SearchError";
  }
}
