import { Router } from "express";
import { WishlistController } from "../controllers/wishlistController";
import { authenticateToken } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();

// ==================== RATE LIMITING ====================

const wishlistRateLimit = {
  // OPERAZIONI STANDARD (20 per 15 min)
  standard: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 20,
    message: {
      success: false,
      error: "Troppe richieste alla wishlist. Riprova tra 15 minuti.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // OPERAZIONI BULK (5 per ora)
  bulk: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 5,
    message: {
      success: false,
      error: "Troppe operazioni bulk. Riprova tra un'ora.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // CONDIVISIONI (3 per ora)
  sharing: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 3,
    message: {
      success: false,
      error: "Troppe condivisioni. Riprova tra un'ora.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

// ==================== ROUTE AUTENTICATE ====================

// AGGIUNGI PRODOTTO ALLA WISHLIST
//  POST /api/wishlist
router.post(
  "/",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.addToWishlist
);

// OTTIENI WISHLIST UTENTE CON FILTRI
// GET /api/wishlist
router.get(
  "/",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.getUserWishlist
);

// STATISTICHE WISHLIST
// GET /api/wishlist/stats
router.get(
  "/stats",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.getWishlistStats
);

// CONTROLLA SE PRODOTTO È NELLA WISHLIST
// GET /api/wishlist/check/:productId
router.get(
  "/check/:productId",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.checkInWishlist
);

// TOGGLE PRODOTTO NELLA WISHLIST
// POST /api/wishlist/toggle
router.post(
  "/toggle",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.toggleWishlist
);

// OPERAZIONI BULK
// POST /api/wishlist/bulk
router.post(
  "/bulk",
  authenticateToken,
  wishlistRateLimit.bulk,
  WishlistController.bulkOperations
);

// GENERA LINK CONDIVISIONE
// GET /api/wishlist/share
router.get(
  "/share",
  authenticateToken,
  wishlistRateLimit.sharing,
  WishlistController.shareWishlist
);

// SVUOTA WISHLIST
// DELETE /api/wishlist
router.delete(
  "/",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.clearWishlist
);

// SPOSTA PRODOTTO AL CARRELLO
// POST /api/wishlist/:productId/move-to-cart
router.post(
  "/:productId/move-to-cart",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.moveToCart
);

// RIMUOVI PRODOTTO DALLA WISHLIST
// DELETE /api/wishlist/:productId
router.delete(
  "/:productId",
  authenticateToken,
  wishlistRateLimit.standard,
  WishlistController.removeFromWishlist
);

// ==================== ROUTE PUBBLICHE ====================

// VISUALIZZA WISHLIST CONDIVISA (PUBBLICO)
// GET /api/wishlist/shared/:shareToken
router.get(
  "/shared/:shareToken",
  wishlistRateLimit.standard,
  WishlistController.getSharedWishlist
);

// ==================== HEALTH CHECK ====================
// HEALTH CHECK WISHLIST SYSTEM
// GET /api/wishlist/health
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Wishlist system operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      authenticated: [
        "POST /wishlist (add item)",
        "GET /wishlist (get user wishlist)",
        "GET /wishlist/stats (statistics)",
        "GET /wishlist/check/:productId (check if in wishlist)",
        "POST /wishlist/toggle (toggle item)",
        "POST /wishlist/bulk (bulk operations)",
        "GET /wishlist/share (generate share link)",
        "DELETE /wishlist (clear all)",
        "POST /wishlist/:productId/move-to-cart",
        "DELETE /wishlist/:productId (remove item)",
      ],
      public: ["GET /wishlist/shared/:shareToken (view shared wishlist)"],
    },
    rateLimits: {
      standard: "20 per 15 minutes",
      bulk: "5 per hour",
      sharing: "3 per hour",
    },
  });
});

export default router;
