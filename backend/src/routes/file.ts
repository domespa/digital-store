// src/routes/fileRoutes.ts
import express from "express";
import { FileController } from "../controllers/fileController";
import { FileUploadService } from "../services/uploadService";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/validation";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting per upload (più restrittivo)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 20, // Max 20 upload per 15 minuti
  message: {
    success: false,
    error: "Too many upload attempts, please try again later",
  },
});

// Rate limiting per download
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Max 100 download per 15 minuti
  message: {
    success: false,
    error: "Too many download attempts, please try again later",
  },
});

// Configurazione Multer
const upload = FileUploadService.getMulterConfig();

// ============== UPLOAD ROUTES ==============

// POST /api/files/upload/image - Upload singola immagine
router.post(
  "/upload/image",
  uploadLimiter,
  authenticateToken,
  requireAdmin,
  upload.single("image"),
  [
    body("folder")
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage("Folder name must be a string max 50 chars"),
  ],
  handleValidationErrors,
  FileController.uploadSingleImage
);

// POST /api/files/upload/product-gallery/:productId - Upload galleria prodotto
router.post(
  "/upload/product-gallery/:productId",
  uploadLimiter,
  authenticateToken,
  requireAdmin,
  upload.array("images", 10), // Max 10 immagini
  [
    param("productId")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid productId required"),
  ],
  handleValidationErrors,
  FileController.uploadProductGallery
);

// POST /api/files/upload/digital - Upload file digitale
router.post(
  "/upload/digital",
  uploadLimiter,
  authenticateToken,
  requireAdmin,
  upload.single("file"),
  [
    body("folder")
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage("Folder name must be a string max 50 chars"),
  ],
  handleValidationErrors,
  FileController.uploadDigitalFile
);

// ============== DOWNLOAD ROUTES ==============

// GET /api/files/download/:fileId - Download protetto
router.get(
  "/download/:fileId",
  downloadLimiter,
  [
    param("fileId")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid fileId required"),
    query("userId")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid userId required"),
    query("expires")
      .isNumeric()
      .withMessage("Valid expires timestamp required"),
    query("signature")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid signature required"),
  ],
  handleValidationErrors,
  FileController.downloadFile
);

// GET /api/files/download-link/:productId - Genera link download
router.get(
  "/download-link/:productId",
  downloadLimiter,
  authenticateToken,
  [
    param("productId")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid productId required"),
  ],
  handleValidationErrors,
  FileController.generateDownloadLink
);

// ============== IMAGE MANAGEMENT ROUTES ==============

// GET /api/files/product/:productId/images - Ottieni immagini prodotto
router.get(
  "/product/:productId/images",
  [
    param("productId")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid productId required"),
  ],
  handleValidationErrors,
  FileController.getProductImages
);

// PUT /api/files/product/:productId/images/reorder - Riordina immagini
router.put(
  "/product/:productId/images/reorder",
  authenticateToken,
  requireAdmin,
  [
    param("productId")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid productId required"),
    body("imageOrders")
      .isArray({ min: 1 })
      .withMessage("imageOrders must be a non-empty array"),
    body("imageOrders.*.imageId")
      .isString()
      .withMessage("Each item must have imageId"),
    body("imageOrders.*.sortOrder")
      .isInt({ min: 0 })
      .withMessage("Each item must have sortOrder >= 0"),
    body("imageOrders.*.isMain")
      .optional()
      .isBoolean()
      .withMessage("isMain must be boolean"),
  ],
  handleValidationErrors,
  FileController.reorderProductImages
);

// DELETE /api/files/image/:imageId - Elimina immagine
router.delete(
  "/image/:imageId",
  authenticateToken,
  requireAdmin,
  [
    param("imageId")
      .isString()
      .isLength({ min: 1 })
      .withMessage("Valid imageId required"),
  ],
  handleValidationErrors,
  FileController.deleteProductImage
);

// ============== ADMIN ROUTES ==============

// GET /api/files/stats - Statistiche storage
router.get(
  "/stats",
  authenticateToken,
  requireAdmin,
  FileController.getStorageStats
);

// POST /api/files/cleanup - Cleanup file orfani
router.post(
  "/cleanup",
  authenticateToken,
  requireAdmin,
  FileController.cleanupOrphanFiles
);

export default router;
