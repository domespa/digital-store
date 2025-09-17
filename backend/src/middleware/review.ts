import { Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { CustomError } from "../utils/customError";
import { ReportReason, ReportStatus, ModerationAction } from "../types/review";
import { UserProfile } from "../types/auth";

// INTERFACCIA PER REQUEST CON USER OPZIONALE
interface RequestWithUser extends Request {
  user?: UserProfile & { emailVerified: boolean };
}

class ReviewValidation {
  // GESTISCI ERRORI VALIDAZIONE
  private static handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error) => error.msg);
      throw new CustomError(errorMessages.join(", "), 400);
    }
    next();
  };

  // VALIDA RICHIESTA CREAZIONE RECENSIONE
  static validateCreateReview = [
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be an integer between 1 and 5"),

    body("title")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Title must not exceed 200 characters")
      .trim()
      .escape(),

    body("content")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Content must not exceed 2000 characters")
      .trim()
      .escape(),

    body("productId")
      .isString()
      .notEmpty()
      .withMessage("Product ID is required")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid product ID format"),

    body("orderId")
      .optional()
      .isString()
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid order ID format"),

    // VALIDAZIONE CAMPI OSPITE (OPZIONALI)
    body("customerEmail")
      .optional()
      .isEmail()
      .withMessage("Invalid email format")
      .normalizeEmail(),

    body("customerName")
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage("Customer name must be between 2 and 100 characters")
      .trim()
      .escape(),

    this.handleValidationErrors,
  ];

  // VALIDA RICHIESTA AGGIORNAMENTO RECENSIONE
  static validateUpdateReview = [
    param("reviewId")
      .isString()
      .notEmpty()
      .withMessage("Review ID is required")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid review ID format"),

    body("rating")
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be an integer between 1 and 5"),

    body("title")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Title must not exceed 200 characters")
      .trim()
      .escape(),

    body("content")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Content must not exceed 2000 characters")
      .trim()
      .escape(),

    this.handleValidationErrors,
  ];

  // VALIDA RICHIESTA ADMIN AGGIORNAMENTO RECENSIONE
  static validateAdminUpdateReview = [
    param("reviewId")
      .isString()
      .notEmpty()
      .withMessage("Review ID is required")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid review ID format"),

    body("isApproved")
      .optional()
      .isBoolean()
      .withMessage("isApproved must be a boolean"),

    body("isPinned")
      .optional()
      .isBoolean()
      .withMessage("isPinned must be a boolean"),

    body("moderatorNotes")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Moderator notes must not exceed 1000 characters")
      .trim()
      .escape(),

    this.handleValidationErrors,
  ];

  // VALIDA RICHIESTA VOTO UTILE
  static validateVoteHelpful = [
    param("reviewId")
      .isString()
      .notEmpty()
      .withMessage("Review ID is required")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid review ID format"),

    body("isHelpful").isBoolean().withMessage("isHelpful must be a boolean"),

    this.handleValidationErrors,
  ];

  // VALIDA RICHIESTA SEGNALAZIONE RECENSIONE
  static validateReportReview = [
    param("reviewId")
      .isString()
      .notEmpty()
      .withMessage("Review ID is required")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid review ID format"),

    body("reason")
      .isIn(Object.values(ReportReason) as string[])
      .withMessage(
        `Reason must be one of: ${(
          Object.values(ReportReason) as string[]
        ).join(", ")}`
      ),

    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description must not exceed 500 characters")
      .trim()
      .escape(),

    this.handleValidationErrors,
  ];

  // VALIDA RICHIESTA GESTIONE SEGNALAZIONE
  static validateHandleReport = [
    param("reportId")
      .isString()
      .notEmpty()
      .withMessage("Report ID is required")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid report ID format"),

    body("status")
      .isIn(Object.values(ReportStatus) as string[])
      .withMessage(
        `Status must be one of: ${(
          Object.values(ReportStatus) as string[]
        ).join(", ")}`
      ),

    body("adminNotes")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Admin notes must not exceed 1000 characters")
      .trim()
      .escape(),

    this.handleValidationErrors,
  ];

  // VALIDA RICHIESTA OPERAZIONE BULK
  static validateBulkOperation = [
    body("reviewIds")
      .isArray({ min: 1, max: 100 })
      .withMessage("reviewIds must be an array with 1-100 items"),

    body("reviewIds.*")
      .isString()
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid review ID format"),

    body("action")
      .isIn(["approve", "reject", "delete", "pin", "unpin"])
      .withMessage(
        "Action must be one of: approve, reject, delete, pin, unpin"
      ),

    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Reason must not exceed 500 characters")
      .trim()
      .escape(),

    body("notes")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Notes must not exceed 1000 characters")
      .trim()
      .escape(),

    this.handleValidationErrors,
  ];

  // VALIDA PARAMETRO PRODUCT ID
  static validateProductId = [
    param("productId")
      .isString()
      .notEmpty()
      .withMessage("Product ID is required")
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage("Invalid product ID format"),

    this.handleValidationErrors,
  ];

  // VALIDAZIONE PERSONALIZZATA PER CONTENUTO VOLGARITÀ E SPAM
  static validateContent = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { title, content } = req.body as { title?: string; content?: string };

    // CONTROLLA PATTERN SPAM
    const spamPatterns = [
      /(.)\1{4,}/g, // CARATTERI RIPETUTI (5+ VOLTE)
      /[A-Z]{5,}/g, // CAPS ECCESSIVI
      /(buy|click|visit|check).*(http|www)/gi, // LINK PROMOZIONALI
      /\b(free|money|win|prize|discount)\b.*\b(now|today|urgent)\b/gi, // FRASI SPAM
    ];

    const textToCheck = `${title || ""} ${content || ""}`;

    for (const pattern of spamPatterns) {
      if (pattern.test(textToCheck)) {
        throw new CustomError("Content appears to be spam or promotional", 400);
      }
    }

    // CONTROLLA LUNGHEZZA MINIMA CONTENUTO PER RECENSIONI SIGNIFICATIVE
    if (content && content.trim().length < 10) {
      throw new CustomError(
        "Review content must be at least 10 characters long",
        400
      );
    }

    // CONTROLLA RIPETIZIONE ECCESSIVA - TIPIZZAZIONE CORRETTA
    if (content && content.length > 50) {
      const words = content.toLowerCase().split(/\s+/);
      const wordCount = words.reduce(
        (acc: Record<string, number>, word: string) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        },
        {}
      );

      const wordCounts = Object.values(wordCount) as number[];
      const maxRepetition = Math.max(...wordCounts);
      const totalWords = words.length;

      if (maxRepetition > totalWords * 0.3) {
        throw new CustomError(
          "Content contains excessive word repetition",
          400
        );
      }
    }

    next();
  };

  // VALIDAZIONE RATE LIMITING
  static validateRateLimit = (
    maxAttempts: number,
    windowMs: number,
    message: string
  ) => {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return (req: RequestWithUser, res: Response, next: NextFunction) => {
      const key = req.ip + (req.user ? `:${req.user.id}` : "");
      const now = Date.now();

      const userAttempts = attempts.get(key);

      if (!userAttempts || now > userAttempts.resetTime) {
        attempts.set(key, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (userAttempts.count >= maxAttempts) {
        throw new CustomError(message, 429);
      }

      userAttempts.count++;
      next();
    };
  };

  // VALIDAZIONE SPECIFICA PER OSPITI
  static validateGuestReview = [
    // VALIDAZIONI BASE
    ...this.validateCreateReview.slice(0, -1), // RIMUOVI handleValidationErrors

    // VALIDAZIONI AGGIUNTIVE PER OSPITI
    body("customerEmail")
      .notEmpty()
      .withMessage("Email is required for guest reviews")
      .isEmail()
      .withMessage("Invalid email format")
      .normalizeEmail(),

    body("customerName")
      .notEmpty()
      .withMessage("Name is required for guest reviews")
      .isLength({ min: 2, max: 100 })
      .withMessage("Customer name must be between 2 and 100 characters")
      .trim()
      .escape(),

    this.handleValidationErrors,
  ];

  // VALIDAZIONE QUERY PARAMETERS PER RECENSIONI
  static validateReviewQuery = [
    // PAGINAZIONE
    body("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),

    body("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),

    // ORDINAMENTO
    body("sortBy")
      .optional()
      .isIn(["createdAt", "rating", "helpfulCount", "reportCount"])
      .withMessage("Invalid sort field"),

    body("sortOrder")
      .optional()
      .isIn(["asc", "desc"])
      .withMessage("Sort order must be asc or desc"),

    // FILTRI
    body("rating")
      .optional()
      .custom((value) => {
        if (Array.isArray(value)) {
          return value.every(
            (r: unknown) =>
              Number.isInteger(Number(r)) && Number(r) >= 1 && Number(r) <= 5
          );
        }
        const rating = Number(value);
        return Number.isInteger(rating) && rating >= 1 && rating <= 5;
      })
      .withMessage("Rating must be integer(s) between 1 and 5"),

    body("isVerified")
      .optional()
      .isBoolean()
      .withMessage("isVerified must be a boolean"),

    body("isApproved")
      .optional()
      .isBoolean()
      .withMessage("isApproved must be a boolean"),

    body("isPinned")
      .optional()
      .isBoolean()
      .withMessage("isPinned must be a boolean"),

    this.handleValidationErrors,
  ];

  // SANITIZZA E VALIDA INPUT PERSONALIZZATO
  static customSanitizer = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { body } = req;

    // RIMUOVI CARATTERI POTENZIALMENTE PERICOLOSI
    const sanitizeString = (str: string): string => {
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // RIMUOVI SCRIPT TAGS
        .replace(/javascript:/gi, "") // RIMUOVI JAVASCRIPT URLS
        .replace(/on\w+\s*=/gi, "") // RIMUOVI EVENT HANDLERS
        .trim();
    };

    // APPLICA SANITIZZAZIONE A CAMPI STRINGA
    Object.keys(body).forEach((key) => {
      if (typeof body[key] === "string") {
        body[key] = sanitizeString(body[key]);
      }
    });

    next();
  };
}

export const reviewValidation = ReviewValidation;
