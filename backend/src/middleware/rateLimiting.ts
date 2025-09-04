import { error } from "console";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

// RATE LIMITING PER TUTTE LE CHIAMATE
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: "Too many requests, try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// RATE PER AUTENTIFICAZIONE
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // MASSIMO 5 TENTATIVI OGNI 15 MINUTI,
  message: {
    success: false,
    error: "Too many authentication attemps, try again in 15 minutes.",
  },
  // SE IL TENTATIVO VA A BUON FINE NON CONTIAMOLO
  skipSuccessfulRequests: true,
});

// RATE PER REGISTRAZIONE
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: "Too many registration attemps, try again in 1 hour.",
  },
});

// RATE PER PASSWORD RESET
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  message: {
    success: false,
    error: "Too many password reste attemps, please try again in 1 hour",
  },
});

// RATE LIMIT PER ORDINI8 EVITIAMO SPAM
export const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  message: {
    success: false,
    error: "Too many order attemps, please slow down",
  },
});

// SLOWDOWN INVECE DI BLOCCARE COMPLAEMTANTE
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50, // RALLENTA DOPO 50 RICHIESTE
  delayMs: () => 500, // MEZZOSECONDO DI RITARDO PER OGNI RICHIESTA EXTRA
  maxDelayMs: 20000, // MASSIMO 20 SECONDI
  validate: { delayMs: false },
});
