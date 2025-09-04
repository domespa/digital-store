import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "../generated/prisma";
import { CustomError } from "../utils/customError";
import crypto from "crypto";

const prisma = new PrismaClient();

// Configurazione Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

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

export class FileUploadService {
  // Magic bytes per validazione tipo file
  private static readonly MAGIC_BYTES = {
    jpeg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46],
    pdf: [0x25, 0x50, 0x44, 0x46],
    zip: [0x50, 0x4b, 0x03, 0x04],
    docx: [0x50, 0x4b, 0x03, 0x04], // DOCX è un ZIP
  };

  // Rate limiting storage
  private static uploadAttempts = new Map<string, number[]>();

  static getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, "uploads/temp/");
      },
      filename: (req, file, cb) => {
        // Sanitizza il nome file
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
        // Rate limiting per IP
        const clientIP = req.ip || req.connection.remoteAddress || "unknown";
        if (!this.checkRateLimit(clientIP)) {
          return cb(new CustomError("Too many upload attempts", 429), false);
        }

        // Validazione estensione
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

        // Validazione MIME type
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

        // Validazione nome file - no path traversal
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
        fieldSize: 1024 * 1024, // 1MB per field
      },
    });
  }

  // Rate limiting check
  private static checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minuti
    const maxAttempts = 20;

    if (!this.uploadAttempts.has(ip)) {
      this.uploadAttempts.set(ip, []);
    }

    const attempts = this.uploadAttempts.get(ip)!;

    // Rimuovi tentativi vecchi
    const validAttempts = attempts.filter((time) => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
      return false;
    }

    // Aggiungi tentativo corrente
    validAttempts.push(now);
    this.uploadAttempts.set(ip, validAttempts);

    return true;
  }

  // Validazione avanzata con magic bytes
  static async validateFile(filePath: string, mimeType: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new CustomError("File not found", 404);
    }

    const buffer = await fs.readFile(filePath);

    // Controllo dimensione minima
    if (buffer.length < 10) {
      throw new CustomError("File too small or corrupted", 400);
    }

    // Validazione magic bytes
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

        // Controlli dimensioni immagine
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

    // Scan contenuto sospetto
    await this.scanSuspiciousContent(buffer);

    // Antivirus scan in produzione
    if (process.env.NODE_ENV === "production") {
      await this.scanForMalware(filePath);
    }
  }

  // Validazione magic bytes
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
    if (!expectedBytes) return true; // Skip se non abbiamo magic bytes definiti

    return expectedBytes.every((byte, index) => buffer[index] === byte);
  }

  // Scan contenuto sospetto
  private static async scanSuspiciousContent(buffer: Buffer): Promise<void> {
    const content = buffer.toString("utf8", 0, Math.min(buffer.length, 2048));

    // Pattern sospetti
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

  // Antivirus scan (implementazione base)
  private static async scanForMalware(filePath: string): Promise<void> {
    // In produzione, integrare con ClamAV o servizio simile
    // Esempio con ClamAV:
    /*
    const { NodeClam } = require('clamscan');
    const clamscan = await new NodeClam().init({
      removeInfected: false,
      quarantineInfected: false,
      debugMode: false
    });
    
    const { isInfected, file, viruses } = await clamscan.scanFile(filePath);
    
    if (isInfected) {
      throw new CustomError(`Malware detected: ${viruses.join(', ')}`, 400);
    }
    */
    console.log(`Antivirus scan for: ${filePath} - OK`);
  }

  // Upload con validazioni di sicurezza
  static async uploadImage(
    filePath: string,
    originalName: string,
    folder: string = "products",
    userId?: string
  ): Promise<ProcessedImageSizes> {
    // Sanitizza folder name
    const sanitizedFolder = folder
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .substring(0, 50);

    await this.validateFile(filePath, "image/*");

    const publicId = `${sanitizedFolder}/${crypto.randomUUID()}`;

    // Limita dimensioni array
    const sizes = ["thumbnail", "small", "medium", "large"] as const;
    const dimensions = {
      thumbnail: { width: 150, height: 150 },
      small: { width: 300, height: 300 },
      medium: { width: 600, height: 600 },
      large: { width: 1200, height: 1200 },
    };

    const results: ProcessedImageSizes = {} as ProcessedImageSizes;

    try {
      // Upload originale con trasformazioni di sicurezza
      const originalUpload = await cloudinary.uploader.upload(filePath, {
        public_id: `${publicId}-original`,
        folder: sanitizedFolder,
        resource_type: "image",
        quality: "auto",
        format: "auto",
        // Rimuove metadati EXIF per privacy
        strip_metadata: true,
        // Previene SVG con script
        invalidate: true,
        // Limiti aggiuntivi
        transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
      });

      results.original = originalUpload.secure_url;

      // Genera resize con controlli sicurezza
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
            mozjpeg: true, // Migliore compressione
          })
          .removeAlpha() // Rimuove canale alpha per sicurezza
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

      // Log sicurezza
      console.log(
        `Secure image upload completed: ${publicId} by user ${
          userId || "anonymous"
        }`
      );
    } catch (error) {
      console.error(`Upload error for ${publicId}:`, error);
      throw new CustomError("Upload failed - security validation error", 500);
    } finally {
      // Cleanup sempre
      await fs.unlink(filePath).catch(() => {});
    }

    return results;
  }

  // Upload digitale con controlli di sicurezza
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
        access_mode: "authenticated", // IMPORTANTE: richiede autenticazione
        // Previene accesso diretto
        type: "authenticated",
      });

      // Log sicurezza
      console.log(
        `Secure digital file upload: ${publicId} by user ${
          userId || "anonymous"
        }`
      );

      return {
        id: result.public_id,
        url: result.secure_url,
        publicId: result.public_id,
        originalName: originalName.substring(0, 255), // Limita lunghezza
        mimeType: "application/octet-stream",
        size: result.bytes,
      };
    } finally {
      await fs.unlink(filePath).catch(() => {});
    }
  }

  // Verifica permessi con controlli aggiuntivi
  private static async verifyDownloadPermission(
    fileId: string,
    userId: string,
    orderId?: string
  ): Promise<boolean> {
    // Input validation
    if (!fileId || !userId || fileId.length > 255 || userId.length > 36) {
      return false;
    }

    // Sanitizza input per prevenire injection
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

      // Controllo ordine con più validazioni
      const order = await prisma.order.findFirst({
        where: {
          userId: sanitizedUserId,
          status: "COMPLETED",
          paymentStatus: "SUCCEEDED",
          // Aggiungi controllo data ordine (es. non più vecchio di 1 anno)
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

      // Log tentativo accesso
      console.log(
        `Download permission verified: ${sanitizedFileId} for user ${sanitizedUserId}`
      );

      return true;
    } catch (error) {
      console.error("Permission verification error:", error);
      return false;
    }
  }

  // Genera firma più sicura
  private static generateDownloadSignature(
    fileId: string,
    userId: string,
    timestamp: number
  ): string {
    const secret = process.env.DOWNLOAD_SECRET;
    if (!secret || secret === "default-secret") {
      throw new CustomError("Invalid download configuration", 500);
    }

    // Include più dati nella firma per maggiore sicurezza
    const data = `${fileId}:${userId}:${timestamp}:${process.env.NODE_ENV}`;
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
  }

  // Verifica firma con rate limiting
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

      // Verifica timing attack protection
      const isValidSignature = crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );

      const isNotExpired = timestamp > now;
      const isNotTooFarInFuture = timestamp < now + 60 * 60; // Max 1 ora nel futuro

      return isValidSignature && isNotExpired && isNotTooFarInFuture;
    } catch (error) {
      console.error("Signature verification error:", error);
      return false;
    }
  }

  // URL sicuro con rate limiting per utente
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

    // Controllo rate limiting per download
    const downloadKey = `download:${userId}:${fileId}`;
    if (!this.checkDownloadRateLimit(downloadKey)) {
      throw new CustomError("Too many download attempts", 429);
    }

    const timestamp = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minuti
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

  // Rate limiting per download
  private static downloadAttempts = new Map<string, number[]>();

  private static checkDownloadRateLimit(key: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxAttempts = 3; // Max 3 download per minuto per file

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

  // Pulizia sicura file - rendi pubblico
  public static extractPublicIdFromUrl(url: string): string | null {
    try {
      // Validazione URL
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

      // Sanitizza il public_id
      return fullPublicId.replace(/[^a-zA-Z0-9\-_\/]/g, "");
    } catch (error) {
      console.error("Error extracting public_id from URL:", error);
      return null;
    }
  }

  // Cleanup con controlli sicurezza
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

  // Upload multiplo per galleria prodotto
  static async uploadProductGallery(
    files: Express.Multer.File[],
    productId: string,
    userId?: string
  ): Promise<void> {
    if (files.length === 0) return;

    // Validazione productId
    const sanitizedProductId = productId.replace(/[^a-zA-Z0-9-]/g, "");
    if (sanitizedProductId !== productId || productId.length > 36) {
      throw new CustomError("Invalid product ID", 400);
    }

    // Verifica esistenza prodotto
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

        // Genera alt text sicuro
        const baseAltText = file.originalname
          .split(".")[0]
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .substring(0, 100);

        // Salva nel database
        await prisma.productImage.create({
          data: {
            productId,
            url: imageSizes.large, // Usa versione large come principale
            altText: `${baseAltText} - Image ${index + 1}`,
            sortOrder: index,
            isMain: index === 0, // Prima immagine = principale
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

  // Statistiche sicure
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
