import { Router } from "express";
import { createOrder, getOrderById } from "../controllers/orderController";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// CREA ORDINE DAL CARRELLO
// POST /api/orders
router.post("/", optionalAuth, createOrder);

// DETTAGLIO ORDINE
// GET /api/orders/:id
router.get("/:id", optionalAuth, getOrderById);

export default router;
