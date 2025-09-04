import express from "express";
import { InventoryController } from "../controllers/inventoryController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

//---------------- PUBBLICHE -------------------------------//
router.post("/check-availability", InventoryController.checkAvailability);
router.post("/check-multiple", InventoryController.checkMultipleAvailability);
router.get("/product/:productId", InventoryController.getProductStockStatus);

//---------------- ADMIN -------------------------------//
router.get(
  "/stats",
  authenticateToken,
  requireAdmin,
  InventoryController.getInventoryStats
);
router.get(
  "/low-stock",
  authenticateToken,
  requireAdmin,
  InventoryController.getLowStockProducts
);
router.get(
  "/out-of-stock",
  authenticateToken,
  requireAdmin,
  InventoryController.getOutOfStockProducts
);

router.post(
  "/update-stock",
  authenticateToken,
  requireAdmin,
  InventoryController.updateStock
);
router.post(
  "/bulk-update",
  authenticateToken,
  requireAdmin,
  InventoryController.bulkUpdateStock
);
router.post(
  "/restore",
  authenticateToken,
  requireAdmin,
  InventoryController.restoreStock
);
router.post(
  "/reduce",
  authenticateToken,
  requireAdmin,
  InventoryController.reduceStock
);

//---------------- TEST -------------------------------//
if (process.env.NODE_ENV === "development") {
  router.post(
    "/simulate-sale",
    authenticateToken,
    InventoryController.simulateSale
  );
}

export default router;
