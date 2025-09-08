import { Router } from "express";
import { ReviewController } from "../controllers/reviewController";
import {
  authenticateToken,
  requireAdmin,
  optionalAuth,
} from "../middleware/auth";
import { reviewValidation } from "../middleware/review";
import { reviewRateLimit } from "../middleware/reviewRateLimit";

const router = Router();

// ==================== ROUTE PUBBLICHE E CON AUTH OPZIONALE ====================

// OTTIENI RECENSIONI PRODOTTO (PUBBLICO - NESSUNA AUTH RICHIESTA)
// SUPPORTA FILTRAGGIO PER RATING, STATUS VERIFICATO, ECC.
router.get(
  "/products/:productId/reviews",
  reviewRateLimit.readReviews, // RATE LIMITING PER LETTURA
  reviewValidation.validateProductId,
  optionalAuth, // AUTH OPZIONALE PER MOSTRARE STATUS VOTI UTILI
  ReviewController.getProductReviews
);

// CREA UNA NUOVA RECENSIONE (SUPPORTA SIA UTENTI AUTENTICATI CHE OSPITI)
// APPLICA RATE LIMITING DIVERSO A SECONDA DELL'AUTENTICAZIONE
router.post(
  "/",
  reviewRateLimit.guestReviews, // RATE LIMITING PER OSPITI (PIÙ RIGOROSO)
  reviewRateLimit.createReview, // RATE LIMITING PER UTENTI AUTENTICATI
  optionalAuth, // AUTH OPZIONALE - SUPPORTA SIA UTENTI CHE OSPITI
  reviewValidation.validateCreateReview,
  reviewValidation.validateContent, // VALIDAZIONE ANTI-SPAM
  reviewValidation.customSanitizer, // SANITIZZAZIONE
  ReviewController.createReview
);

// VOTA UTILE/NON UTILE SU UNA RECENSIONE (SUPPORTA SIA AUTENTICATI CHE ANONIMI)
router.post(
  "/:reviewId/vote",
  reviewRateLimit.voteReview, // 50 VOTI ALL'ORA
  optionalAuth, // AUTH OPZIONALE - SUPPORTA VOTI ANONIMI
  reviewValidation.validateVoteHelpful,
  ReviewController.voteHelpful
);

// OTTIENI TUTTE LE RECENSIONI CON FILTRI (PUBBLICO CON RATE LIMITING)
router.get("/", reviewRateLimit.readReviews, ReviewController.getReviews);

// ==================== ROUTE UTENTI AUTENTICATI ====================
// OTTIENI RECENSIONI PROPRIE UTENTE

router.get("/me", authenticateToken, ReviewController.getUserReviews);

// AGGIORNA RECENSIONE PROPRIA UTENTE
router.put(
  "/:reviewId",
  authenticateToken,
  reviewRateLimit.updateReview, // 10 AGGIORNAMENTI ALL'ORA
  reviewValidation.validateUpdateReview,
  reviewValidation.validateContent, // VALIDAZIONE ANTI-SPAM
  ReviewController.updateReview
);

// ELIMINA RECENSIONE PROPRIA UTENTE

router.delete("/:reviewId", authenticateToken, ReviewController.deleteReview);

// SEGNALA UNA RECENSIONE (SOLO UTENTI AUTENTICATI)

router.post(
  "/:reviewId/report",
  authenticateToken,
  reviewRateLimit.reportReview, // 10 SEGNALAZIONI ALL'ORA
  reviewValidation.validateReportReview,
  ReviewController.reportReview
);

// CONTROLLA SE UTENTE PUÒ RECENSIRE UN PRODOTTO
router.get(
  "/products/:productId/can-review",
  authenticateToken,
  reviewRateLimit.checkEligibility, // 30 CONTROLLI PER 15 MINUTI
  reviewValidation.validateProductId,
  ReviewController.canUserReview
);

// ==================== ROUTE ADMIN ====================

// ADMIN: OTTIENI RECENSIONI PENDING PER MODERAZIONE

router.get(
  "/admin/pending",
  authenticateToken,
  requireAdmin,
  reviewRateLimit.adminModeration,
  ReviewController.getPendingReviews
);

// ADMIN: AGGIORNA RECENSIONE (APPROVA, FISSA, MODERA)

router.put(
  "/admin/:reviewId",
  authenticateToken,
  requireAdmin,
  reviewRateLimit.adminModeration,
  reviewValidation.validateAdminUpdateReview,
  ReviewController.adminUpdateReview
);

// ADMIN: ELIMINA RECENSIONE
router.delete(
  "/admin/:reviewId",
  authenticateToken,
  requireAdmin,
  reviewRateLimit.adminModeration,
  ReviewController.adminDeleteReview
);

// ==================== ROUTE DI UTILITÀ ====================

// HEALTH CHECK PER SISTEMA RECENSIONI
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Review system is operational",
    timestamp: new Date().toISOString(),
    endpoints: {
      public: [
        "GET /products/:productId/reviews",
        "POST / (guest reviews)",
        "POST /:reviewId/vote (anonymous)",
        "GET /",
      ],
      authenticated: [
        "GET /me",
        "PUT /:reviewId",
        "DELETE /:reviewId",
        "POST /:reviewId/report",
        "GET /products/:productId/can-review",
      ],
      admin: [
        "GET /admin/pending",
        "PUT /admin/:reviewId",
        "DELETE /admin/:reviewId",
      ],
    },
  });
});

// RATE LIMIT INFO ENDPOINT
router.get("/rate-limits", (req, res) => {
  res.json({
    success: true,
    rateLimits: {
      createReview: "5 per hour (authenticated), 2 per day (guest)",
      updateReview: "10 per hour",
      voteReview: "50 per hour",
      reportReview: "10 per hour",
      readReviews: "100 per 15 minutes",
      checkEligibility: "30 per 15 minutes",
      adminOperations: "100 per hour",
    },
  });
});

export default router;
