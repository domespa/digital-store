import crypto from "crypto";
import { prisma } from "../utils/prisma";

// ===========================================
//             TOKEN SERVICE CLASS
// ===========================================

export class TokenService {
  // ===========================================
  //            UTILITY METHODS
  // ===========================================

  // GENERAZIONE TOKEN SICURO
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // ===========================================
  //         PASSWORD RESET TOKENS
  // ===========================================

  // CREA TOKEN RESET PASSWORD
  static async createPasswordResetToken(
    userId: string
  ): Promise<{ token: string; expiresAt: Date }> {
    // ELIMINA TOKEN GIÀ ESISTENTI
    await prisma.passwordResetToken.deleteMany({
      where: { userId },
    });

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 ORA

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  // VERIFICA TOKEN RESET PASSWORD
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

  // MARCA TOKEN COME USATO
  static async markTokenAsUsed(token: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });
  }

  // ===========================================
  //       EMAIL VERIFICATION TOKENS
  // ===========================================

  // CREA TOKEN PER VERIFICA EMAIL
  static async createEmailVerificationToken(userId: string): Promise<string> {
    // ELIMINA TOKEN ESISTENTI
    await prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // SCADE IN 7 GIORNI

    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  // VERIFICA TOKEN EMAIL
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

    // MARCA COME USATO E VERIFICA EMAIL
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

  // ===========================================
  //            CLEANUP METHODS
  // ===========================================

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
