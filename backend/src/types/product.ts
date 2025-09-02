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
  isActive: boolean;
  createdAt: Date;
}

export interface ProductListResponse {
  success: boolean;
  message: string;
  products: PublicProductResponse[];
  total: number;
}

export interface ProductDetailResponse {
  success: boolean;
  message: string;
  product: ProductResponse | PublicProductResponse;
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
