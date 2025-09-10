export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
  updatedAt: Date;
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    originalPrice?: number;
    images?: Array<{
      id: string;
      url: string;
      altText?: string;
      isMain: boolean;
    }>;
    isActive: boolean;
    stock: number;
    averageRating: number;
    reviewCount: number;
    category?: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

export interface WishlistData {
  items: WishlistItem[];
  totalItems: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AddToWishlistRequest {
  productId: string;
}

export interface WishlistFilters {
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "productName" | "price";
  sortOrder?: "asc" | "desc";
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface WishlistStats {
  totalItems: number;
  totalValue: number;
  averageItemPrice: number;
  categoriesCount: number;
  recentlyAdded: WishlistItem[];
}

export class WishlistError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = "WishlistError";
  }
}
