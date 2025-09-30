import { Request, Response } from "express";
import { FileUploadService, cloudinary } from "../services/uploadService";
import { catchAsync } from "../utils/catchAsync";
import { CustomError } from "../utils/customError";
import { prisma } from "../utils/prisma";

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

    const uploadService = new FileUploadService();
    const imageSizes = await uploadService.uploadImage(
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

  // UPLOAD GALLERIA PRODOTTO
  // POST /api/files/upload/product-gallery/:productId
  static uploadProductGallery = catchAsync(
    async (req: Request, res: Response) => {
      const { productId } = req.params;

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        throw new CustomError("No files provided", 400);
      }

      if (
        !productId ||
        productId.length > 36 ||
        !/^[a-zA-Z0-9-]+$/.test(productId)
      ) {
        throw new CustomError("Invalid product ID format", 400);
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new CustomError("Product not found", 404);
      }

      if (req.user?.role !== "ADMIN") {
        throw new CustomError("Admin access required", 403);
      }

      const existingImagesCount = await prisma.productImage.count({
        where: { productId },
      });

      const totalAfterUpload = existingImagesCount + req.files.length;
      if (totalAfterUpload > 10) {
        throw new CustomError(
          `Maximum 10 images per product. Current: ${existingImagesCount}, trying to add: ${req.files.length}`,
          400
        );
      }

      const uploadService = new FileUploadService();
      const createdImages = await uploadService.uploadProductGallery(
        req.files,
        productId,
        req.user?.id
      );

      let productImages = await prisma.productImage.findMany({
        where: { productId },
        orderBy: { sortOrder: "asc" },
      });

      for (let i = 0; i < 2; i++) {
        if (productImages.length >= existingImagesCount + req.files.length) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        productImages = await prisma.productImage.findMany({
          where: { productId },
          orderBy: { sortOrder: "asc" },
        });
      }

      res.json({
        success: true,
        message: `${req.files.length} images uploaded successfully`,
        data: {
          productId,
          images: createdImages,
          totalImages: productImages.length,
        },
      });
    }
  );
  // UPLOAD FILE DIGITALE
  // POST /api/files/upload/digital
  static uploadDigitalFile = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new CustomError("No file provided", 400);
    }

    if (req.user?.role !== "ADMIN") {
      throw new CustomError("Admin access required", 403);
    }

    const folder = req.body.folder || "digital-products";
    const sanitizedFolder = folder
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .substring(0, 50);

    const uploadService = new FileUploadService();
    const result = await uploadService.uploadDigitalFile(
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

  // DOWN PROTETTO
  // GET /api/files/download/:fileId
  static downloadFile = catchAsync(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { userId, expires, signature } = req.query;

    if (!userId || !expires || !signature) {
      throw new CustomError("Invalid download parameters", 400);
    }

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

    // HA ACQUISTATO?
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

    // AGGIORNA DATI CONTANTOTE
    await prisma.product.update({
      where: { id: product.id },
      data: { downloadCount: { increment: 1 } },
    });

    console.log(
      `File downloaded: ${fileId} by user ${userId} from order ${
        order.id
      } at ${new Date().toISOString()}`
    );

    if (product.filePath) {
      res.redirect(product.filePath);
    } else {
      throw new CustomError("File path not available", 500);
    }
  });

  // GENERA LINK
  // GET /api/files/download-link/:productId
  static generateDownloadLink = catchAsync(
    async (req: Request, res: Response) => {
      const { productId } = req.params;

      if (!req.user) {
        throw new CustomError("Authentication required", 401);
      }

      if (!productId || !/^[a-zA-Z0-9-]+$/.test(productId)) {
        throw new CustomError("Invalid product ID format", 400);
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product || !product.fileName) {
        throw new CustomError("Product or file not found", 404);
      }

      const order = await prisma.order.findFirst({
        where: {
          userId: req.user.id,
          status: "COMPLETED",
          paymentStatus: "SUCCEEDED",

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
  // ELIMINA IMMAGINE
  // DELETE /api/files/image/:imageId
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
          product: true,
        },
      });

      if (!image) {
        throw new CustomError("Image not found", 404);
      }

      if (req.user?.role !== "ADMIN") {
        throw new CustomError("Admin access required", 403);
      }

      try {
        const publicId = FileUploadService.extractPublicIdFromUrl(image.url);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Cloudinary image deleted: ${publicId}`);
        }
      } catch (error) {
        console.error("Failed to delete from Cloudinary:", error);
      }

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

  // IMMAGINI
  // GET /api/files/product/:productId/images
  static getProductImages = catchAsync(async (req: Request, res: Response) => {
    const { productId } = req.params;

    if (!productId || !/^[a-zA-Z0-9-]+$/.test(productId)) {
      throw new CustomError("Invalid product ID format", 400);
    }

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

  // ORDINAMENTO
  // PUT /api/files/product/:productId/images/reorder
  static reorderProductImages = catchAsync(
    async (req: Request, res: Response) => {
      const { productId } = req.params;
      const { imageOrders } = req.body;

      if (!productId || !/^[a-zA-Z0-9-]+$/.test(productId)) {
        throw new CustomError("Invalid product ID format", 400);
      }

      if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
        throw new CustomError("imageOrders must be a non-empty array", 400);
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new CustomError("Product not found", 404);
      }

      if (req.user?.role !== "ADMIN") {
        throw new CustomError("Admin access required", 403);
      }

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
  // ADMIN STATS SPAZIO
  // GET /api/files/stats
  static getStorageStats = catchAsync(async (req: Request, res: Response) => {
    if (req.user?.role !== "ADMIN") {
      throw new CustomError("Admin access required", 403);
    }

    const stats = await FileUploadService.getStorageStats();

    const [totalUploads, recentUploads] = await Promise.all([
      prisma.productImage.count(),
      prisma.productImage.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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

  // POST /api/files/cleanup
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

  // IMPOSTA IMMAGINE PRINCIPALE PRODOTT
  // PUT /api/files/image/:imageId/main
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

    if (req.user?.role !== "ADMIN") {
      throw new CustomError("Admin access required", 403);
    }

    if (image.isMain) {
      return res.json({
        success: true,
        message: "Image is already the main image",
        data: { imageId, wasAlreadyMain: true },
      });
    }

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

  // STATUS CLOUDINARY
  // GET /api/files/health
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
