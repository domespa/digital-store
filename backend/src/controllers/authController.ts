import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "../generated/prisma";
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UserProfile,
  JwtPayload,
} from "../types/auth";

const prisma = new PrismaClient();

// GENERA TOKEN PER USER
const generateToken = (user: UserProfile): string => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT not configurated");
  }

  // DURATA TOKEN 7D
  return jwt.sign(payload, jwtSecret, {
    expiresIn: "7d",
  });
};

//-------------- REGISTRAZIONE UTENTE
// POST /api/auth/register

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName }: RegisterRequest = req.body;

    // VALIDAZIONE CAMPI
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      } as AuthResponse);
    }

    // VALIDAZIONE EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email",
      } as AuthResponse);
    }

    // VALIDAZIONE PASSWORD
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // CONTROLLO EMAIL GIà ESSITENTE
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      } as AuthResponse);
    }

    // HASHING PASSWORD
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // SE TUTTO VA BENE AGGIUNGIAMOLO AL DB
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: UserRole.USER,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // GENERIAMOGLI IL TOKEN
    const token = generateToken(newUser);

    // OK
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: newUser,
      token,
    } as AuthResponse);
  } catch (error: unknown) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
    } as AuthResponse);
  }
};

//-------------- LOGIN
// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginRequest = req.body;

    // VALIDAZIONE CREDENZIALI
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      } as AuthResponse);
    }

    // CERCHIAMO L'UTENTE
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      } as AuthResponse);
    }

    // VERIFICA PASS
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid Password",
      } as AuthResponse);
    }

    // CREA SENZA PASSWORD
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      role: user.role,
    };

    // GENERA TOKEN
    const token = generateToken(userProfile);

    // OK
    res.json({
      success: true,
      message: "Login successful",
      user: userProfile,
      token,
    } as AuthResponse);
  } catch (error: unknown) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed",
    } as AuthResponse);
  }
};

//-------------- PROFILO USER
// GET /api/auth/me

export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error: unknown) {
    console.error("Get profile error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get profile",
    });
  }
};
