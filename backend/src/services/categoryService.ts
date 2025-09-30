import { prisma } from "../utils/prisma";

// ===========================================
//           CATEGORY SERVICE CLASS
// ===========================================

export class CategoryService {
  // ===========================================
  //             UTILITY METHODS
  // ===========================================

  // GENERA SLUG DA NOME CATEGORIA
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "") // RIMUOVI CARATTERI SPECIALI
      .replace(/\s+/g, "-") // SOSTITUISCI SPAZI CON TRATTINI
      .trim();
  }

  // ===========================================
  //            RETRIEVAL METHODS
  // ===========================================

  // OTTIENI CATEGORIA CON PRODOTTI
  static async getCategoryWithProducts(
    slug: string,
    includeInactive: boolean = false
  ) {
    return await prisma.category.findUnique({
      where: { slug },
      include: {
        products: {
          where: includeInactive ? {} : { isActive: true },
          include: {
            images: {
              where: { isMain: true },
              take: 1,
            },
            tags: true,
            _count: {
              select: { reviews: true },
            },
          },
        },
        children: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        parent: true,
      },
    });
  }

  // OTTIENI ALBERO COMPLETO CATEGORIE
  static async getCategoryTree() {
    const rootCategories = await prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            _count: {
              select: { products: { where: { isActive: true } } },
            },
          },
        },
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return rootCategories;
  }

  // ===========================================
  //           NAVIGATION METHODS
  // ===========================================

  // OTTIENI BREADCRUMB PER CATEGORIA
  static async getCategoryBreadcrumb(
    categoryId: string
  ): Promise<Array<{ id: string; name: string; slug: string }>> {
    const breadcrumb: Array<{ id: string; name: string; slug: string }> = [];

    let currentCategory = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, slug: true, parentId: true },
    });

    // RISALI LA GERARCHIA FINO ALLA ROOT
    while (currentCategory) {
      breadcrumb.unshift({
        id: currentCategory.id,
        name: currentCategory.name,
        slug: currentCategory.slug,
      });

      if (currentCategory.parentId) {
        currentCategory = await prisma.category.findUnique({
          where: { id: currentCategory.parentId },
          select: { id: true, name: true, slug: true, parentId: true },
        });
      } else {
        break;
      }
    }

    return breadcrumb;
  }

  // ===========================================
  //            ADDITIONAL METHODS
  // ===========================================

  // OTTIENI TUTTE LE CATEGORIE ATTIVE
  static async getAllActiveCategories() {
    return await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  // CERCA CATEGORIE PER NOME
  static async searchCategories(searchTerm: string) {
    return await prisma.category.findMany({
      where: {
        isActive: true,
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  // OTTIENI CATEGORIE POPOLARI (con più prodotti)
  static async getPopularCategories(limit: number = 10) {
    return await prisma.category.findMany({
      where: { isActive: true },
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
  }

  // ===========================================
  //             VALIDATION METHODS
  // ===========================================

  // CONTROLLA SE CATEGORIA ESISTE
  static async categoryExists(slug: string): Promise<boolean> {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    return !!category;
  }

  // CONTROLLA SE SLUG È UNICO
  static async isSlugUnique(
    slug: string,
    excludeId?: string
  ): Promise<boolean> {
    const existingCategory = await prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existingCategory) return true;
    if (excludeId && existingCategory.id === excludeId) return true;

    return false;
  }
}
