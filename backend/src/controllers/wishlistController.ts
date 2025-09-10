// src/controllers/wishlistController.ts

import { Request, Response } from "express";
import { WishlistService } from "../services/wishlistService";
import { WishlistError, WishlistFilters } from "../types/wishlist";
import { UserProfile } from "../types/auth";
import { catchAsync } from "../utils/catchAsync";

// INTERFACCIA PER REQUEST AUTENTICATA
interface AuthenticatedRequest extends Request {
  user: UserProfile;
}

// TIPI QUERY PARAMETERS
interface WishlistQueryParams {
  page?: string;
  limit?: string;
  sortBy?: "createdAt" | "productName" | "price";
  sortOrder?: "asc" | "desc";
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
}

export class WishlistController {
  // AGGIUNGI PRODOTTO ALLA WISHLIST
  // POST /api/wishlist
  static addToWishlist = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = req.body;

      if (!productId) {
        throw new WishlistError("Product ID è richiesto", 400);
      }

      const wishlistItem = await WishlistService.addToWishlist(req.user.id, {
        productId,
      });

      res.status(201).json({
        success: true,
        message: "Prodotto aggiunto alla wishlist con successo",
        data: { wishlistItem },
      });
    }
  );

  // RIMUOVI PRODOTTO DALLA WISHLIST
  // DELETE /api/wishlist/:productId
  static removeFromWishlist = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = req.params;

      await WishlistService.removeFromWishlist(req.user.id, productId);

      res.json({
        success: true,
        message: "Prodotto rimosso dalla wishlist con successo",
      });
    }
  );

  // OTTIENI WISHLIST UTENTE CON FILTRI
  // GET /api/wishlist
  static getUserWishlist = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const query = this.parseWishlistQuery(req.query as WishlistQueryParams);
      const wishlistData = await WishlistService.getUserWishlist(
        req.user.id,
        query
      );

      res.json({
        success: true,
        data: wishlistData,
      });
    }
  );

  // CONTROLLA SE PRODOTTO È NELLA WISHLIST
  // GET /api/wishlist/check/:productId
  static checkInWishlist = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = req.params;

      const isInWishlist = await WishlistService.isInWishlist(
        req.user.id,
        productId
      );

      res.json({
        success: true,
        data: { isInWishlist },
      });
    }
  );

  // OTTIENI STATISTICHE WISHLIST
  // GET /api/wishlist/stats
  static getWishlistStats = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const stats = await WishlistService.getWishlistStats(req.user.id);

      res.json({
        success: true,
        data: { stats },
      });
    }
  );

  // SVUOTA COMPLETAMENTE LA WISHLIST
  // DELETE /api/wishlist
  static clearWishlist = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      await WishlistService.clearWishlist(req.user.id);

      res.json({
        success: true,
        message: "Wishlist svuotata con successo",
      });
    }
  );

  // SPOSTA PRODOTTO DALLA WISHLIST AL CARRELLO
  // POST /api/wishlist/:productId/move-to-cart
  static moveToCart = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = req.params;

      await WishlistService.moveToCart(req.user.id, productId);

      res.json({
        success: true,
        message: "Prodotto spostato dalla wishlist al carrello",
      });
    }
  );

  // OPERAZIONI BULK SULLA WISHLIST
  // POST /api/wishlist/bulk
  static bulkOperations = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { operation, productIds } = req.body;

      if (!operation || !productIds || !Array.isArray(productIds)) {
        throw new WishlistError("Operation e productIds sono richiesti", 400);
      }

      if (!["remove", "moveToCart"].includes(operation)) {
        throw new WishlistError(
          "Operation deve essere 'remove' o 'moveToCart'",
          400
        );
      }

      if (productIds.length === 0) {
        throw new WishlistError(
          "Almeno un prodotto deve essere specificato",
          400
        );
      }

      if (productIds.length > 50) {
        throw new WishlistError("Massimo 50 prodotti per operazione bulk", 400);
      }

      const result = await WishlistService.bulkOperations(
        req.user.id,
        operation,
        productIds
      );

      res.json({
        success: true,
        message: `Operazione bulk completata: ${result.success} successi, ${result.failed} fallimenti`,
        data: result,
      });
    }
  );

  // TOGGLE PRODOTTO NELLA WISHLIST (AGGIUNGI/RIMUOVI)
  // POST /api/wishlist/toggle
  static toggleWishlist = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const { productId } = req.body;

      if (!productId) {
        throw new WishlistError("Product ID è richiesto", 400);
      }

      const isInWishlist = await WishlistService.isInWishlist(
        req.user.id,
        productId
      );

      if (isInWishlist) {
        await WishlistService.removeFromWishlist(req.user.id, productId);
        res.json({
          success: true,
          message: "Prodotto rimosso dalla wishlist",
          data: { action: "removed", isInWishlist: false },
        });
      } else {
        const wishlistItem = await WishlistService.addToWishlist(req.user.id, {
          productId,
        });
        res.status(201).json({
          success: true,
          message: "Prodotto aggiunto alla wishlist",
          data: { action: "added", isInWishlist: true, wishlistItem },
        });
      }
    }
  );

  // CONDIVIDI WISHLIST
  // GET /api/wishlist/share
  static shareWishlist = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      // Genera token temporaneo per condivisione (24h)
      const shareToken = Buffer.from(
        `${req.user.id}:${Date.now() + 24 * 60 * 60 * 1000}`
      ).toString("base64url");

      const shareUrl = `${process.env.FRONTEND_URL}/wishlist/shared/${shareToken}`;

      res.json({
        success: true,
        message: "Link condivisione generato (valido 24h)",
        data: {
          shareUrl,
          shareToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  );

  // VISUALIZZA WISHLIST CONDIVISA (PUBBLICO)
  // GET /api/wishlist/shared/:shareToken
  static getSharedWishlist = catchAsync(async (req: Request, res: Response) => {
    const { shareToken } = req.params;

    try {
      const decoded = Buffer.from(shareToken, "base64url").toString();
      const [userId, expiresAtStr] = decoded.split(":");
      const expiresAt = parseInt(expiresAtStr);

      if (Date.now() > expiresAt) {
        throw new WishlistError("Link condivisione scaduto", 410);
      }

      // Recupera wishlist pubblica (solo prodotti attivi)
      const wishlistData = await WishlistService.getUserWishlist(userId, {
        page: 1,
        limit: 100, // Limite per condivisione
      });

      // Filtra informazioni sensibili
      const publicWishlist = {
        ...wishlistData,
        items: wishlistData.items.map((item) => ({
          ...item,
          userId: undefined, // Rimuovi info utente
        })),
      };

      res.json({
        success: true,
        data: publicWishlist,
      });
    } catch (error) {
      throw new WishlistError("Link condivisione non valido", 400);
    }
  });

  // ==================== METODI HELPER PRIVATI ====================

  // PARSE QUERY PARAMETERS PER WISHLIST
  private static parseWishlistQuery(
    query: WishlistQueryParams
  ): WishlistFilters {
    const parsed: WishlistFilters = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    };

    // GESTIONE SORT BY
    if (query.sortBy) {
      const validSortFields = ["createdAt", "productName", "price"] as const;
      if (
        validSortFields.includes(
          query.sortBy as (typeof validSortFields)[number]
        )
      ) {
        parsed.sortBy = query.sortBy as (typeof validSortFields)[number];
      }
    }

    // GESTIONE SORT ORDER
    if (query.sortOrder) {
      const validSortOrders = ["asc", "desc"] as const;
      if (
        validSortOrders.includes(
          query.sortOrder as (typeof validSortOrders)[number]
        )
      ) {
        parsed.sortOrder = query.sortOrder as (typeof validSortOrders)[number];
      }
    }

    // GESTIONE FILTRI
    if (query.category) {
      parsed.category = query.category;
    }

    if (query.minPrice) {
      const minPrice = parseFloat(query.minPrice);
      if (!isNaN(minPrice) && minPrice >= 0) {
        parsed.minPrice = minPrice;
      }
    }

    if (query.maxPrice) {
      const maxPrice = parseFloat(query.maxPrice);
      if (!isNaN(maxPrice) && maxPrice >= 0) {
        parsed.maxPrice = maxPrice;
      }
    }

    if (query.inStock !== undefined) {
      parsed.inStock = query.inStock === "true";
    }

    return parsed;
  }
}
