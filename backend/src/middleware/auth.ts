import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "../generated/prisma";
import { JwtPayload, AuthError, UserProfile } from "../types/auth";

const prisma = new PrismaClient();

// DICIAMO A TS CHE USER PUò ESISTERE
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // PRENDO TOKEN
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // VERIFICO TOKEN
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("Setup ur JWT_SECRET");
    }

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
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // AGGIUNGIAMO L'USER ALLA REQUEST
    req.user = user;
    next();
  } catch (error: unknown) {
    console.error("Auth middleware error:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    // CONTINUA COME UTENTE NON LOGGATO
    return next();
  }

  // SE NO COME UTENTE LOGGATO
  return authenticateToken(req, res, next);
};

// MIDDLEWARE AMMINISTRATORE
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await authenticateToken(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // CONTROLLO ADMIN
    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  });
};

export const auth = authenticateToken;
export const adminAuth = requireAdmin;
export const requireUser = authenticateToken;
