import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

export class CategoryService {
  //SLUG
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  }

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

  static async getCategoryBreadcrumb(
    categoryId: string
  ): Promise<Array<{ id: string; name: string; slug: string }>> {
    const breadcrumb: Array<{ id: string; name: string; slug: string }> = [];

    let currentCategory = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, slug: true, parentId: true },
    });

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
}
