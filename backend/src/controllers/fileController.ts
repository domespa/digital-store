import { Request, Response } from "express";
import { FileUploadService, cloudinary } from "../services/uploadService";
import { PrismaClient } from "../generated/prisma";
import { catchAsync } from "../utils/catchAsync";
import { CustomError } from "../utils/customError";

const prisma = new PrismaClient();

export class FileController {
  // POST /api/files/upload/image - Upload singola immagine
  static uploadSingleImage = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new CustomError("No file provided", 400);
    }

    // Validazione folder
    const folder = req.body.folder || "general";
    const sanitizedFolder = folder
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .substring(0, 50);

    if (sanitizedFolder !== folder) {
      throw new CustomError("Invalid folder name", 400);
    }

    const imageSizes = await FileUploadService.uploadImage(
      req.file.path,
      req.file.originalname,
      sanitizedFolder,
      req.user?.id
    );

    res.json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        original: imageSizes.original,
        sizes: imageSizes,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  });

  // POST /api/files/upload/product-gallery/:productId - Upload galleria prodotto
  static uploadProductGallery = catchAsync(
    async (req: Request, res: Response) => {
      const { productId } = req.params;

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        throw new CustomError("No files provided", 400);
      }

      // Validazione productId format
      if (
        !productId ||
        productId.length > 36 ||
        !/^[a-zA-Z0-9-]+$/.test(productId)
      ) {
        throw new CustomError("Invalid product ID format", 400);
      }

      // Verifica che il prodotto esista
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { user: true }, // Include owner info
      });

      if (!product) {
        throw new CustomError("Product not found", 404);
      }

      // Verifica permessi (admin o proprietario)
      const isAdmin = req.user?.role === "ADMIN";
      const isOwner = req.user?.id === product.userId;
      if (!isAdmin) {
        throw new CustomError("Admin access required", 403);
      }

      // Limite massimo immagini per prodotto
      const existingImagesCount = await prisma.productImage.count({
        where: { productId },
      });

      const totalAfterUpload = existingImagesCount + req.files.length;
      if (totalAfterUpload > 10) {
        // Max 10 immagini per prodotto
        throw new CustomError(
          `Maximum 10 images per product. Current: ${existingImagesCount}, trying to add: ${req.files.length}`,
          400
        );
      }

      await FileUploadService.uploadProductGallery(
        req.files,
        productId,
        req.user?.id
      );

      // Ottieni le immagini caricate (con retry per race condition)
      let productImages;
      for (let i = 0; i < 3; i++) {
        productImages = await prisma.productImage.findMany({
          where: { productId },
          orderBy: { sortOrder: "asc" },
        });

        if (productImages.length >= existingImagesCount + req.files.length) {
          break;
        }

        // Breve attesa per permettere al database di aggiornarsi
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      res.json({
        success: true,
        message: `${req.files.length} images uploaded successfully`,
        data: {
          productId,
          images: productImages,
          totalImages: productImages?.length || 0,
        },
      });
    }
  );

  // POST /api/files/upload/digital - Upload file digitale
  static uploadDigitalFile = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new CustomError("No file provided", 400);
    }

    if (req.user?.role !== "ADMIN") {
      throw new CustomError("Admin access required", 403);
    }

    // Validazione folder
    const folder = req.body.folder || "digital-products";
    const sanitizedFolder = folder
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .substring(0, 50);

    const result = await FileUploadService.uploadDigitalFile(
      req.file.path,
      req.file.originalname,
      sanitizedFolder,
      req.user?.id
    );

    res.json({
      success: true,
      message: "Digital file uploaded successfully",
      data: result,
    });
  });

  // GET /api/files/download/:fileId - Download protetto
  static downloadFile = catchAsync(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { userId, expires, signature } = req.query;

    // Validazione parametri più rigorosa
    if (!userId || !expires || !signature) {
      throw new CustomError("Invalid download parameters", 400);
    }

    // Validazione formato parametri
    if (
      typeof userId !== "string" ||
      typeof expires !== "string" ||
      typeof signature !== "string"
    ) {
      throw new CustomError("Invalid parameter types", 400);
    }

    if (userId.length > 36 || signature.length !== 64) {
      // SHA-256 = 64 chars
      throw new CustomError("Invalid parameter format", 400);
    }

    const timestamp = parseInt(expires);
    if (isNaN(timestamp) || timestamp < 0) {
      throw new CustomError("Invalid expiration timestamp", 400);
    }

    // Verifica firma e scadenza
    const isValid = FileUploadService.verifyDownloadSignature(
      fileId,
      userId,
      timestamp,
      signature
    );

    if (!isValid) {
      throw new CustomError("Invalid or expired download link", 403);
    }

    // Trova il file nel database
    const product = await prisma.product.findFirst({
      where: {
        OR: [{ fileName: fileId }, { filePath: { contains: fileId } }],
      },
    });

    if (!product) {
      throw new CustomError("File not found", 404);
    }

    // Verifica che l'utente abbia acquistato il prodotto
    const order = await prisma.order.findFirst({
      where: {
        userId: userId,
        status: "COMPLETED",
        paymentStatus: "SUCCEEDED",
        orderItems: {
          some: {
            productId: product.id,
          },
        },
      },
    });

    if (!order) {
      throw new CustomError("Access denied - purchase required", 403);
    }

    // Incrementa contatore download
    await prisma.product.update({
      where: { id: product.id },
      data: { downloadCount: { increment: 1 } },
    });

    // Log del download con più dettagli
    console.log(
      `File downloaded: ${fileId} by user ${userId} from order ${
        order.id
      } at ${new Date().toISOString()}`
    );

    // Redirect al file su Cloudinary
    if (product.filePath) {
      res.redirect(product.filePath);
    } else {
      throw new CustomError("File path not available", 500);
    }
  });

  // GET /api/files/download-link/:productId - Genera link download
  static generateDownloadLink = catchAsync(
    async (req: Request, res: Response) => {
      const { productId } = req.params;

      if (!req.user) {
        throw new CustomError("Authentication required", 401);
      }

      // Validazione productId
      if (!productId || !/^[a-zA-Z0-9-]+$/.test(productId)) {
        throw new CustomError("Invalid product ID format", 400);
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product || !product.fileName) {
        throw new CustomError("Product or file not found", 404);
      }

      // Verifica acquisto con più controlli
      const order = await prisma.order.findFirst({
        where: {
          userId: req.user.id,
          status: "COMPLETED",
          paymentStatus: "SUCCEEDED",
          // Ordine non più vecchio di 2 anni
          createdAt: {
            gte: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
          },
          orderItems: {
            some: { productId },
          },
        },
      });

      if (!order) {
        throw new CustomError("Purchase required to download this file", 403);
      }

      const downloadUrl = await FileUploadService.getSecureDownloadUrl(
        product.fileName,
        req.user.id,
        order.id
      );

      res.json({
        success: true,
        data: {
          downloadUrl,
          productName: product.name,
          fileName: product.fileName,
          expiresIn: "15 minutes",
          orderDate: order.createdAt,
        },
      });
    }
  );

  // DELETE /api/files/image/:imageId - Elimina immagine prodotto
  static deleteProductImage = catchAsync(
    async (req: Request, res: Response) => {
      const { imageId } = req.params;

      // Validazione imageId
      if (!imageId || !/^[a-zA-Z0-9-]+$/.test(imageId)) {
        throw new CustomError("Invalid image ID format", 400);
      }

      const image = await prisma.productImage.findUnique({
        where: { id: imageId },
        include: {
          product: {
            include: { user: true },
          },
        },
      });

      if (!image) {
        throw new CustomError("Image not found", 404);
      }

      // Verifica permessi (admin o proprietario del prodotto)
      const isAdmin = req.user?.role === "ADMIN";
      const isOwner = req.user?.id === image.product?.userId;

      if (!isAdmin && !isOwner) {
        throw new CustomError(
          "Access denied - admin or product owner required",
          403
        );
      }

      // Elimina da Cloudinary
      try {
        const publicId = FileUploadService.extractPublicIdFromUrl(image.url);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Cloudinary image deleted: ${publicId}`);
        }
      } catch (error) {
        console.error("Failed to delete from Cloudinary:", error);
        // Continue with database deletion even if Cloudinary fails
      }

      // Se era l'immagine principale, imposta la prossima come principale
      if (image.isMain) {
        const nextImage = await prisma.productImage.findFirst({
          where: {
            productId: image.productId,
            id: { not: imageId },
          },
          orderBy: { sortOrder: "asc" },
        });

        if (nextImage) {
          await prisma.productImage.update({
            where: { id: nextImage.id },
            data: { isMain: true },
          });
        }
      }

      // Elimina dal database
      await prisma.productImage.delete({
        where: { id: imageId },
      });

      res.json({
        success: true,
        message: "Image deleted successfully",
        data: {
          deletedImageId: imageId,
          wasMainImage: image.isMain,
        },
      });
    }
  );

  // GET /api/files/product/:productId/images - Ottieni immagini prodotto
  static getProductImages = catchAsync(async (req: Request, res: Response) => {
    const { productId } = req.params;

    // Validazione productId
    if (!productId || !/^[a-zA-Z0-9-]+$/.test(productId)) {
      throw new CustomError("Invalid product ID format", 400);
    }

    // Verifica esistenza prodotto
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new CustomError("Product not found", 404);
    }

    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });

    res.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        totalImages: images.length,
        images: images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          isMain: img.isMain,
          sortOrder: img.sortOrder,
          createdAt: img.createdAt,
        })),
      },
    });
  });

  // PUT /api/files/product/:productId/images/reorder - Riordina immagini
  static reorderProductImages = catchAsync(
    async (req: Request, res: Response) => {
      const { productId } = req.params;
      const { imageOrders } = req.body;

      // Validazioni
      if (!productId || !/^[a-zA-Z0-9-]+$/.test(productId)) {
        throw new CustomError("Invalid product ID format", 400);
      }

      if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
        throw new CustomError("imageOrders must be a non-empty array", 400);
      }

      // Verifica prodotto e permessi
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { user: true },
      });

      if (!product) {
        throw new CustomError("Product not found", 404);
      }

      const isAdmin = req.user?.role === "ADMIN";
      const isOwner = req.user?.id === product.userId;

      if (!isAdmin && !isOwner) {
        throw new CustomError(
          "Access denied - admin or product owner required",
          403
        );
      }

      // Validazione formato array dettagliata
      const isValidFormat = imageOrders.every((item, index) => {
        if (
          typeof item.imageId !== "string" ||
          typeof item.sortOrder !== "number"
        ) {
          return false;
        }
        if (item.sortOrder < 0 || item.sortOrder !== index) {
          return false; // sortOrder deve essere sequenziale da 0
        }
        return true;
      });

      if (!isValidFormat) {
        throw new CustomError(
          "Invalid format: each item must have imageId (string) and sequential sortOrder (number starting from 0)",
          400
        );
      }

      // Verifica che tutte le immagini appartengano al prodotto
      const imageIds = imageOrders.map((item) => item.imageId);
      const existingImages = await prisma.productImage.findMany({
        where: {
          id: { in: imageIds },
          productId: productId,
        },
      });

      if (existingImages.length !== imageIds.length) {
        throw new CustomError("Some images do not belong to this product", 400);
      }

      // Aggiorna ordine in transazione
      await prisma.$transaction(async (prismaTransaction) => {
        const updatePromises = imageOrders.map(
          ({ imageId, sortOrder, isMain }) =>
            prismaTransaction.productImage.update({
              where: { id: imageId },
              data: {
                sortOrder,
                ...(isMain !== undefined && { isMain }),
              },
            })
        );

        await Promise.all(updatePromises);
      });

      const updatedImages = await prisma.productImage.findMany({
        where: { productId },
        orderBy: { sortOrder: "asc" },
      });

      res.json({
        success: true,
        message: "Images reordered successfully",
        data: {
          productId,
          images: updatedImages,
          totalImages: updatedImages.length,
        },
      });
    }
  );

  // GET /api/files/stats - Statistiche storage (Admin)
  static getStorageStats = catchAsync(async (req: Request, res: Response) => {
    if (req.user?.role !== "ADMIN") {
      throw new CustomError("Admin access required", 403);
    }

    const stats = await FileUploadService.getStorageStats();

    // Statistiche aggiuntive dal database
    const [totalUploads, recentUploads] = await Promise.all([
      prisma.productImage.count(),
      prisma.productImage.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Ultimi 30 giorni
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        ...stats,
        totalUploads,
        recentUploads: recentUploads,
        uploadsLast30Days: recentUploads,
      },
    });
  });

  // POST /api/files/cleanup - Cleanup file orfani (Admin)
  static cleanupOrphanFiles = catchAsync(
    async (req: Request, res: Response) => {
      if (req.user?.role !== "ADMIN") {
        throw new CustomError("Admin access required", 403);
      }

      await FileUploadService.cleanupUnusedFiles();

      res.json({
        success: true,
        message: "Orphan files cleanup completed",
        timestamp: new Date().toISOString(),
      });
    }
  );

  // PUT /api/files/image/:imageId/main - Imposta immagine come principale
  static setMainImage = catchAsync(async (req: Request, res: Response) => {
    const { imageId } = req.params;

    if (!imageId || !/^[a-zA-Z0-9-]+$/.test(imageId)) {
      throw new CustomError("Invalid image ID format", 400);
    }

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
      include: {
        product: true,
      },
    });

    if (!image) {
      throw new CustomError("Image not found", 404);
    }

    // Verifica permessi (solo admin)
    const isAdmin = req.user?.role === "ADMIN";

    if (!isAdmin) {
      throw new CustomError("Admin access required", 403);
    }

    // Se già principale, non fare nulla
    if (image.isMain) {
      return res.json({
        success: true,
        message: "Image is already the main image",
        data: { imageId, wasAlreadyMain: true },
      });
    }

    // Transazione per impostare una sola immagine principale per prodotto
    await prisma.$transaction([
      prisma.productImage.updateMany({
        where: { productId: image.productId },
        data: { isMain: false },
      }),
      prisma.productImage.update({
        where: { id: imageId },
        data: { isMain: true },
      }),
    ]);

    res.json({
      success: true,
      message: "Main image updated successfully",
      data: { imageId, productId: image.productId },
    });
  });

  // GET /api/files/health - Health check per Cloudinary
  static healthCheck = catchAsync(async (req: Request, res: Response) => {
    try {
      const ping = await cloudinary.api.ping();

      // Test aggiuntivi
      const usage = await cloudinary.api.usage();

      res.json({
        success: true,
        message: "Cloudinary connection healthy",
        data: {
          status: ping.status,
          cloudName: cloudinary.config().cloud_name,
          storageUsed: `${(usage.storage.used / 1024 / 1024).toFixed(2)} MB`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Cloudinary health check failed:", error);
      throw new CustomError("Cloudinary connection failed", 503);
    }
  });
}
