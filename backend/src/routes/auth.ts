import { Router } from "express";
import { register, login, getProfile } from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// REGISTRAZIONE NUOVO UTENTE
// POST /api/auth/register

router.post("/register", register);

// LOGIN
// POST /api/auth/login

router.post("/login", login);

// Profilo utente corrente
// GET /api/auth/me

router.get("/me", authenticateToken, getProfile);

export default router;
