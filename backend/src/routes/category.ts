import express from "express";
import {
  getPublicCategories,
  getCategoryBySlug,
  createCategory,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getPopularCategories,
  reorderCategories,
  getAdminCategories,
  getCategoryBreadcrumb,
} from "../controllers/categoryController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = express.Router();

//---------------- PUBBLICHE -------------------------------//
// GET /api/categories
router.get("/", getPublicCategories);
router.get("/popular", getPopularCategories);
router.get("/slug/:slug", getCategoryBySlug);
router.get("/:id", getCategoryById);
router.get("/:id/breadcrumb", getCategoryBreadcrumb);

//---------------- ADMIN -------------------------------//
// POST /api/categories
router.post("/", authenticateToken, requireAdmin, createCategory);
router.get("/admin/all", authenticateToken, requireAdmin, getAdminCategories);
router.put("/:id", authenticateToken, requireAdmin, updateCategory);
router.delete("/:id", authenticateToken, requireAdmin, deleteCategory);
router.post("/reorder", authenticateToken, requireAdmin, reorderCategories);

export default router;
