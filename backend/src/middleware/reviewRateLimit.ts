import rateLimit from "express-rate-limit";
import { Request } from "express";
import { CustomError } from "../utils/customError";
import { UserProfile } from "../types/auth";

// INTERFACCIA PER REQUEST CON USER OPZIONALE
interface RequestWithUser extends Request {
  user?: UserProfile;
}

// CONFIGURAZIONE RATE LIMITING PER ENDPOINT RELATIVI ALLE RECENSIONI
// PREVIENE SPAM E ABUSI PERMETTENDO UTILIZZO LEGITTIMO
export const reviewRateLimit = {
  createReview: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ORA
    max: 5, // 5 RECENSIONI ALL'ORA
    message: {
      success: false,
      message: "Too many reviews created. Please try again in an hour.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError(
        "Too many reviews created. Please try again later.",
        429
      );
    },
  }),

  updateReview: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ORA
    max: 10, // 10 AGGIORNAMENTI ALL'ORA
    message: {
      success: false,
      message: "Too many review updates. Please try again in an hour.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError(
        "Too many review updates. Please try again later.",
        429
      );
    },
  }),

  voteReview: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ORA
    max: 50, // 50 VOTI ALL'ORA
    message: {
      success: false,
      message: "Too many votes. Please try again in an hour.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError("Too many votes. Please try again later.", 429);
    },
  }),

  reportReview: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ORA
    max: 10, // 10 SEGNALAZIONI ALL'ORA
    message: {
      success: false,
      message: "Too many reports. Please try again in an hour.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError("Too many reports. Please try again later.", 429);
    },
  }),

  readReviews: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 MINUTI
    max: 100, // 100 RICHIESTE PER 15 MINUTI
    message: {
      success: false,
      message: "Too many requests. Please try again in 15 minutes.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError("Too many requests. Please try again later.", 429);
    },
  }),

  adminBulkOperations: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ORA
    max: 5, // 5 OPERAZIONI BULK ALL'ORA
    message: {
      success: false,
      message: "Too many bulk operations. Please try again in an hour.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError(
        "Too many bulk operations. Please try again later.",
        429
      );
    },
  }),

  adminModeration: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ORA
    max: 100, // 100 AZIONI MODERAZIONE ALL'ORA
    message: {
      success: false,
      message: "Too many moderation actions. Please try again in an hour.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError(
        "Too many moderation actions. Please try again later.",
        429
      );
    },
  }),

  anonymousReviews: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 MINUTI
    max: 20, // 20 RICHIESTE PER 15 MINUTI
    message: {
      success: false,
      message: "Too many requests. Please try again in 15 minutes.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: RequestWithUser) => {
      // SALTA RATE LIMITING SE UTENTE È AUTENTICATO
      return !!req.user;
    },
    handler: (req, res) => {
      throw new CustomError("Too many requests. Please try again later.", 429);
    },
  }),

  checkEligibility: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 MINUTI
    max: 30, // 30 CONTROLLI PER 15 MINUTI
    message: {
      success: false,
      message: "Too many eligibility checks. Please try again in 15 minutes.",
      error: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError(
        "Too many eligibility checks. Please try again later.",
        429
      );
    },
  }),

  guestReviews: rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 ORE
    max: 2, // 2 RECENSIONI AL GIORNO PER IP
    message: {
      success: false,
      message:
        "Too many guest reviews. Please try again tomorrow or create an account.",
      error: "GUEST_RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: RequestWithUser) => {
      // SALTA RATE LIMITING SE UTENTE È AUTENTICATO
      return !!req.user;
    },
    handler: (req, res) => {
      throw new CustomError(
        "Too many guest reviews. Please create an account for unlimited reviews.",
        429
      );
    },
  }),

  globalLimit: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 MINUTI
    max: 500, // 500 RICHIESTE PER 15 MINUTI
    message: {
      success: false,
      message: "Too many requests. Please try again in 15 minutes.",
      error: "GLOBAL_RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError(
        "Rate limit exceeded. Please try again later.",
        429
      );
    },
  }),

  premiumUsers: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ORA
    max: 20, // 20 RECENSIONI ALL'ORA PER UTENTI PREMIUM
    message: {
      success: false,
      message: "Premium rate limit exceeded. Please try again in an hour.",
      error: "PREMIUM_RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: RequestWithUser) => {
      return true;
    },
    handler: (req, res) => {
      throw new CustomError(
        "Premium rate limit exceeded. Please try again later.",
        429
      );
    },
  }),
};

// UTILITY HELPER PER RATE LIMITING DINAMICO
export const createDynamicRateLimit = (
  getMaxRequests: (req: RequestWithUser) => number,
  windowMs: number = 60 * 60 * 1000, // DEFAULT 1 ORA
  message: string = "Rate limit exceeded"
) => {
  return rateLimit({
    windowMs,
    max: (req: RequestWithUser) => getMaxRequests(req),
    message: {
      success: false,
      message,
      error: "DYNAMIC_RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new CustomError(message, 429);
    },
  });
};

// CONFIGURAZIONI PREDEFINITE PER DIVERSI TIPI DI UTENTE
export const userTypeRateLimits = {
  // UTENTI NON AUTENTICATI (OSPITI)
  anonymous: {
    reviews: 2,
    votes: 10,
    reports: 3,
  },

  // UTENTI REGISTRATI NORMALI
  user: {
    reviews: 5,
    votes: 50,
    reports: 10,
  },

  // UTENTI VERIFICATI (HANNO ACQUISTATO)
  verified: {
    reviews: 10,
    votes: 100,
    reports: 15,
  },

  // ADMIN/MODERATORI
  admin: {
    reviews: 100,
    votes: 1000,
    reports: 100,
    moderation: 100,
    bulk: 5,
  },
};
