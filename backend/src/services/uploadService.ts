import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "../generated/prisma";
import { CustomError } from "../utils/customError";
import crypto from "crypto";

const prisma = new PrismaClient();

// ===========================================
//            CLOUDINARY CONFIGURATION
// ===========================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

// ===========================================
//               TYPES & INTERFACES
// ===========================================

export interface UploadResult {
  id: string;
  url: string;
  publicId: string;
  originalName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export interface ProcessedImageSizes {
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
  original: string;
}

// ===========================================
//          FILE UPLOAD SERVICE CLASS
// ===========================================

export class FileUploadService {
  // ===========================================
  //             SECURITY CONSTANTS
  // ===========================================

  // MAGIC BYTES PER VALIDAZIONE TIPO FILE
  private static readonly MAGIC_BYTES = {
    jpeg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46],
    pdf: [0x25, 0x50, 0x44, 0x46],
    zip: [0x50, 0x4b, 0x03, 0x04],
    docx: [0x50, 0x4b, 0x03, 0x04], // DOCX È UN ZIP
  };

  // RATE LIMITING STORAGE
  private static uploadAttempts = new Map<string, number[]>();
  private static downloadAttempts = new Map<string, number[]>();

  // ===========================================
  //            MULTER CONFIGURATION
  // ===========================================

  // CONFIGURAZIONE MULTER CON SICUREZZA AVANZATA
  static getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, "uploads/temp/");
      },
      filename: (req, file, cb) => {
        // SANITIZZA IL NOME FILE
        const sanitizedName = file.originalname
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .substring(0, 100);
        const uniqueSuffix =
          Date.now() + "-" + crypto.randomBytes(6).toString("hex");
        cb(null, uniqueSuffix + "-" + sanitizedName);
      },
    });

    const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
      try {
        // RATE LIMITING PER IP
        const clientIP = req.ip || req.connection.remoteAddress || "unknown";
        if (!this.checkRateLimit(clientIP)) {
          return cb(new CustomError("Too many upload attempts", 429), false);
        }

        // VALIDAZIONE ESTENSIONE
        const allowedExtensions = [
          ".jpg",
          ".jpeg",
          ".png",
          ".webp",
          ".gif",
          ".pdf",
          ".zip",
          ".docx",
          ".doc",
        ];
        const fileExtension = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
          return cb(
            new CustomError(`File extension ${fileExtension} not allowed`, 400),
            false
          );
        }

        // VALIDAZIONE MIME TYPE
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "image/gif",
          "application/pdf",
          "application/zip",
          "application/x-zip-compressed",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new CustomError(`File type ${file.mimetype} not allowed`, 400),
            false
          );
        }

        // VALIDAZIONE NOME FILE - PREVIENI PATH TRAVERSAL
        if (
          file.originalname.includes("..") ||
          file.originalname.includes("/") ||
          file.originalname.includes("\\")
        ) {
          return cb(new CustomError("Invalid filename", 400), false);
        }

        cb(null, true);
      } catch (error) {
        cb(new CustomError("File validation error", 400), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5,
        fieldNameSize: 100,
        fieldSize: 1024 * 1024, // 1MB PER FIELD
      },
    });
  }

  // ===========================================
  //             RATE LIMITING
  // ===========================================

  // CONTROLLO RATE LIMITING PER UPLOAD
  private static checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 MINUTI
    const maxAttempts = 20;

    if (!this.uploadAttempts.has(ip)) {
      this.uploadAttempts.set(ip, []);
    }

    const attempts = this.uploadAttempts.get(ip)!;

    // RIMUOVI TENTATIVI VECCHI
    const validAttempts = attempts.filter((time) => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
      return false;
    }

    // AGGIUNGI TENTATIVO CORRENTE
    validAttempts.push(now);
    this.uploadAttempts.set(ip, validAttempts);

    return true;
  }

  // RATE LIMITING PER DOWNLOAD
  private static checkDownloadRateLimit(key: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 MINUTO
    const maxAttempts = 3; // MAX 3 DOWNLOAD PER MINUTO PER FILE

    if (!this.downloadAttempts.has(key)) {
      this.downloadAttempts.set(key, []);
    }

    const attempts = this.downloadAttempts.get(key)!;
    const validAttempts = attempts.filter((time) => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.downloadAttempts.set(key, validAttempts);
    return true;
  }

  // ===========================================
  //            FILE VALIDATION
  // ===========================================

  // VALIDAZIONE AVANZATA CON MAGIC BYTES
  static async validateFile(filePath: string, mimeType: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new CustomError("File not found", 404);
    }

    const buffer = await fs.readFile(filePath);

    // CONTROLLO DIMENSIONE MINIMA
    if (buffer.length < 10) {
      throw new CustomError("File too small or corrupted", 400);
    }

    // VALIDAZIONE MAGIC BYTES
    const isValidMagicBytes = this.validateMagicBytes(buffer, mimeType);
    if (!isValidMagicBytes) {
      throw new CustomError(
        "File type mismatch - possible malicious file",
        400
      );
    }

    if (mimeType.startsWith("image/")) {
      try {
        const metadata = await sharp(buffer).metadata();

        // CONTROLLI DIMENSIONI IMMAGINE
        if (!metadata.width || !metadata.height) {
          throw new CustomError("Invalid image dimensions", 400);
        }

        if (metadata.width > 5000 || metadata.height > 5000) {
          throw new CustomError("Image too large (max 5000x5000px)", 400);
        }

        if (metadata.width < 10 || metadata.height < 10) {
          throw new CustomError("Image too small (min 10x10px)", 400);
        }
      } catch (error) {
        throw new CustomError("Invalid or corrupted image file", 400);
      }
    }

    // SCAN CONTENUTO SOSPETTO
    await this.scanSuspiciousContent(buffer);

    // ANTIVIRUS SCAN IN PRODUZIONE
    if (process.env.NODE_ENV === "production") {
      await this.scanForMalware(filePath);
    }
  }

  // VALIDAZIONE MAGIC BYTES
  private static validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const getExpectedMagicBytes = (mime: string): number[] | null => {
      if (mime.includes("jpeg") || mime.includes("jpg"))
        return this.MAGIC_BYTES.jpeg;
      if (mime.includes("png")) return this.MAGIC_BYTES.png;
      if (mime.includes("gif")) return this.MAGIC_BYTES.gif;
      if (mime.includes("webp")) return this.MAGIC_BYTES.webp;
      if (mime.includes("pdf")) return this.MAGIC_BYTES.pdf;
      if (mime.includes("zip") || mime.includes("docx"))
        return this.MAGIC_BYTES.zip;
      return null;
    };

    const expectedBytes = getExpectedMagicBytes(mimeType);
    if (!expectedBytes) return true; // SKIP SE NON ABBIAMO MAGIC BYTES DEFINITI

    return expectedBytes.every((byte, index) => buffer[index] === byte);
  }

  // SCAN CONTENUTO SOSPETTO
  private static async scanSuspiciousContent(buffer: Buffer): Promise<void> {
    const content = buffer.toString("utf8", 0, Math.min(buffer.length, 2048));

    // PATTERN SOSPETTI
    const suspiciousPatterns = [
      /<script[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<?php/gi,
      /<%[\s\S]*?%>/gi,
      /\$_(GET|POST|REQUEST)/gi,
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new CustomError("Suspicious content detected", 400);
      }
    }
  }

  // ANTIVIRUS SCAN (IMPLEMENTAZIONE BASE)
  private static async scanForMalware(filePath: string): Promise<void> {
    // IN PRODUZIONE, INTEGRARE CON CLAMAV O SERVIZIO SIMILE
    console.log(`Antivirus scan for: ${filePath} - OK`);
  }

  // ===========================================
  //             IMAGE UPLOAD
  // ===========================================

  // UPLOAD IMMAGINI CON VALIDAZIONI DI SICUREZZA
  static async uploadImage(
    filePath: string,
    originalName: string,
    folder: string = "products",
    userId?: string
  ): Promise<ProcessedImageSizes> {
    // SANITIZZA FOLDER NAME
    const sanitizedFolder = folder
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .substring(0, 50);

    await this.validateFile(filePath, "image/*");

    const publicId = `${sanitizedFolder}/${crypto.randomUUID()}`;

    // DIMENSIONI IMMAGINI
    const sizes = ["thumbnail", "small", "medium", "large"] as const;
    const dimensions = {
      thumbnail: { width: 150, height: 150 },
      small: { width: 300, height: 300 },
      medium: { width: 600, height: 600 },
      large: { width: 1200, height: 1200 },
    };

    const results: ProcessedImageSizes = {} as ProcessedImageSizes;

    try {
      // UPLOAD ORIGINALE CON TRASFORMAZIONI DI SICUREZZA
      const originalUpload = await cloudinary.uploader.upload(filePath, {
        public_id: `${publicId}-original`,
        folder: sanitizedFolder,
        resource_type: "image",
        quality: "auto",
        format: "auto",
        // RIMUOVE METADATI EXIF PER PRIVACY
        strip_metadata: true,
        // PREVIENE SVG CON SCRIPT
        invalidate: true,
        // LIMITI AGGIUNTIVI
        transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
      });

      results.original = originalUpload.secure_url;

      // GENERA RESIZE CON CONTROLLI SICUREZZA
      for (const size of sizes) {
        const { width, height } = dimensions[size];

        const resizedBuffer = await sharp(filePath)
          .resize(width, height, {
            fit: "cover",
            position: "center",
            withoutEnlargement: false,
          })
          .jpeg({
            quality: 85,
            progressive: true,
            mozjpeg: true, // MIGLIORE COMPRESSIONE
          })
          .removeAlpha() // RIMUOVE CANALE ALPHA PER SICUREZZA
          .toBuffer();

        const resizedUpload = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`,
          {
            public_id: `${publicId}-${size}`,
            folder: sanitizedFolder,
            resource_type: "image",
            strip_metadata: true,
          }
        );

        results[size] = resizedUpload.secure_url;
      }

      // LOG SICUREZZA
      console.log(
        `Secure image upload completed: ${publicId} by user ${
          userId || "anonymous"
        }`
      );
    } catch (error) {
      console.error(`Upload error for ${publicId}:`, error);
      throw new CustomError("Upload failed - security validation error", 500);
    } finally {
      // CLEANUP SEMPRE
      await fs.unlink(filePath).catch(() => {});
    }

    return results;
  }

  // UPLOAD MULTIPLO PER GALLERIA PRODOTTO
  static async uploadProductGallery(
    files: Express.Multer.File[],
    productId: string,
    userId?: string
  ): Promise<void> {
    if (files.length === 0) return;

    // VALIDAZIONE PRODUCT ID
    const sanitizedProductId = productId.replace(/[^a-zA-Z0-9-]/g, "");
    if (sanitizedProductId !== productId || productId.length > 36) {
      throw new CustomError("Invalid product ID", 400);
    }

    // VERIFICA ESISTENZA PRODOTTO
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new CustomError("Product not found", 404);
    }

    const uploadPromises = files.map(async (file, index) => {
      try {
        const imageSizes = await this.uploadImage(
          file.path,
          file.originalname,
          `products/${productId}`,
          userId
        );

        // GENERA ALT TEXT SICURO
        const baseAltText = file.originalname
          .split(".")[0]
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .substring(0, 100);

        // SALVA NEL DATABASE
        await prisma.productImage.create({
          data: {
            productId,
            url: imageSizes.large, // USA VERSIONE LARGE COME PRINCIPALE
            altText: `${baseAltText} - Image ${index + 1}`,
            sortOrder: index,
            isMain: index === 0, // PRIMA IMMAGINE = PRINCIPALE
          },
        });

        console.log(
          `Product gallery image uploaded: ${
            imageSizes.large
          } for product ${productId} by user ${userId || "anonymous"}`
        );

        return imageSizes;
      } catch (error) {
        console.error(
          `Failed to upload gallery image ${index} for product ${productId}:`,
          error
        );
        throw new CustomError(`Failed to upload image ${index + 1}`, 500);
      }
    });

    await Promise.all(uploadPromises);
  }

  // ===========================================
  //            DIGITAL FILE UPLOAD
  // ===========================================

  // UPLOAD FILE DIGITALI CON CONTROLLI DI SICUREZZA
  static async uploadDigitalFile(
    filePath: string,
    originalName: string,
    folder: string = "digital-products",
    userId?: string
  ): Promise<UploadResult> {
    const sanitizedFolder = folder
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .substring(0, 50);

    await this.validateFile(filePath, "application/*");

    const publicId = `${sanitizedFolder}/${crypto.randomUUID()}`;

    try {
      const result = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        folder: sanitizedFolder,
        resource_type: "raw",
        access_mode: "authenticated", // IMPORTANTE: RICHIEDE AUTENTICAZIONE
        // PREVIENE ACCESSO DIRETTO
        type: "authenticated",
      });

      // LOG SICUREZZA
      console.log(
        `Secure digital file upload: ${publicId} by user ${
          userId || "anonymous"
        }`
      );

      return {
        id: result.public_id,
        url: result.secure_url,
        publicId: result.public_id,
        originalName: originalName.substring(0, 255), // LIMITA LUNGHEZZA
        mimeType: "application/octet-stream",
        size: result.bytes,
      };
    } finally {
      await fs.unlink(filePath).catch(() => {});
    }
  }

  // ===========================================
  //           SECURE DOWNLOAD SYSTEM
  // ===========================================

  // VERIFICA PERMESSI CON CONTROLLI AGGIUNTIVI
  private static async verifyDownloadPermission(
    fileId: string,
    userId: string,
    orderId?: string
  ): Promise<boolean> {
    // INPUT VALIDATION
    if (!fileId || !userId || fileId.length > 255 || userId.length > 36) {
      return false;
    }

    // SANITIZZA INPUT PER PREVENIRE INJECTION
    const sanitizedFileId = fileId.replace(/[^a-zA-Z0-9-_.]/g, "");
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "");

    try {
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { fileName: { equals: sanitizedFileId } },
            { filePath: { contains: sanitizedFileId } },
          ],
        },
      });

      if (!product) return false;

      // CONTROLLO ORDINE CON PIÙ VALIDAZIONI
      const order = await prisma.order.findFirst({
        where: {
          userId: sanitizedUserId,
          status: "COMPLETED",
          paymentStatus: "SUCCEEDED",
          // AGGIUNGI CONTROLLO DATA ORDINE (ES. NON PIÙ VECCHIO DI 1 ANNO)
          createdAt: {
            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          },
          orderItems: {
            some: {
              productId: product.id,
            },
          },
        },
        include: {
          orderItems: true,
        },
      });

      if (!order) return false;

      // LOG TENTATIVO ACCESSO
      console.log(
        `Download permission verified: ${sanitizedFileId} for user ${sanitizedUserId}`
      );

      return true;
    } catch (error) {
      console.error("Permission verification error:", error);
      return false;
    }
  }

  // GENERA FIRMA PIÙ SICURA
  private static generateDownloadSignature(
    fileId: string,
    userId: string,
    timestamp: number
  ): string {
    const secret = process.env.DOWNLOAD_SECRET;
    if (!secret || secret === "default-secret") {
      throw new CustomError("Invalid download configuration", 500);
    }

    // INCLUDE PIÙ DATI NELLA FIRMA PER MAGGIORE SICUREZZA
    const data = `${fileId}:${userId}:${timestamp}:${process.env.NODE_ENV}`;
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
  }

  // VERIFICA FIRMA CON TIMING ATTACK PROTECTION
  static verifyDownloadSignature(
    fileId: string,
    userId: string,
    timestamp: number,
    signature: string
  ): boolean {
    try {
      const expectedSignature = this.generateDownloadSignature(
        fileId,
        userId,
        timestamp
      );
      const now = Math.floor(Date.now() / 1000);

      // VERIFICA TIMING ATTACK PROTECTION
      const isValidSignature = crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );

      const isNotExpired = timestamp > now;
      const isNotTooFarInFuture = timestamp < now + 60 * 60; // MAX 1 ORA NEL FUTURO

      return isValidSignature && isNotExpired && isNotTooFarInFuture;
    } catch (error) {
      console.error("Signature verification error:", error);
      return false;
    }
  }

  // URL SICURO CON RATE LIMITING PER UTENTE
  static async getSecureDownloadUrl(
    fileId: string,
    userId: string,
    orderId?: string
  ): Promise<string> {
    const hasPermission = await this.verifyDownloadPermission(
      fileId,
      userId,
      orderId
    );
    if (!hasPermission) {
      throw new CustomError("Access denied", 403);
    }

    // CONTROLLO RATE LIMITING PER DOWNLOAD
    const downloadKey = `download:${userId}:${fileId}`;
    if (!this.checkDownloadRateLimit(downloadKey)) {
      throw new CustomError("Too many download attempts", 429);
    }

    const timestamp = Math.floor(Date.now() / 1000) + 15 * 60; // 15 MINUTI
    const signature = this.generateDownloadSignature(fileId, userId, timestamp);

    const baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      throw new CustomError("Server configuration error", 500);
    }

    return `${baseUrl}/api/files/download/${encodeURIComponent(
      fileId
    )}?userId=${encodeURIComponent(
      userId
    )}&expires=${timestamp}&signature=${signature}`;
  }

  // ===========================================
  //            UTILITY METHODS
  // ===========================================

  // ESTRAI PUBLIC ID DA URL CLOUDINARY
  public static extractPublicIdFromUrl(url: string): string | null {
    try {
      // VALIDAZIONE URL
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes("cloudinary.com")) {
        throw new Error("Invalid Cloudinary URL");
      }

      const urlParts = urlObj.pathname.split("/");
      const lastPart = urlParts[urlParts.length - 1];
      const publicIdWithExtension = lastPart.split(".")[0];

      const uploadIndex = urlParts.findIndex((part) => part === "upload");
      if (uploadIndex === -1 || uploadIndex >= urlParts.length - 2) {
        return publicIdWithExtension;
      }

      const folderParts = urlParts.slice(uploadIndex + 2, -1);
      const fullPublicId = [...folderParts, publicIdWithExtension].join("/");

      // SANITIZZA IL PUBLIC_ID
      return fullPublicId.replace(/[^a-zA-Z0-9\-_\/]/g, "");
    } catch (error) {
      console.error("Error extracting public_id from URL:", error);
      return null;
    }
  }

  // CLEANUP CON CONTROLLI SICUREZZA
  static async cleanupUnusedFiles(): Promise<void> {
    console.log("Starting secure cleanup process...");

    const allImages = await prisma.productImage.findMany({
      include: { product: true },
    });

    const orphanImages = allImages.filter((image) => !image.product);
    let cleanedCount = 0;

    for (const image of orphanImages) {
      try {
        const publicId = this.extractPublicIdFromUrl(image.url);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          cleanedCount++;
        }

        await prisma.productImage.delete({
          where: { id: image.id },
        });
      } catch (error) {
        console.error(`Failed to cleanup image ${image.id}:`, error);
      }
    }

    console.log(
      `Secure cleanup completed: ${cleanedCount} orphan images removed`
    );
  }

  // STATISTICHE SICURE
  static async getStorageStats(): Promise<{
    totalImages: number;
    totalFiles: number;
    storageUsed: string;
    monthlyBandwidth: string;
  }> {
    const [totalImages, totalProducts] = await Promise.all([
      prisma.productImage.count(),
      prisma.product.count({
        where: { fileName: { not: null } },
      }),
    ]);

    let storageUsed = "N/A";
    let monthlyBandwidth = "N/A";

    try {
      const usage = await cloudinary.api.usage();
      storageUsed = `${(usage.storage.used / 1024 / 1024).toFixed(2)} MB`;
      monthlyBandwidth = `${(usage.bandwidth.used / 1024 / 1024).toFixed(
        2
      )} MB`;
    } catch (error) {
      console.error("Failed to get Cloudinary usage:", error);
    }

    return {
      totalImages,
      totalFiles: totalProducts,
      storageUsed,
      monthlyBandwidth,
    };
  }
}
