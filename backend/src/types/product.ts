export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  fileName: string;
  filePath: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  fileName?: string;
  filePath?: string;
  isActive?: boolean;
}

export interface ProductResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  fileName: string;
  filePath: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicProductResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  displayPrice: number;
  currency: string;
  originalPrice: number;
  originalCurrency: string;
  formattedPrice: string;
  exchangeRate: number;
  exchangeSource: "api" | "fallback" | "same";
  isActive: boolean;
  createdAt: Date;
}

export interface CurrencyInfo {
  current: string;
  supported: Array<{
    code: string;
    symbol: string;
    name: string;
    flag?: string;
  }>;
}

export interface ProductListResponse {
  success: boolean;
  message: string;
  products?: PublicProductResponse[];
  total?: number;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
  };
  currency?: CurrencyInfo;
}

export interface ProductDetailResponse {
  success: boolean;
  message: string;
  product?: PublicProductResponse;
  currency?: CurrencyInfo;
}

export interface ProductMutationResponse {
  success: boolean;
  message: string;
  product?: ProductResponse;
}

// FILTRI PER CERCARE
export interface ProductFilters {
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  isActive?: boolean;
  sortBy?: "name" | "price" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: string;
  limit?: string;
}

export interface CurrencyConversionResponse {
  success: boolean;
  data?: {
    originalAmount: number;
    convertedAmount: number;
    fromCurrency: string;
    toCurrency: string;
    exchangeRate: number;
    source: "api" | "fallback" | "same";
    formattedPrice: string;
    timestamp: number;
  };
  message?: string;
}

export interface CurrencyListResponse {
  success: boolean;
  data?: {
    supported: Array<{
      code: string;
      symbol: string;
      name: string;
      flag?: string;
    }>;
    default: string;
    cache: {
      keys: number;
      hits: number;
      misses: number;
    };
  };
  error?: string;
}
