import { Router } from "express";
import { getUserOrders } from "../controllers/orderController";
import { requireUser } from "../middleware/auth";

const router = Router();

// DEVONO ESSERE LOGGATI
router.use(requireUser);

// LISTA ORDINI UTENTE LOGGATO
// GET /api/user/orders
router.get("/orders", getUserOrders);

export default router;
