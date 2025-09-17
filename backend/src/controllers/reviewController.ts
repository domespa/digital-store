import { Request, Response } from "express";
import { ReviewService } from "../services/reviewService";
import {
  ReviewError,
  ModerationError,
  CreateReviewRequest,
  UpdateReviewRequest,
  AdminUpdateReviewRequest,
  CreateReportRequest,
  HandleReportRequest,
  BulkReviewOperation,
  ReviewListQuery,
  ReportReason,
  ReportStatus,
} from "../types/review";
import { UserProfile } from "../types/auth";
import { UserRole } from "../generated/prisma";
import { catchAsync } from "../utils/catchAsync";

// INTERFACCIA ESTESA PER REQUEST AUTENTICATA CON QUERY
interface AuthenticatedRequestWithQuery extends Request {
  user?: UserProfile & { emailVerified: boolean };
  query: Request["query"];
}

// INTERFACCIA PER REQUEST CHE SUPPORTA SIA AUTH CHE GUEST
interface FlexibleRequest extends Request {
  user?: UserProfile & { emailVerified: boolean };
}

// TIPI QUERY PARAMETERS
interface ReviewQueryParams {
  page?: string;
  limit?: string;
  sortBy?: "createdAt" | "rating" | "helpfulCount" | "reportCount";
  sortOrder?: "asc" | "desc";
  search?: string;
  rating?: string | string[];
  isVerified?: string;
  isApproved?: string;
  isPinned?: string;
  productId?: string;
  userId?: string;
  customerEmail?: string;
  startDate?: string;
  endDate?: string;
}

export class ReviewController {
  // CREA UNA NUOVA RECENSIONE (SUPPORTA SIA UTENTI AUTENTICATI CHE OSPITI)
  // POST /api/reviews
  static createReview = catchAsync(
    async (req: FlexibleRequest, res: Response) => {
      const reviewData = req.body as CreateReviewRequest;
      let review;

      if (req.user) {
        // UTENTE AUTENTICATO
        review = await ReviewService.createReview(req.user.id, reviewData);
      } else {
        // OSPITE - RICHIEDI EMAIL E NOME
        if (!reviewData.customerEmail || !reviewData.customerName) {
          throw new ReviewError(
            "Email e nome sono richiesti per gli ospiti",
            400
          );
        }

        const guestReviewData = {
          ...reviewData,
          customerEmail: reviewData.customerEmail,
          customerName: reviewData.customerName,
        };

        review = await ReviewService.createGuestReview(guestReviewData);
      }

      res.status(201).json({
        success: true,
        message: review.isApproved
          ? "Recensione creata e pubblicata con successo"
          : "Recensione creata e in attesa di moderazione",
        data: { review },
      });
    }
  );

  // AGGIORNA RECENSIONE PROPRIA UTENTE (SOLO UTENTI AUTENTICATI)
  // PUT /api/reviews/:reviewId
  static updateReview = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user) {
        throw new ReviewError(
          "Autenticazione richiesta per aggiornare recensioni",
          401
        );
      }

      const { reviewId } = req.params;
      const updateData = req.body as UpdateReviewRequest;

      const review = await ReviewService.updateReview(
        req.user.id,
        reviewId,
        updateData
      );

      res.json({
        success: true,
        message: "Recensione aggiornata con successo",
        data: { review },
      });
    }
  );

  // ELIMINA RECENSIONE PROPRIA UTENTE (SOLO UTENTI AUTENTICATI)
  // DELETE /api/reviews/:reviewId
  static deleteReview = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user) {
        throw new ReviewError(
          "Autenticazione richiesta per eliminare recensioni",
          401
        );
      }

      const { reviewId } = req.params;

      await ReviewService.deleteReview(req.user.id, reviewId);

      res.json({
        success: true,
        message: "Recensione eliminata con successo",
      });
    }
  );

  // OTTIENI RECENSIONI CON FILTRI E PAGINAZIONE (PUBBLICO)
  // GET /api/reviews
  static getReviews = catchAsync(
    async (req: Request<{}, {}, {}, ReviewQueryParams>, res: Response) => {
      const query = this.parseReviewQuery(req.query);
      const result = await ReviewService.getReviews(query);

      res.json({
        success: true,
        data: result,
      });
    }
  );

  //  OTTIENI RECENSIONI PRODOTTO (ENDPOINT PUBBLICO)
  // GET /api/products/:productId/reviews
  static getProductReviews = catchAsync(
    async (
      req: Request<{ productId: string }, {}, {}, ReviewQueryParams>,
      res: Response
    ) => {
      const { productId } = req.params;
      const query = this.parseReviewQuery(req.query);

      const result = await ReviewService.getProductReviews(productId, query);

      res.json({
        success: true,
        data: result,
      });
    }
  );

  // OTTIENI RECENSIONI PROPRIE UTENTE (SOLO AUTENTICATI)
  // GET /api/users/me/reviews
  static getUserReviews = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user) {
        throw new ReviewError("Autenticazione richiesta", 401);
      }

      const query = this.parseReviewQuery(req.query as ReviewQueryParams);
      const result = await ReviewService.getUserReviews(req.user.id, query);

      res.json({
        success: true,
        data: result,
      });
    }
  );

  //  VOTA UTILE SU UNA RECENSIONE (SUPPORTA SIA AUTENTICATI CHE ANONIMI)
  // POST /api/reviews/:reviewId/vote
  static voteHelpful = catchAsync(
    async (req: FlexibleRequest, res: Response) => {
      const { reviewId } = req.params;
      const { isHelpful } = req.body;

      if (typeof isHelpful !== "boolean") {
        throw new ReviewError("isHelpful deve essere boolean", 400);
      }

      if (req.user) {
        // VOTO UTENTE AUTENTICATO
        await ReviewService.voteHelpful(req.user.id, reviewId, isHelpful);
      } else {
        // VOTO ANONIMO CON IP
        const ipAddress = req.ip || req.socket?.remoteAddress || "unknown";
        await ReviewService.voteHelpfulAnonymous(
          ipAddress,
          reviewId,
          isHelpful
        );
      }

      res.json({
        success: true,
        message: "Voto registrato con successo",
      });
    }
  );

  // SEGNALA UNA RECENSIONE (SOLO UTENTI AUTENTICATI PER ORA)
  // POST /api/reviews/:reviewId/report
  static reportReview = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user) {
        throw new ReviewError(
          "Autenticazione richiesta per segnalare recensioni",
          401
        );
      }

      const { reviewId } = req.params;
      const { reason, description } = req.body;

      const reportData: CreateReportRequest = {
        reviewId,
        reason: reason as ReportReason,
        description,
      };

      await ReviewService.reportReview(req.user.id, reportData);

      res.json({
        success: true,
        message: "Recensione segnalata con successo",
      });
    }
  );

  // CONTROLLA SE UTENTE PUÒ RECENSIRE UN PRODOTTO (SOLO AUTENTICATI)
  // GET /api/products/:productId/can-review
  static canUserReview = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user) {
        throw new ReviewError("Autenticazione richiesta", 401);
      }

      const { productId } = req.params;
      const canReview = await ReviewService.canUserReview(
        req.user.id,
        productId
      );

      res.json({
        success: true,
        data: { canReview },
      });
    }
  );

  // ==================== ENDPOINT ADMIN ====================

  //  ADMIN: AGGIORNA RECENSIONE (APPROVA, FISSA, MODERA)
  // PUT /api/admin/reviews/:reviewId
  static adminUpdateReview = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        throw new ModerationError(
          "Accesso negato - privilegi admin richiesti",
          403
        );
      }

      const { reviewId } = req.params;
      const updateData = req.body as AdminUpdateReviewRequest;

      const review = await ReviewService.adminUpdateReview(
        req.user.id,
        reviewId,
        updateData
      );

      res.json({
        success: true,
        message: "Recensione aggiornata con successo",
        data: { review },
      });
    }
  );

  // ADMIN: ELIMINA RECENSIONE
  // DELETE /api/admin/reviews/:reviewId
  static adminDeleteReview = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        throw new ModerationError(
          "Accesso negato - privilegi admin richiesti",
          403
        );
      }

      const { reviewId } = req.params;
      const { reason } = req.body as { reason?: string };

      await ReviewService.adminDeleteReview(req.user.id, reviewId, reason);

      res.json({
        success: true,
        message: "Recensione eliminata con successo",
      });
    }
  );

  // ADMIN: OTTIENI RECENSIONI PENDING PER MODERAZIONE
  // GET /api/admin/reviews/pending
  static getPendingReviews = catchAsync(
    async (req: AuthenticatedRequestWithQuery, res: Response) => {
      if (!req.user || req.user.role !== UserRole.ADMIN) {
        throw new ModerationError(
          "Accesso negato - privilegi admin richiesti",
          403
        );
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await ReviewService.getPendingReviews(page, limit);

      res.json({
        success: true,
        data: result,
      });
    }
  );

  // ==================== METODI HELPER PRIVATI ====================
  private static parseReviewQuery(query: ReviewQueryParams): ReviewListQuery {
    const parsed: ReviewListQuery = {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 10,
      search: query.search,
    };

    // GESTIONE SORT BY
    if (query.sortBy) {
      const validSortFields = [
        "createdAt",
        "rating",
        "helpfulCount",
        "reportCount",
      ] as const;
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

    // GESTIONE RATING (SINGOLO O ARRAY)
    if (query.rating) {
      if (Array.isArray(query.rating)) {
        const ratings = query.rating
          .map((r) => parseInt(r))
          .filter((r) => r >= 1 && r <= 5);
        if (ratings.length > 0) {
          parsed.rating = ratings;
        }
      } else {
        const rating = parseInt(query.rating);
        if (rating >= 1 && rating <= 5) {
          parsed.rating = rating;
        }
      }
    }

    // GESTIONE BOOLEAN FILTERS
    if (query.isVerified !== undefined) {
      parsed.isVerified = query.isVerified === "true";
    }

    if (query.isApproved !== undefined) {
      parsed.isApproved = query.isApproved === "true";
    }

    if (query.isPinned !== undefined) {
      parsed.isPinned = query.isPinned === "true";
    }

    // GESTIONE STRING FILTERS
    if (query.productId) {
      parsed.productId = query.productId;
    }

    if (query.userId) {
      parsed.userId = query.userId;
    }

    if (query.customerEmail) {
      parsed.customerEmail = query.customerEmail;
    }

    // GESTIONE DATE FILTERS
    if (query.startDate) {
      const date = new Date(query.startDate);
      if (!isNaN(date.getTime())) {
        parsed.startDate = date;
      }
    }

    if (query.endDate) {
      const date = new Date(query.endDate);
      if (!isNaN(date.getTime())) {
        parsed.endDate = date;
      }
    }

    return parsed;
  }

  // VALIDA SE L'UTENTE È AUTENTICATO
  private static isAuthenticated(
    req: FlexibleRequest
  ): req is FlexibleRequest & { user: UserProfile } {
    return req.user !== undefined;
  }

  // VALIDA SE L'UTENTE È ADMIN

  private static isAdmin(
    req: FlexibleRequest
  ): req is FlexibleRequest & { user: UserProfile & { role: "ADMIN" } } {
    return req.user !== undefined && req.user.role === UserRole.ADMIN;
  }
}
