import crypto from "crypto";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export class TokenService {
  // GENERAZIONE TOKEN SICURO
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // CREA TOKEN
  static async createPasswordResetToken(
    userId: string
  ): Promise<{ token: string; expiresAt: Date }> {
    // ELIMINA TOKEN GIA ESISTENTI
    await prisma.passwordResetToken.deleteMany({
      where: { userId },
    });

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1H

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  // VERIFICA TOKEN RESET
  static async verifyPasswordResetToken(token: string): Promise<string | null> {
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.used ||
      tokenRecord.expiresAt < new Date()
    ) {
      return null;
    }

    return tokenRecord.userId;
  }

  // TOKEN USATO
  static async markTokenAsUsed(token: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });
  }

  // TOKEN PER VERIFICA EMAIL
  static async createEmailVerificationToken(userId: string): Promise<string> {
    // Elimina token esistenti
    await prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Scade in 7 giorni

    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  // CREA TOKEN EMAIL
  static async verifyEmailToken(token: string): Promise<string | null> {
    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (
      !tokenRecord ||
      tokenRecord.used ||
      tokenRecord.expiresAt < new Date()
    ) {
      return null;
    }

    // USATO
    await Promise.all([
      prisma.emailVerificationToken.update({
        where: { token },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerified: true },
      }),
    ]);

    return tokenRecord.userId;
  }

  // ELIMINA TOKEN SCADUTI
  static async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();

    await Promise.all([
      prisma.passwordResetToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { used: true }],
        },
      }),
      prisma.emailVerificationToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { used: true }],
        },
      }),
    ]);
  }
}
