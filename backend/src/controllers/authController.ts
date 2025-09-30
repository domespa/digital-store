import { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "../generated/prisma";
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UserProfile,
  JwtPayload,
} from "../types/auth";
import EmailService from "../services/emailService";
import { TokenService } from "../services/tokenService";
import { prisma } from "../utils/prisma";

const emailService = new EmailService();

// ===========================================
//               HELPER FUNCTIONS
// ===========================================

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

// ===========================================
//            AUTHENTICATION ENDPOINTS
// ===========================================

//-------------- REGISTRAZIONE UTENTE
// POST /api/auth/register
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName }: RegisterRequest = req.body;

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
    const hashedPassword = await bcryptjs.hash(password, saltRounds);

    // SE TUTTO VA BENE AGGIUNGIAMOLO AL DB
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: UserRole.USER,
        emailVerified: false,
      },
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

    // Invia email di verifica
    try {
      const verificationToken = await TokenService.createEmailVerificationToken(
        newUser.id
      );
      await emailService.sendEmailVerificationEmail(
        newUser.email,
        newUser.firstName,
        verificationToken
      );
      console.log(`Verification email sent to: ${newUser.email}`);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

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

    // VERIFICA SE è BLOCCATO
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message:
          "Account temporarily locked due to multiple failed login attempts.",
      });
    }

    // VERIFICA PASS
    const isPasswordValid = await bcryptjs.compare(password, user.password);

    if (!isPasswordValid) {
      const newAttempts = user.loginAttempts + 1;
      const lockUntil =
        newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil: lockUntil,
        },
      });

      return res.status(401).json({
        success: false,
        message: "Invalid Password",
      } as AuthResponse);
    }

    // RESET TENTATIVI
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // CREA SENZA PASSWORD
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      role: user.role,
      emailVerified: user.emailVerified,
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

// ===========================================
//           PASSWORD RESET ENDPOINTS
// ===========================================

//-------------- RESET PASSWORD
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.json({
        success: true,
        message: "If the email exists, a reset link has been sent.",
      });
    }

    const { token } = await TokenService.createPasswordResetToken(user.id);

    await emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      token
    );

    console.log(`Password reset requested for user: ${user.email}`);

    res.json({
      success: true,
      message: "Password reset link sent to your email.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process password reset request.",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    const userId = await TokenService.verifyPasswordResetToken(token);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired reset token.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcryptjs.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        loginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    });

    await TokenService.markTokenAsUsed(token);

    await emailService.sendPasswordChangedNotificationEmail(
      user.email,
      user.firstName
    );

    console.log(`Password reset completed for user: ${user.email}`);

    res.json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset password.",
    });
  }
};

// ===========================================
//           EMAIL VERIFICATION ENDPOINTS
// ===========================================

// VERIFICA EMAIL
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const userId = await TokenService.verifyEmailToken(token);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired verification token.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
      },
    });

    res.json({
      success: true,
      message: "Email verified successfully.",
      user,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify email.",
    });
  }
};

export const resendEmailVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: "Email is already verified.",
      });
    }

    const verificationToken = await TokenService.createEmailVerificationToken(
      user.id
    );

    await emailService.sendEmailVerificationEmail(
      user.email,
      user.firstName,
      verificationToken
    );

    res.json({
      success: true,
      message: "Verification email sent.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send verification email.",
    });
  }
};

// ===========================================
//           PASSWORD CHANGE ENDPOINT
// ===========================================

export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    const isCurrentPasswordValid = await bcryptjs.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect.",
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcryptjs.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    await emailService.sendPasswordChangedNotificationEmail(
      user.email,
      user.firstName
    );

    res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to change password.",
    });
  }
};

// ===========================================
//             PROFILE ENDPOINT
// ===========================================

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
