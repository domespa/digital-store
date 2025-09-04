import helmet from "helmet";
import { Request, Response, NextFunction } from "express";

// CONFIG HELMET
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://api-m.sandbox.paypal.com",
        "https://api-m.paypal.com",
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// LOGGING RICHIESTE
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  const ip =
    req.ip ||
    req.socket.remoteAddress ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    "unknown";

  const userAgent = req.get("User-Agent") || "Unknown";

  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${ip}`
  );
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${
        res.statusCode
      } - ${duration}ms - IP: ${ip} - UA: ${userAgent}`
    );
  });

  next();
};

// MIDDLEWARE PER PULIRE INOPUT
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .trim();
  };

  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      return sanitizeString(value);
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === "object" && value.constructor === Object) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }

  next();
};

export const checkOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean);

  const origin = req.get("Origin");

  if (!origin) {
    return next();
  }

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  console.warn(`Blocked request from unauthorized origin: ${origin}`);
  return res.status(403).json({
    success: false,
    error: "Forbidden: Invalid origin",
  });
};
