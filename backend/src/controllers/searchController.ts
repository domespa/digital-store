import { Request, Response } from "express";
import { SearchService } from "../services/searchService";
import { SearchFilters, SearchError } from "../types/search";
import { UserProfile } from "../types/auth";
import { catchAsync } from "../utils/catchAsync";

// INTERFACCIA PER REQUEST CON AUTH OPZIONALE
interface OptionalAuthRequest extends Request {
  user?: UserProfile;
}

// TIPI QUERY PARAMETERS
interface SearchQueryParams {
  q?: string;
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  inStock?: string;
  isDigital?: string;
  isFeatured?: string;
  hasReviews?: string;
  minReviews?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  createdAfter?: string;
  createdBefore?: string;
  tags?: string;
  hasImages?: string;
  hasVariants?: string;
}

export class SearchController {
  // RICERCA GENERALE PRODOTTI
  //  GET /api/search

  static searchProducts = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const filters = this.parseSearchFilters(req.query as SearchQueryParams);

      const results = await SearchService.searchProducts(filters);

      // TRACKING RICERCA PER ANALYTICS
      if (filters.query) {
        await SearchService.trackSearch({
          query: filters.query,
          userId: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          resultsCount: results.totalResults,
          searchTime: results.searchTime,
          filters,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        data: results,
      });
    }
  );
  //  RICERCA FULL-TEXT VELOCE
  // GET /api/search/quick
  static quickSearch = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { q, limit } = req.query;

      if (!q || typeof q !== "string") {
        throw new SearchError(
          "Parametro 'q' richiesto per ricerca rapida",
          400
        );
      }

      const limitNum = limit ? parseInt(limit as string) : 10;
      const results = await SearchService.fullTextSearch(q, limitNum);

      res.json({
        success: true,
        data: {
          query: q,
          results,
          total: results.length,
        },
      });
    }
  );

  // RICERCA PER CATEGORIA
  // GET /api/search/category/:categorySlug
  static searchByCategory = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { categorySlug } = req.params;
      const filters = this.parseSearchFilters(req.query as SearchQueryParams);

      const results = await SearchService.searchByCategory(
        categorySlug,
        filters
      );

      res.json({
        success: true,
        data: results,
      });
    }
  );

  // PRODOTTI SIMILI
  // GET /api/search/similar/:productId
  static findSimilarProducts = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { productId } = req.params;
      const { limit } = req.query;

      const limitNum = limit ? parseInt(limit as string) : 6;
      const results = await SearchService.findSimilarProducts(
        productId,
        limitNum
      );

      res.json({
        success: true,
        data: {
          productId,
          similar: results,
          total: results.length,
        },
      });
    }
  );

  // PRODOTTI POPOLARI
  // GET /api/search/popular
  static getPopularProducts = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { category, limit } = req.query;

      const limitNum = limit ? parseInt(limit as string) : 20;
      const results = await SearchService.getPopularProducts(
        category as string,
        limitNum
      );

      res.json({
        success: true,
        data: {
          popular: results,
          total: results.length,
          category: category || "all",
        },
      });
    }
  );

  // AUTOCOMPLETE / SUGGERIMENTI
  // GET /api/search/suggestions
  static getAutocompleteSuggestions = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { q, limit } = req.query;

      if (!q || typeof q !== "string") {
        throw new SearchError("Parametro 'q' richiesto per suggestions", 400);
      }

      const limitNum = limit ? parseInt(limit as string) : 8;
      const suggestions = await SearchService.getAutocompleteSuggestions(
        q,
        limitNum
      );

      res.json({
        success: true,
        data: {
          query: q,
          suggestions,
          total: suggestions.length,
        },
      });
    }
  );

  // RICERCA AVANZATA CON TUTTI I FILTRI
  // POST /api/search/advanced
  static advancedSearch = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const filters = req.body as SearchFilters;

      // VALIDAZIONE FILTRI
      this.validateAdvancedSearchFilters(filters);

      const results = await SearchService.searchProducts(filters);

      res.json({
        success: true,
        data: results,
      });
    }
  );

  // FILTRA PER PREZZO
  // GET /api/search/price-range
  static searchByPriceRange = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { min, max, category, page, limit } = req.query;

      if (!min || !max) {
        throw new SearchError("Parametri 'min' e 'max' richiesti", 400);
      }

      const filters: SearchFilters = {
        minPrice: parseFloat(min as string),
        maxPrice: parseFloat(max as string),
        categorySlug: category as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        sortBy: "price",
        sortOrder: "asc",
      };

      const results = await SearchService.searchProducts(filters);

      res.json({
        success: true,
        data: results,
      });
    }
  );

  // RICERCA PER RATING
  // GET /api/search/by-rating
  static searchByRating = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { minRating, category, page, limit } = req.query;

      if (!minRating) {
        throw new SearchError("Parametro 'minRating' richiesto", 400);
      }

      const filters: SearchFilters = {
        minRating: parseFloat(minRating as string),
        categorySlug: category as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        sortBy: "rating",
        sortOrder: "desc",
        hasReviews: true,
      };

      const results = await SearchService.searchProducts(filters);

      res.json({
        success: true,
        data: results,
      });
    }
  );

  // PRODOTTI IN OFFERTA
  // GET /api/search/on-sale
  static getProductsOnSale = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { category, page, limit } = req.query;

      // PRODOTTI CON PREZZO ORIGINALE (IN OFFERTA)
      const products = await SearchService.searchProducts({
        categorySlug: category as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        sortBy: "discount",
        sortOrder: "desc",
      });

      // FILTRA SOLO QUELLI CON SCONTO REALE
      const onSaleProducts = {
        ...products,
        results: products.results.filter(
          (p) => p.discountPercentage && p.discountPercentage > 0
        ),
      };

      res.json({
        success: true,
        data: onSaleProducts,
      });
    }
  );

  // RICERCA PRODOTTI DIGITALI
  // GET /api/search/digital
  static searchDigitalProducts = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const filters = this.parseSearchFilters(req.query as SearchQueryParams);
      filters.isDigital = true;

      const results = await SearchService.searchProducts(filters);

      res.json({
        success: true,
        data: results,
      });
    }
  );

  // PRODOTTI FEATURED
  // GET /api/search/featured
  static getFeaturedProducts = catchAsync(
    async (req: OptionalAuthRequest, res: Response) => {
      const { category, page, limit } = req.query;

      const filters: SearchFilters = {
        isFeatured: true,
        categorySlug: category as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        sortBy: "popularity",
        sortOrder: "desc",
      };

      const results = await SearchService.searchProducts(filters);

      res.json({
        success: true,
        data: results,
      });
    }
  );

  // ==================== METODI HELPER PRIVATI ====================
  // PARSE QUERY PARAMETERS A SEARCH FILTERS
  private static parseSearchFilters(query: SearchQueryParams): SearchFilters {
    const filters: SearchFilters = {};

    // QUERY TESTUALE
    if (query.q || query.query) {
      filters.query = (query.q || query.query) as string;
    }

    // CATEGORIA
    if (query.categoryId) {
      filters.categoryId = query.categoryId;
    }
    if (query.categorySlug) {
      filters.categorySlug = query.categorySlug;
    }

    // PREZZO
    if (query.minPrice) {
      const minPrice = parseFloat(query.minPrice);
      if (!isNaN(minPrice) && minPrice >= 0) {
        filters.minPrice = minPrice;
      }
    }
    if (query.maxPrice) {
      const maxPrice = parseFloat(query.maxPrice);
      if (!isNaN(maxPrice) && maxPrice >= 0) {
        filters.maxPrice = maxPrice;
      }
    }

    // RATING
    if (query.minRating) {
      const minRating = parseFloat(query.minRating);
      if (!isNaN(minRating) && minRating >= 0 && minRating <= 5) {
        filters.minRating = minRating;
      }
    }

    // BOOLEAN FILTERS
    if (query.inStock !== undefined) {
      filters.inStock = query.inStock === "true";
    }
    if (query.isDigital !== undefined) {
      filters.isDigital = query.isDigital === "true";
    }
    if (query.isFeatured !== undefined) {
      filters.isFeatured = query.isFeatured === "true";
    }
    if (query.hasReviews !== undefined) {
      filters.hasReviews = query.hasReviews === "true";
    }
    if (query.hasImages !== undefined) {
      filters.hasImages = query.hasImages === "true";
    }
    if (query.hasVariants !== undefined) {
      filters.hasVariants = query.hasVariants === "true";
    }

    // RECENSIONI
    if (query.minReviews) {
      const minReviews = parseInt(query.minReviews);
      if (!isNaN(minReviews) && minReviews >= 0) {
        filters.minReviews = minReviews;
      }
    }

    // PAGINAZIONE
    if (query.page) {
      const page = parseInt(query.page);
      if (!isNaN(page) && page > 0) {
        filters.page = page;
      }
    }
    if (query.limit) {
      const limit = parseInt(query.limit);
      if (!isNaN(limit) && limit > 0 && limit <= 100) {
        filters.limit = limit;
      }
    }

    // ORDINAMENTO
    if (query.sortBy) {
      const validSortFields = [
        "relevance",
        "price",
        "rating",
        "reviews",
        "createdAt",
        "name",
        "popularity",
        "discount",
      ];
      if (validSortFields.includes(query.sortBy)) {
        filters.sortBy = query.sortBy as any;
      }
    }
    if (query.sortOrder) {
      if (["asc", "desc"].includes(query.sortOrder)) {
        filters.sortOrder = query.sortOrder as "asc" | "desc";
      }
    }

    // DATE
    if (query.createdAfter) {
      const date = new Date(query.createdAfter);
      if (!isNaN(date.getTime())) {
        filters.createdAfter = date;
      }
    }
    if (query.createdBefore) {
      const date = new Date(query.createdBefore);
      if (!isNaN(date.getTime())) {
        filters.createdBefore = date;
      }
    }

    // TAGS
    if (query.tags) {
      filters.tags = query.tags.split(",").map((tag) => tag.trim());
    }

    return filters;
  }

  // VALIDAZIONE FILTRI ADVANCED SEARCH
  private static validateAdvancedSearchFilters(filters: SearchFilters): void {
    // VALIDAZIONE PREZZO
    if (filters.minPrice !== undefined && filters.minPrice < 0) {
      throw new SearchError("minPrice deve essere >= 0", 400);
    }
    if (filters.maxPrice !== undefined && filters.maxPrice < 0) {
      throw new SearchError("maxPrice deve essere >= 0", 400);
    }
    if (
      filters.minPrice &&
      filters.maxPrice &&
      filters.minPrice > filters.maxPrice
    ) {
      throw new SearchError(
        "minPrice non può essere maggiore di maxPrice",
        400
      );
    }

    // VALIDAZIONE RATING
    if (
      filters.minRating !== undefined &&
      (filters.minRating < 0 || filters.minRating > 5)
    ) {
      throw new SearchError("minRating deve essere tra 0 e 5", 400);
    }

    // VALIDAZIONE PAGINAZIONE
    if (filters.page !== undefined && filters.page < 1) {
      throw new SearchError("page deve essere >= 1", 400);
    }
    if (
      filters.limit !== undefined &&
      (filters.limit < 1 || filters.limit > 100)
    ) {
      throw new SearchError("limit deve essere tra 1 e 100", 400);
    }

    // VALIDAZIONE DATE
    if (
      filters.createdAfter &&
      filters.createdBefore &&
      filters.createdAfter > filters.createdBefore
    ) {
      throw new SearchError(
        "createdAfter non può essere dopo createdBefore",
        400
      );
    }

    // VALIDAZIONE TAGS
    if (filters.tags && filters.tags.length > 20) {
      throw new SearchError("Massimo 20 tag per ricerca", 400);
    }
  }
}
