import { Router } from "express";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsAdmin,
} from "../controllers/productController";
import {
  updateOrderStatus,
  getOrdersAdmin,
} from "../controllers/orderController";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// APPLICHIAMO IL MIDDLEWARE ADMIN A TUTTE LE ROTTE!
router.use(requireAdmin);

// LISTA PRODOTTI CON PATH
// GET /api/admin/products
router.get("/products", getProductsAdmin);

// CREA PRODOTTO
// POST /api/admin/products
router.post("/products", createProduct);

// MODIFICA PRODOTTO
// PUT /api/admin/products/:id
router.put("/products/:id", updateProduct);

// ELIMINAZIONE SOFT
// DELETE /api/admin/products/:id
router.delete("/products/:id", deleteProduct);

// ORDINE
// GET /api/admin/orders
router.get("/orders", getOrdersAdmin);
// PUT /api/admin/orders/:id/status
router.put("/orders/:id/status", updateOrderStatus);

export default router;
