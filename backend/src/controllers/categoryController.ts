import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { CategoryService } from "../services/categoryService";
import { prisma } from "../utils/prisma";

export const getPublicCategories = async (req: Request, res: Response) => {
  try {
    const categories = await CategoryService.getCategoryTree();

    res.json({
      success: true,
      message: "Categories retrieved successfully",
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    });
  }
};

export const getCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const {
      page = "1",
      limit = "12",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const category = await CategoryService.getCategoryWithProducts(slug);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const products = category.products
      .slice(skip, skip + limitNum)
      .sort((a, b) => {
        if (sortBy === "price") {
          return sortOrder === "asc"
            ? a.price.toNumber() - b.price.toNumber()
            : b.price.toNumber() - a.price.toNumber();
        }
        if (sortBy === "name") {
          return sortOrder === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }

        return sortOrder === "asc"
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const breadcrumb = await CategoryService.getCategoryBreadcrumb(category.id);

    res.json({
      success: true,
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          seoTitle: category.seoTitle,
          seoDescription: category.seoDescription,
        },
        products,
        breadcrumb,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: category.products.length,
          totalPages: Math.ceil(category.products.length / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Get category by slug error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch category",
    });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      parentId,
      seoTitle,
      seoDescription,
      sortOrder = 0,
    } = req.body;

    const slug = CategoryService.generateSlug(name);

    const existingCategory = await prisma.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        error: "Category with this name already exists",
      });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim(),
        parentId,
        seoTitle: seoTitle?.trim(),
        seoDescription: seoDescription?.trim(),
        sortOrder,
      },
      include: {
        parent: true,
        _count: {
          select: { products: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create category",
    });
  }
};

// CATEGORIA SINGOLA
// GET /api/categories/:id
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const includeInactive = req.query.includeInactive === "true";

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        children: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            _count: {
              select: { products: { where: { isActive: true } } },
            },
          },
        },
        _count: {
          select: {
            products: { where: includeInactive ? {} : { isActive: true } },
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Get category by ID error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch category",
    });
  }
};

// AGGIORNA CATEGORIA
// PUT /api/categories/:id
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    // Se il nome cambia, genera nuovo slug
    if (updateData.name && updateData.name !== existingCategory.name) {
      const newSlug = CategoryService.generateSlug(updateData.name);

      // Verifica che il nuovo slug non esista già
      const slugExists = await prisma.category.findFirst({
        where: {
          slug: newSlug,
          id: { not: id },
        },
      });

      if (slugExists) {
        return res.status(409).json({
          success: false,
          error: "A category with this name already exists",
        });
      }

      updateData.slug = newSlug;
    }

    // Controlla referenze circolari se cambia il parent
    if (
      updateData.parentId &&
      updateData.parentId !== existingCategory.parentId
    ) {
      if (updateData.parentId === id) {
        return res.status(400).json({
          success: false,
          error: "A category cannot be its own parent",
        });
      }

      // Verifica che il parent esista
      const parentExists = await prisma.category.findUnique({
        where: { id: updateData.parentId },
      });

      if (!parentExists) {
        return res.status(404).json({
          success: false,
          error: "Parent category not found",
        });
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { products: true, children: true },
        },
      },
    });

    res.json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update category",
    });
  }
};

// ELIMINA CATEGORIA
// DELETE /api/categories/:id
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { moveProductsTo } = req.body;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
        children: true,
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: "Category not found",
      });
    }

    if (category.children.length > 0) {
      return res.status(400).json({
        success: false,
        error:
          "Cannot delete category with subcategories. Delete subcategories first.",
      });
    }

    // Gestione prodotti nella categoria
    if (category.products.length > 0) {
      if (moveProductsTo) {
        const targetCategory = await prisma.category.findUnique({
          where: { id: moveProductsTo },
        });

        if (!targetCategory) {
          return res.status(404).json({
            success: false,
            error: "Target category not found",
          });
        }

        await prisma.product.updateMany({
          where: { categoryId: id },
          data: { categoryId: moveProductsTo },
        });
      } else {
        // Rimuovi categoria dai prodotti (categoryId = null)
        await prisma.product.updateMany({
          where: { categoryId: id },
          data: { categoryId: null },
        });
      }
    }

    // Elimina la categoria
    await prisma.category.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Category deleted successfully",
      data: {
        deletedCategoryId: id,
        productsAffected: category.products.length,
        movedToCategory: moveProductsTo || null,
      },
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete category",
    });
  }
};

// CATEGORIE POPOLARI
// GET /api/categories/popular
export const getPopularCategories = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        products: {
          some: { isActive: true },
        },
      },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: {
        products: {
          _count: "desc",
        },
      },
      take: limit,
    });

    res.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("Get popular categories error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch popular categories",
    });
  }
};

// RIORDINA CATEGORIE
// POST /api/categories/reorder
export const reorderCategories = async (req: Request, res: Response) => {
  try {
    const { categoryOrders } = req.body;

    if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
      return res.status(400).json({
        success: false,
        error: "categoryOrders must be a non-empty array",
      });
    }

    // Validazione struttura
    for (const item of categoryOrders) {
      if (!item.id || typeof item.sortOrder !== "number") {
        return res.status(400).json({
          success: false,
          error: "Each item must have id and sortOrder",
        });
      }
    }

    // Aggiorna tutti gli ordini
    const updatePromises = categoryOrders.map(({ id, sortOrder }) =>
      prisma.category.update({
        where: { id },
        data: { sortOrder },
      })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: "Categories reordered successfully",
    });
  } catch (error) {
    console.error("Reorder categories error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reorder categories",
    });
  }
};

// TUTT LE CATEGORIE PER ADMIN
// GET /api/categories/admin/all
export const getAdminCategories = async (req: Request, res: Response) => {
  try {
    const { search, isActive, hasProducts, parentId } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (parentId !== undefined) {
      where.parentId = parentId === "null" ? null : (parentId as string);
    }

    if (hasProducts === "true") {
      where.products = {
        some: { isActive: true },
      };
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: {
            products: { where: { isActive: true } },
            children: { where: { isActive: true } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    res.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("Get admin categories error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    });
  }
};

// GET /api/categories/:id/breadcrumb
export const getCategoryBreadcrumb = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const breadcrumb = await CategoryService.getCategoryBreadcrumb(id);

    res.json({
      success: true,
      data: breadcrumb,
    });
  } catch (error) {
    console.error("Get category breadcrumb error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get breadcrumb",
    });
  }
};
