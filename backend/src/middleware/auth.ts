import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "../generated/prisma";
import { JwtPayload, AuthError, UserProfile } from "../types/auth";

const prisma = new PrismaClient();

// ===========================================
//            GLOBAL DECLARATIONS
// ===========================================

// DICIAMO A TS CHE USER PUò ESISTERE
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile & { emailVerified: boolean };
    }
  }
}

// ===========================================
//            HELPER FUNCTIONS
// ===========================================

const extractTokenFromHeader = (
  authHeader: string | undefined
): string | null => {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

const getJwtSecret = (): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable not configured");
  }
  return jwtSecret;
};

// ===========================================
//          AUTHENTICATION MIDDLEWARE
// ===========================================

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // PRENDO TOKEN
    const authHeader = req.headers["authorization"];
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token required",
      });
      return;
    }

    // VERIFICO TOKEN
    const jwtSecret = getJwtSecret();
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // TROVO USER PER QUEL TOKEN
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // AGGIUNGIAMO L'USER ALLA REQUEST
    req.user = user;
    next();
  } catch (error: unknown) {
    console.error("Auth middleware error:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expired",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

// ===========================================
//            OPTIONAL AUTHENTICATION
// ===========================================

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    // CONTINUA COME UTENTE NON LOGGATO
    next();
    return;
  }

  // SE TOKEN PRESENTE, PROVA AD AUTENTICARE
  try {
    const jwtSecret = getJwtSecret();
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    if (user) {
      req.user = user;
    }
  } catch (error) {
    // TOKEN INVALIDO MA CONTINUA SENZA AUTENTICAZIONE
    console.warn(
      "Optional auth failed, continuing without authentication:",
      error
    );
  }

  next();
};

// ===========================================
//           AUTHORIZATION MIDDLEWARE
// ===========================================

// MIDDLEWARE AMMINISTRATORE
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  // CONTROLLO ADMIN
  if (req.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return;
  }

  next();
};

// MIDDLEWARE VERIFICA EMAIL
export const requireEmailVerified = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (!req.user.emailVerified) {
    res.status(403).json({
      success: false,
      message: "Email verification required",
      code: "EMAIL_NOT_VERIFIED",
    });
    return;
  }

  next();
};

// MIDDLEWARE COMBINATO: AUTH + ADMIN
export const requireAuthenticatedAdmin = [authenticateToken, requireAdmin];

// MIDDLEWARE COMBINATO: AUTH + EMAIL VERIFIED
export const requireVerifiedUser = [authenticateToken, requireEmailVerified];

// MIDDLEWARE COMBINATO: AUTH + EMAIL VERIFIED + ADMIN
export const requireVerifiedAdmin = [
  authenticateToken,
  requireEmailVerified,
  requireAdmin,
];

// ===========================================
//              ALIASES
// ===========================================

export const auth = authenticateToken;
export const adminAuth = requireAuthenticatedAdmin;
export const requireUser = authenticateToken;
