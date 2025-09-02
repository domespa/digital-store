import { Router } from "express";
import { getProducts, getProductById } from "../controllers/productController";

const router = Router();

// LISTA PRODOTTI PUBBLICI
// GET /api/products
router.get("/", getProducts);

// DETTAGLIO PRODOTTO
router.get("/:id", getProductById);

export default router;
