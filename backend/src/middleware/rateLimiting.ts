import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";
import slowDown from "express-slow-down";

// ===========================================
//            GENERAL RATE LIMITING
// ===========================================

// RATE LIMITING PER TUTTE LE CHIAMATE
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Massimo 100 richieste per finestra
  keyGenerator: ipKeyGenerator as unknown as (req: Request) => string,

  message: {
    success: false,
    error: "Too many requests, try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===========================================
//         AUTHENTICATION RATE LIMITS
// ===========================================

// RATE PER AUTENTICAZIONE
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // MASSIMO 5 TENTATIVI OGNI 15 MINUTI
  message: {
    success: false,
    error: "Too many authentication attempts, try again in 15 minutes.",
  },
  // SE IL TENTATIVO VA A BUON FINE NON CONTIAMOLO
  skipSuccessfulRequests: true,
});

// RATE PER REGISTRAZIONE
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // Massimo 3 registrazioni per ora
  message: {
    success: false,
    error: "Too many registration attempts, try again in 1 hour.",
  },
});

// RATE PER PASSWORD RESET
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 5, // Massimo 5 reset per ora
  message: {
    success: false,
    error: "Too many password reset attempts, please try again in 1 hour.",
  },
});

// ===========================================
//           BUSINESS LOGIC LIMITS
// ===========================================

// RATE LIMIT PER ORDINI - EVITIAMO SPAM
export const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minuti
  max: 10, // Massimo 10 ordini ogni 5 minuti
  message: {
    success: false,
    error: "Too many order attempts, please slow down.",
  },
});

// ===========================================
//             SPEED CONTROL
// ===========================================

// SLOWDOWN INVECE DI BLOCCARE COMPLETAMENTE
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minuti
  delayAfter: 50, // RALLENTA DOPO 50 RICHIESTE
  delayMs: () => 500, // MEZZO SECONDO DI RITARDO PER OGNI RICHIESTA EXTRA
  maxDelayMs: 20000, // MASSIMO 20 SECONDI
  validate: { delayMs: false },
});

// ===========================================
//      NOTIFICATION RATE LIMITS
// ===========================================
// NOTIFICHE GENERALI
export const notificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: "Too many notification requests, try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ADMIN NOTIFICHE
export const adminNotificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: "Too many admin notification requests, try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// BULK NOTIFICATIONS
export const bulkNotificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: "Too many bulk notification requests, try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// MARK AS READ
export const markReadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: "Too many mark read requests, slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// TEST NOTIFICATIONS ADMIN
export const testNotificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: "Too many test notification requests, try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
