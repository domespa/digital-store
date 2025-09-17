import { PrismaClient, Prisma } from "../generated/prisma";
import {
  ReviewData,
  CreateReviewRequest,
  UpdateReviewRequest,
  AdminUpdateReviewRequest,
  ReviewFilters,
  ReviewListQuery,
  ReviewStats,
  ProductReviewStats,
  CreateReportRequest,
  HandleReportRequest,
  ModerationAction,
  ReportReason,
  ReportStatus,
  ReviewAnalytics,
  BulkReviewOperation,
  GuestReviewData,
  ReviewError,
  ModerationError,
} from "../types/review";
import { UserProfile } from "../types/auth";
import { CustomError } from "../utils/customError";
import { profanityFilter } from "../utils/profanityFilter";

const prisma = new PrismaClient();

// TIPO PER TRANSAZIONI PRISMA
type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// CONFIGURAZIONE SISTEMA RECENSIONI
const REVIEW_CONFIG = {
  AUTO_APPROVE_VERIFIED_USERS: true,
  AUTO_APPROVE_GUESTS: false,
  REQUIRE_PURCHASE_FOR_REVIEW: false,
  ENABLE_PROFANITY_FILTER: true,
} as const;

export class ReviewService {
  // CREA UNA NUOVA RECENSIONE PER UTENTE AUTENTICATO
  static async createReview(
    userId: string,
    reviewData: CreateReviewRequest
  ): Promise<ReviewData> {
    const { productId, rating, title, content, orderId } = reviewData;

    // VALIDA RATING
    if (rating < 1 || rating > 5) {
      throw new ReviewError("Il rating deve essere tra 1 e 5", 400);
    }

    // CONTROLLA SE L'UTENTE HA GIÀ RECENSITO QUESTO PRODOTTO
    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        productId,
      },
    });

    if (existingReview) {
      throw new ReviewError("Hai già recensito questo prodotto", 400);
    }

    // CONTROLLA SE IL PRODOTTO ESISTE
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new ReviewError("Prodotto non trovato", 404);
    }

    // OTTIENI DATI UTENTE PER CUSTOMER FIELDS
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ReviewError("Utente non trovato", 404);
    }

    // VERIFICA ACQUISTO - QUERY UNIFICATA PER MIGLIORI PERFORMANCE
    const verificationResult = await this.verifyPurchaseForUser(
      userId,
      productId,
      orderId
    );

    // VALIDAZIONE E FILTRAGGIO CONTENUTO
    const filteredTitle = this.cleanContent(title);
    const filteredContent = this.cleanContent(content);

    // LOGICA APPROVAZIONE: Auto-approva acquisti verificati se configurato
    const isApproved =
      REVIEW_CONFIG.AUTO_APPROVE_VERIFIED_USERS &&
      verificationResult.isVerified;

    // CREA RECENSIONE IN TRANSAZIONE
    const review = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const newReview = await tx.review.create({
        data: {
          userId,
          productId,
          orderId: verificationResult.orderId,
          rating,
          title: filteredTitle,
          content: filteredContent,
          customerEmail: user.email,
          customerName: `${user.firstName} ${user.lastName}`,
          isVerified: verificationResult.isVerified,
          isApproved,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      // AGGIORNA AGGREGAZIONI RATING PRODOTTO SOLO SE APPROVATA
      if (isApproved) {
        await this.updateProductRatingAggregation(tx, productId);
      }

      return newReview;
    });

    return this.mapPrismaToReviewData(review);
  }
  // CREA UNA NUOVA RECENSIONE PER OSPITE
  static async createGuestReview(
    reviewData: GuestReviewData
  ): Promise<ReviewData> {
    const { productId, rating, title, content, customerEmail, customerName } =
      reviewData;

    // VALIDA RATING
    if (rating < 1 || rating > 5) {
      throw new ReviewError("Il rating deve essere tra 1 e 5", 400);
    }

    // CONTROLLA SE L'OSPITE HA GIÀ RECENSITO (STESSO EMAIL + PRODOTTO)
    const existingReview = await prisma.review.findFirst({
      where: {
        customerEmail,
        productId,
        userId: null, // SOLO RECENSIONI OSPITI
      },
    });

    if (existingReview) {
      throw new ReviewError(
        "Hai già recensito questo prodotto con questa email",
        400
      );
    }

    // CONTROLLA SE IL PRODOTTO ESISTE
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new ReviewError("Prodotto non trovato", 404);
    }

    // VERIFICA SE L'OSPITE HA ACQUISTATO (STESSA EMAIL)
    const verificationResult = await this.verifyPurchaseForGuest(
      customerEmail,
      productId
    );

    // VALIDAZIONE E FILTRAGGIO CONTENUTO (INCLUSO NOME CLIENTE)
    const filteredTitle = this.cleanContent(title);
    const filteredContent = this.cleanContent(content);
    const filteredCustomerName =
      this.cleanContent(customerName) || customerName;

    // POLICY
    const isApproved =
      REVIEW_CONFIG.AUTO_APPROVE_GUESTS && verificationResult.isVerified;

    // CREA RECENSIONE IN TRANSAZIONE
    const review = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const newReview = await tx.review.create({
        data: {
          userId: null,
          productId,
          orderId: verificationResult.orderId,
          rating,
          title: filteredTitle,
          content: filteredContent,
          customerEmail,
          customerName: filteredCustomerName,
          isVerified: verificationResult.isVerified,
          isApproved,
        },
      });

      // AGGIORNA AGGREGAZIONI RATING PRODOTTO SOLO SE APPROVATA
      if (isApproved) {
        await this.updateProductRatingAggregation(tx, productId);
      }

      return newReview;
    });

    return this.mapPrismaToReviewData(review);
  }

  // AGGIORNA UNA RECENSIONE (L'UTENTE PUÒ AGGIORNARE SOLO LA PROPRIA)
  static async updateReview(
    userId: string,
    reviewId: string,
    updateData: UpdateReviewRequest
  ): Promise<ReviewData> {
    const { rating, title, content } = updateData;

    // TROVA E VALIDA PROPRIETÀ
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      throw new ReviewError("Recensione non trovata", 404);
    }

    if (existingReview.userId !== userId) {
      throw new ReviewError("Puoi modificare solo le tue recensioni", 403);
    }

    // VALIDA RATING SE FORNITO
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      throw new ReviewError("Il rating deve essere tra 1 e 5", 400);
    }

    // FILTRAGGIO CONTENUTO
    const filteredTitle = this.cleanContent(title);
    const filteredContent = this.cleanContent(content);

    // DETERMINA SE SERVE NUOVA MODERAZIONE
    const needsRemoderation = this.requiresRemoderation(existingReview, {
      title,
      content,
    });

    // AGGIORNA RECENSIONE IN TRANSAZIONE
    const review = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const updatedReview = await tx.review.update({
        where: { id: reviewId },
        data: {
          ...(rating !== undefined && { rating }),
          ...(filteredTitle !== undefined && { title: filteredTitle }),
          ...(filteredContent !== undefined && { content: filteredContent }),
          // LOGICA APPROVAZIONE MIGLIORATA
          isApproved: needsRemoderation ? false : existingReview.isApproved,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      // AGGIORNA RATING PRODOTTO SE RATING CAMBIATO O APPROVAZIONE CAMBIATA
      if (
        (rating !== undefined && rating !== existingReview.rating) ||
        (needsRemoderation && existingReview.isApproved)
      ) {
        await this.updateProductRatingAggregation(tx, existingReview.productId);
      }

      return updatedReview;
    });

    return this.mapPrismaToReviewData(review);
  }

  // ADMIN AGGIORNA RECENSIONE
  static async adminUpdateReview(
    moderatorId: string,
    reviewId: string,
    updateData: AdminUpdateReviewRequest
  ): Promise<ReviewData> {
    const { isApproved, isPinned, moderatorNotes } = updateData;

    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      throw new ReviewError("Recensione non trovata", 404);
    }

    const review = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const updatedReview = await tx.review.update({
        where: { id: reviewId },
        data: {
          ...(isApproved !== undefined && { isApproved }),
          ...(isPinned !== undefined && { isPinned }),
          ...(moderatorNotes !== undefined && { moderatorNotes }),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      // REGISTRA AZIONE MODERAZIONE
      const action = this.determineModerationAction(
        { isApproved, isPinned },
        existingReview
      );

      await tx.reviewModerationLog.create({
        data: {
          reviewId,
          moderatorId,
          action,
          notes: moderatorNotes,
        },
      });

      // AGGIORNA AGGREGAZIONE PRODOTTO SE APPROVAZIONE CAMBIATA
      if (
        isApproved !== undefined &&
        isApproved !== existingReview.isApproved
      ) {
        await this.updateProductRatingAggregation(tx, existingReview.productId);
      }

      return updatedReview;
    });

    return this.mapPrismaToReviewData(review);
  }

  //  ELIMINA UNA RECENSIONE
  static async deleteReview(userId: string, reviewId: string): Promise<void> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError("Recensione non trovata", 404);
    }

    if (review.userId !== userId) {
      throw new ReviewError("Puoi eliminare solo le tue recensioni", 403);
    }

    await prisma.$transaction(async (tx: PrismaTransaction) => {
      await tx.review.delete({
        where: { id: reviewId },
      });

      await this.updateProductRatingAggregation(tx, review.productId);
    });
  }

  // ADMIN ELIMINA RECENSIONE
  static async adminDeleteReview(
    moderatorId: string,
    reviewId: string,
    reason?: string
  ): Promise<void> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError("Recensione non trovata", 404);
    }

    await prisma.$transaction(async (tx: PrismaTransaction) => {
      await tx.review.delete({
        where: { id: reviewId },
      });

      // REGISTRA ELIMINAZIONE
      await tx.reviewModerationLog.create({
        data: {
          reviewId,
          moderatorId,
          action: ModerationAction.DELETED,
          reason,
          notes: "Recensione eliminata da admin",
        },
      });

      await this.updateProductRatingAggregation(tx, review.productId);
    });
  }

  // OTTIENI RECENSIONI CON FILTRI E PAGINAZIONE
  static async getReviews(query: ReviewListQuery) {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      ...filters
    } = query;

    const skip = (page - 1) * limit;

    // COSTRUISCI CLAUSOLA WHERE
    const where = {
      ...this.buildReviewFilters(filters),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
          { customerName: { contains: search, mode: "insensitive" as const } },
          { customerEmail: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              createdAt: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // OTTIENI RECENSIONI PRODOTTO
  static async getProductReviews(
    productId: string,
    query: Omit<ReviewListQuery, "productId">
  ) {
    return this.getReviews({ ...query, productId, isApproved: true });
  }

  // OTTIENI RECENSIONI UTENTE
  static async getUserReviews(
    userId: string,
    query: Omit<ReviewListQuery, "userId">
  ) {
    return this.getReviews({ ...query, userId });
  }

  // VOTA UTILE SU RECENSIONE (UTENTE AUTENTICATO)
  static async voteHelpful(
    userId: string,
    reviewId: string,
    isHelpful: boolean
  ): Promise<void> {
    // CONTROLLA SE RECENSIONE ESISTE
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError("Recensione non trovata", 404);
    }

    if (review.userId === userId) {
      throw new ReviewError("Non puoi votare la tua recensione", 400);
    }

    await prisma.$transaction(async (tx: PrismaTransaction) => {
      // UPSERT VOTO
      await tx.reviewHelpfulVote.upsert({
        where: {
          unique_user_review_vote: {
            userId,
            reviewId,
          },
        },
        update: {
          isHelpful,
        },
        create: {
          userId,
          reviewId,
          isHelpful,
        },
      });

      // CALCOLA E AGGIORNA CONTEGGIO IN UN'UNICA OPERAZIONE
      const helpfulCount = await tx.reviewHelpfulVote.count({
        where: {
          reviewId,
          isHelpful: true,
        },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: { helpfulCount },
      });
    });
  }

  // VOTA UTILE SU RECENSIONE (ANONIMO CON IP)
  static async voteHelpfulAnonymous(
    ipAddress: string,
    reviewId: string,
    isHelpful: boolean
  ): Promise<void> {
    // CONTROLLA SE RECENSIONE ESISTE
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError("Recensione non trovata", 404);
    }

    await prisma.$transaction(async (tx: PrismaTransaction) => {
      // UPSERT VOTO CON IP
      await tx.reviewHelpfulVote.upsert({
        where: {
          unique_ip_review_vote: {
            ipAddress,
            reviewId,
          },
        },
        update: {
          isHelpful,
        },
        create: {
          userId: null,
          reviewId,
          isHelpful,
          ipAddress,
        },
      });

      // CALCOLA E AGGIORNA CONTEGGIO IN UN'UNICA OPERAZIONE
      const helpfulCount = await tx.reviewHelpfulVote.count({
        where: {
          reviewId,
          isHelpful: true,
        },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: { helpfulCount },
      });
    });
  }

  // SEGNALA UNA RECENSIONE (UTENTE AUTENTICATO)
  static async reportReview(
    userId: string,
    reportData: CreateReportRequest
  ): Promise<void> {
    const { reviewId, reason, description } = reportData;

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError("Recensione non trovata", 404);
    }

    const existingReport = await prisma.reviewReport.findFirst({
      where: {
        userId,
        reviewId,
      },
    });

    if (existingReport) {
      throw new ReviewError("Hai già segnalato questa recensione", 400);
    }

    await prisma.$transaction(async (tx: PrismaTransaction) => {
      await tx.reviewReport.create({
        data: {
          userId,
          reviewId,
          reason,
          description,
        },
      });

      const reportCount = await tx.reviewReport.count({
        where: { reviewId },
      });

      await tx.review.update({
        where: { id: reviewId },
        data: { reportCount },
      });
    });
  }

  // CONTROLLA SE UTENTE PUÒ RECENSIRE UN PRODOTTO
  static async canUserReview(
    userId: string,
    productId: string
  ): Promise<boolean> {
    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        productId,
      },
    });

    if (existingReview) {
      return false;
    }

    // SE NON È RICHIESTO L'ACQUISTO, PERMETTI SEMPRE
    if (!REVIEW_CONFIG.REQUIRE_PURCHASE_FOR_REVIEW) {
      return true;
    }

    const purchase = await prisma.order.findFirst({
      where: {
        userId,
        status: "COMPLETED",
        orderItems: {
          some: {
            productId,
          },
        },
      },
    });

    return !!purchase;
  }

  // OTTIENI RECENSIONI PENDING PER MODERAZIONE
  static async getPendingReviews(page = 1, limit = 20) {
    return this.getReviews({
      page,
      limit,
      isApproved: false,
      sortBy: "createdAt",
      sortOrder: "asc",
    });
  }

  // ==================== METODI HELPER PRIVATI ====================
  // VERIFICA ACQUISTO PER UTENTE AUTENTICATO
  private static async verifyPurchaseForUser(
    userId: string,
    productId: string,
    orderId?: string
  ): Promise<{ isVerified: boolean; orderId: string | null }> {
    const whereClause = {
      userId,
      status: "COMPLETED" as const,
      orderItems: {
        some: {
          productId,
        },
      },
      ...(orderId && { id: orderId }),
    };

    const order = await prisma.order.findFirst({
      where: whereClause,
    });

    return {
      isVerified: !!order,
      orderId: order?.id || null,
    };
  }

  // VERIFICA ACQUISTO PER OSPITE
  private static async verifyPurchaseForGuest(
    customerEmail: string,
    productId: string
  ): Promise<{ isVerified: boolean; orderId: string | null }> {
    const order = await prisma.order.findFirst({
      where: {
        customerEmail,
        status: "COMPLETED",
        orderItems: {
          some: {
            productId,
          },
        },
      },
    });

    return {
      isVerified: !!order,
      orderId: order?.id || null,
    };
  }

  // PULISCI CONTENUTO CON FILTRO PROFANITY
  private static cleanContent(content?: string): string | undefined {
    if (!content) return undefined;

    return REVIEW_CONFIG.ENABLE_PROFANITY_FILTER
      ? profanityFilter.clean(content)
      : content;
  }

  private static requiresRemoderation(
    existingReview: { title: string | null; content: string | null },
    updates: { title?: string; content?: string }
  ): boolean {
    // Se cambiano contenuti testuali significativi, richiedi moderazione
    const titleChanged =
      updates.title !== undefined && updates.title !== existingReview.title;
    const contentChanged =
      updates.content !== undefined &&
      updates.content !== existingReview.content;

    return titleChanged || contentChanged;
  }

  // DETERMINA AZIONE DI MODERAZIONE BASATA SU CAMBIAMENTI
  private static determineModerationAction(
    updates: { isApproved?: boolean; isPinned?: boolean },
    existingReview: { isApproved: boolean; isPinned: boolean }
  ): ModerationAction {
    const { isApproved, isPinned } = updates;

    if (isApproved !== undefined && isApproved !== existingReview.isApproved) {
      return isApproved ? ModerationAction.APPROVED : ModerationAction.REJECTED;
    }

    if (isPinned !== undefined && isPinned !== existingReview.isPinned) {
      return isPinned ? ModerationAction.PINNED : ModerationAction.UNPINNED;
    }

    return ModerationAction.EDITED;
  }

  // AGGIORNA AGGREGAZIONE RATING PRODOTTO
  private static async updateProductRatingAggregation(
    tx: PrismaTransaction,
    productId: string
  ): Promise<void> {
    const [reviewStats, ratingDistribution] = await Promise.all([
      tx.review.aggregate({
        where: {
          productId,
          isApproved: true,
        },
        _count: { id: true },
        _avg: { rating: true },
      }),

      tx.review.groupBy({
        by: ["rating"],
        where: {
          productId,
          isApproved: true,
        },
        _count: { rating: true },
      }),
    ]);

    // COSTRUISCI DISTRIBUZIONE RATING PERCENTUALI
    const total = reviewStats._count.id;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (total > 0) {
      ratingDistribution.forEach(({ rating, _count }) => {
        const percentage = Math.round((_count.rating / total) * 100);
        distribution[rating as keyof typeof distribution] = percentage;
      });
    }

    await tx.product.update({
      where: { id: productId },
      data: {
        reviewCount: total,
        averageRating: reviewStats._avg.rating || 0,
        // AGGIORNA ANCHE IL CAMPO rating ESISTENTE PER COMPATIBILITÀ
        rating: reviewStats._avg.rating || 0,
        ratingDistribution: distribution,
      },
    });
  }
  // COSTRUISCI FILTRI PER QUERY RECENSIONI
  private static buildReviewFilters(filters: ReviewFilters) {
    const where: Record<string, unknown> = {};

    if (filters.rating !== undefined) {
      if (Array.isArray(filters.rating)) {
        where.rating = { in: filters.rating };
      } else {
        where.rating = filters.rating;
      }
    }

    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }

    if (filters.isApproved !== undefined) {
      where.isApproved = filters.isApproved;
    }

    if (filters.isPinned !== undefined) {
      where.isPinned = filters.isPinned;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.customerEmail) {
      where.customerEmail = filters.customerEmail;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, unknown>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, unknown>).lte = filters.endDate;
      }
    }

    return where;
  }

  //  MAPPA IL RISULTATO PRISMA AL TIPO REVIEWDATA
  private static mapPrismaToReviewData(
    review:
      | Prisma.ReviewGetPayload<{
          include: {
            user: {
              select: {
                id: true;
                email: true;
                firstName: true;
                lastName: true;
                role: true;
                createdAt: true;
              };
            };
          };
        }>
      | Prisma.ReviewGetPayload<{}>
  ): ReviewData {
    return {
      id: review.id,
      rating: review.rating,
      title: review.title ?? undefined,
      content: review.content ?? undefined,
      isVerified: review.isVerified,
      isApproved: review.isApproved,
      isPinned: review.isPinned,
      helpfulCount: review.helpfulCount,
      reportCount: review.reportCount,
      moderatorNotes: review.moderatorNotes ?? undefined,
      userId: review.userId ?? undefined,
      productId: review.productId,
      orderId: review.orderId ?? undefined,
      customerEmail: review.customerEmail,
      customerName: review.customerName,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user:
        "user" in review && review.user
          ? {
              id: review.user.id,
              email: review.user.email,
              firstName: review.user.firstName,
              lastName: review.user.lastName,
              role: review.user.role,
              createdAt: review.user.createdAt,
              emailVerified: false,
            }
          : undefined,
    };
  }
}
