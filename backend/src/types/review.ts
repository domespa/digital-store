import { Request } from "express";
import { UserRole } from "../generated/prisma";
import { UserProfile, AuthenticatedRequest } from "./auth";

// INTERFACCIA DATI RECENSIONE COMPLETA
export interface ReviewData {
  id: string;
  rating: number;
  title?: string;
  content?: string;
  isVerified: boolean;
  isApproved: boolean;
  isPinned: boolean;
  helpfulCount: number;
  reportCount: number;
  moderatorNotes?: string;
  userId?: string; // OPZIONALE PER OSPITI
  productId: string;
  orderId?: string;
  customerEmail: string; // PER OSPITI
  customerName: string; // PER OSPITI
  createdAt: Date;
  updatedAt: Date;
  user?: UserProfile; // USA IL TUO USERPROFILE ESISTENTE
}

// RICHIESTA CREAZIONE RECENSIONE (SUPPORTA SIA UTENTI CHE OSPITI)
export interface CreateReviewRequest {
  rating: number;
  title?: string;
  content?: string;
  productId: string;
  orderId?: string;
  // CAMPI PER OSPITI (OPZIONALI SE UTENTE È AUTENTICATO)
  customerEmail?: string;
  customerName?: string;
}

// RICHIESTA AGGIORNAMENTO RECENSIONE
export interface UpdateReviewRequest {
  rating?: number;
  title?: string;
  content?: string;
}

// RICHIESTA ADMIN PER MODERAZIONE
export interface AdminUpdateReviewRequest {
  isApproved?: boolean;
  isPinned?: boolean;
  moderatorNotes?: string;
}

// FILTRI RECENSIONI
export interface ReviewFilters {
  rating?: number | number[];
  isVerified?: boolean;
  isApproved?: boolean;
  isPinned?: boolean;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  productId?: string;
  customerEmail?: string; // PER FILTRARE RECENSIONI OSPITI
}

// OPZIONI ORDINAMENTO
export interface ReviewSortOptions {
  sortBy?: "createdAt" | "rating" | "helpfulCount" | "reportCount";
  sortOrder?: "asc" | "desc";
}

// QUERY COMPLETA CON PAGINAZIONE
export interface ReviewListQuery extends ReviewFilters, ReviewSortOptions {
  page?: number;
  limit?: number;
  search?: string;
}

// STATISTICHE RECENSIONI
export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  verifiedReviews: number;
  guestReviews: number;
  pendingReviews: number;
  reportedReviews: number;
}

// STATISTICHE SPECIFICHE PRODOTTO
export interface ProductReviewStats extends ReviewStats {
  productId: string;
  recentReviews: ReviewData[];
  topReviews: ReviewData[];
  pinnedReviews: ReviewData[];
}

// VOTO UTILE SU RECENSIONE
export interface ReviewHelpfulVote {
  id: string;
  userId?: string; // OPZIONALE PER OSPITI
  reviewId: string;
  isHelpful: boolean;
  ipAddress?: string; // PER VOTI ANONIMI
  createdAt: Date;
  user?: UserProfile; // USA IL TUO USERPROFILE
}

// SEGNALAZIONE RECENSIONE
export interface ReviewReport {
  id: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  userId?: string; // OPZIONALE PER OSPITI
  reviewId: string;
  reporterEmail?: string; // PER SEGNALAZIONI ANONIME
  reporterName?: string; // PER SEGNALAZIONI ANONIME
  handledBy?: string;
  handledAt?: Date;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: UserProfile; // USA IL TUO USERPROFILE
  handler?: UserProfile; // USA IL TUO USERPROFILE
}

// RICHIESTA SEGNALAZIONE
export interface CreateReportRequest {
  reviewId: string;
  reason: ReportReason;
  description?: string;
  reporterEmail?: string; // PER SEGNALAZIONI ANONIME
  reporterName?: string; // PER SEGNALAZIONI ANONIME
}

// GESTIONE SEGNALAZIONE DA ADMIN
export interface HandleReportRequest {
  status: ReportStatus;
  adminNotes?: string;
}

// LOG MODERAZIONE
export interface ModerationLogEntry {
  id: string;
  action: ModerationAction;
  reason?: string;
  notes?: string;
  reviewId: string;
  moderatorId: string;
  createdAt: Date;
  moderator: UserProfile; // USA IL TUO USERPROFILE
}

// REQUEST ESTESO PER RECENSIONI (SUPPORTA SIA AUTH CHE GUEST)
export interface ReviewRequest extends Request {
  user?: UserProfile & { emailVerified: boolean };
  body: CreateReviewRequest | UpdateReviewRequest | AdminUpdateReviewRequest;
}

// INTERFACCIA SEPARATA PER ADMIN USER
export interface AdminUserProfile extends UserProfile {
  role: typeof UserRole.ADMIN;
  emailVerified: boolean; // CORREZIONE: USA typeof PER IL TYPE ENUM
}

// REQUEST PER ADMIN (SEMPRE AUTENTICATO) - CORRETTO
export interface AdminReviewRequest extends AuthenticatedRequest {
  user: AdminUserProfile; // USA L'INTERFACCIA SEPARATA
  body: AdminUpdateReviewRequest | HandleReportRequest;
}

// ANALYTICS RECENSIONI PER ADMIN
export interface ReviewAnalytics {
  totalReviews: number;
  reviewsThisMonth: number;
  reviewsLastMonth: number;
  averageRating: number;
  averageRatingThisMonth: number;
  averageRatingLastMonth: number;
  guestReviews: number;
  verifiedReviews: number;
  topRatedProducts: Array<{
    productId: string;
    productName: string;
    averageRating: number;
    reviewCount: number;
  }>;
  mostActiveReviewers: Array<{
    userId?: string;
    userEmail?: string;
    customerEmail?: string; // PER OSPITI
    reviewCount: number;
    averageRating: number;
    userProfile?: UserProfile; // USA IL TUO USERPROFILE
  }>;
  moderationStats: {
    pendingReviews: number;
    approvedReviews: number;
    rejectedReviews: number;
    reportedReviews: number;
  };
}

// ENUM PER SEGNALAZIONI
export enum ReportReason {
  SPAM = "SPAM",
  INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT",
  FAKE_REVIEW = "FAKE_REVIEW",
  OFFENSIVE_LANGUAGE = "OFFENSIVE_LANGUAGE",
  IRRELEVANT = "IRRELEVANT",
  COPYRIGHT_VIOLATION = "COPYRIGHT_VIOLATION",
  OTHER = "OTHER",
}

// ENUM STATUS SEGNALAZIONI
export enum ReportStatus {
  PENDING = "PENDING",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED = "RESOLVED",
  DISMISSED = "DISMISSED",
}

// ENUM AZIONI MODERAZIONE
export enum ModerationAction {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PINNED = "PINNED",
  UNPINNED = "UNPINNED",
  EDITED = "EDITED",
  DELETED = "DELETED",
  RESTORED = "RESTORED",
}

// VALIDAZIONI BUSINESS LOGIC
export interface ReviewValidation {
  canUserReview: (
    userId: string | null,
    productId: string,
    customerEmail?: string
  ) => Promise<boolean>;
  hasUserPurchased: (
    userId: string | null,
    productId: string,
    customerEmail?: string
  ) => Promise<boolean>;
  isReviewContentValid: (content: string) => boolean;
  isRatingValid: (rating: number) => boolean;
}

// OPERAZIONI BULK ADMIN
export interface BulkReviewOperation {
  reviewIds: string[];
  action: "approve" | "reject" | "delete" | "pin" | "unpin";
  reason?: string;
  notes?: string;
}

// HELPER TYPES PER UTENTI VS OSPITI
export interface AuthenticatedReviewData extends CreateReviewRequest {
  userId: string; // SEMPRE PRESENTE PER UTENTI AUTENTICATI
  user: UserProfile;
}

export interface GuestReviewData extends CreateReviewRequest {
  customerEmail: string; // SEMPRE PRESENTE PER OSPITI
  customerName: string; // SEMPRE PRESENTE PER OSPITI
}

// ERRORI SPECIFICI PER RECENSIONI
export class ReviewError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number = 400, code?: string) {
    super(message);
    this.name = "ReviewError";
    this.status = status;
    this.code = code;
  }
}

// ERRORI SPECIFICI MODERAZIONE
export class ModerationError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number = 403, code?: string) {
    super(message);
    this.name = "ModerationError";
    this.status = status;
    this.code = code;
  }
}

// UTILITY TYPE GUARDS
export const isAuthenticatedUser = (
  req: ReviewRequest
): req is ReviewRequest & { user: UserProfile } => {
  return req.user !== undefined;
};

export const isAdmin = (user: UserProfile): user is AdminUserProfile => {
  return user.role === UserRole.ADMIN;
};

export const isGuestReview = (
  data: CreateReviewRequest
): data is GuestReviewData => {
  return !!(data.customerEmail && data.customerName);
};

// CONFIGURAZIONE REVIEW SYSTEM
export interface ReviewSystemConfig {
  autoApproveVerified: boolean;
  requirePurchaseForReview: boolean;
  allowGuestReviews: boolean;
  maxReviewLength: number;
  maxTitleLength: number;
  profanityFilterEnabled: boolean;
  rateLimitEnabled: boolean;
}
