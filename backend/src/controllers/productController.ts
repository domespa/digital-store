import { Request, Response } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";
import { currencyService } from "../services/currency";
import {
  CreateProductRequest,
  UpdateProductRequest,
  ProductListResponse,
  ProductDetailResponse,
  ProductMutationResponse,
  PublicProductResponse,
  ProductResponse,
  ProductFilters,
} from "../types/product";

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      currency?: string;
    }
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

const getStringParam = (param: unknown): string | undefined => {
  return typeof param === "string" ? param : undefined;
};

// LISTA PRODOTTI
// GET /api/products
export const getProducts = async (req: Request, res: Response) => {
  try {
    const search = getStringParam(req.query.search);
    const minPrice = getStringParam(req.query.minPrice);
    const maxPrice = getStringParam(req.query.maxPrice);
    const sortBy = getStringParam(req.query.sortBy) || "createdAt";
    const sortOrder = getStringParam(req.query.sortOrder) || "desc";
    const page = getStringParam(req.query.page) || "1";
    const limit = getStringParam(req.query.limit) || "10";

    const currency = req.currency || "EUR";

    // VALIDAZIONI PARAMETRI
    const validSortFields = ["name", "price", "createdAt"];
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const validSortOrder =
      sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";

    // FILTRI
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // FILTRI PREZZO
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};

      if (minPrice !== undefined) {
        let minPriceEUR = Number(minPrice);
        if (currency !== "EUR") {
          const conversion = await currencyService.convertPrice(
            Number(minPrice),
            currency,
            "EUR"
          );
          minPriceEUR = conversion.convertedAmount;
        }
        where.price.gte = minPriceEUR;
      }

      if (maxPrice !== undefined) {
        let maxPriceEUR = Number(maxPrice);
        if (currency !== "EUR") {
          const conversion = await currencyService.convertPrice(
            Number(maxPrice),
            currency,
            "EUR"
          );
          maxPriceEUR = conversion.convertedAmount;
        }
        where.price.lte = maxPriceEUR;
      }
    }

    // IMPAGINAZIONE
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [rawProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { [validSortBy]: validSortOrder },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    // MAPPIAMO PER CONVERTIRE DECIMAL IN NUMBER
    const productsWithCurrency = await Promise.all(
      rawProducts.map(async (product) => {
        const basePrice = product.price.toNumber();

        if (currency === "EUR") {
          return {
            ...product,
            price: basePrice,
            displayPrice: basePrice,
            currency: "EUR",
            originalPrice: basePrice,
            originalCurrency: "EUR",
            formattedPrice: currencyService.formatPrice(basePrice, "EUR"),
            exchangeRate: 1,
            exchangeSource: "same" as const,
          };
        }

        const conversion = await currencyService.convertPrice(
          basePrice,
          "EUR",
          currency
        );

        return {
          ...product,
          price: basePrice,
          displayPrice: conversion.convertedAmount,
          currency,
          originalPrice: basePrice,
          originalCurrency: "EUR",
          formattedPrice: currencyService.formatPrice(
            conversion.convertedAmount,
            currency
          ),
          exchangeRate: conversion.rate,
          exchangeSource: conversion.source,
        };
      })
    );

    res.json({
      success: true,
      message: "Products retrieved successfully",
      products: productsWithCurrency,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      currency: {
        current: currency,
        supported: currencyService.getSupportedCurrencies(),
      },
    });
  } catch (error: unknown) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get products",
    } as ProductListResponse);
  }
};

// DETTAGLIO PRODOTTO
// GET /api/products/:id

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currency = req.currency || "EUR";

    const rawProduct = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!rawProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      } as ProductDetailResponse);
    }

    if (!rawProduct.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not available",
      } as ProductDetailResponse);
    }

    const basePrice = rawProduct.price.toNumber();

    // CONVERTIRE DECIMAL IN NUMBER
    let productWithCurrency;

    if (currency === "EUR") {
      productWithCurrency = {
        ...rawProduct,
        price: basePrice,
        displayPrice: basePrice,
        currency: "EUR",
        originalPrice: basePrice,
        originalCurrency: "EUR",
        formattedPrice: currencyService.formatPrice(basePrice, "EUR"),
        exchangeRate: 1,
        exchangeSource: "same" as const,
      };
    } else {
      const conversion = await currencyService.convertPrice(
        basePrice,
        "EUR",
        currency
      );

      productWithCurrency = {
        ...rawProduct,
        price: basePrice,
        displayPrice: conversion.convertedAmount,
        currency,
        originalPrice: basePrice,
        originalCurrency: "EUR",
        formattedPrice: currencyService.formatPrice(
          conversion.convertedAmount,
          currency
        ),
        exchangeRate: conversion.rate,
        exchangeSource: conversion.source,
      };
    }

    res.json({
      success: true,
      message: "Product retrieved successfully",
      product: productWithCurrency,
      currency: {
        current: currency,
        supported: currencyService.getSupportedCurrencies(),
      },
    } as ProductDetailResponse);
  } catch (error: unknown) {
    console.error("Get product by id error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get product",
    } as ProductDetailResponse);
  }
};

// CREA PRODOTTO
// POST /api/admin/products
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      fileName,
      filePath,
      categoryId,
    }: CreateProductRequest = req.body;

    // VALIDAZIONE CAMPI
    if (!name || !price || !fileName || !filePath) {
      return res.status(400).json({
        success: false,
        message: "Name, price, fileName, and filePath are required",
      } as ProductMutationResponse);
    }

    // VALIDAZIONE PREZZO
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a positive number",
      } as ProductMutationResponse);
    }

    // CONTROLLO PRODOTTO GIA CREATO
    const existingProduct = await prisma.product.findFirst({
      where: {
        name: name.trim(),
        isActive: true,
      },
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "Product with this name already exists",
      } as ProductMutationResponse);
    }

    // CREAZIONE PRODOTTO
    const rawProduct = await prisma.product.create({
      data: {
        name: name.trim(),
        slug: generateSlug(name),
        description: description?.trim() || null,
        price: numPrice,
        fileName: fileName.trim(),
        filePath: filePath.trim(),
        isActive: true,
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        stock: 0,
        lowStockThreshold: 5,
        trackInventory: false,
        allowBackorder: false,
        viewCount: 0,
        downloadCount: 0,
        rating: 0,
        reviewCount: 0,
        isFeatured: false,
        isDigital: true,
      },
    });

    const newProduct: ProductResponse = {
      id: rawProduct.id,
      name: rawProduct.name,
      slug: rawProduct.slug,
      description: rawProduct.description,
      shortDescription: rawProduct.shortDescription,
      price: rawProduct.price.toNumber(),
      originalPrice: rawProduct.originalPrice
        ? rawProduct.originalPrice.toNumber()
        : null,
      fileName: rawProduct.fileName,
      filePath: rawProduct.filePath,
      createdAt: rawProduct.createdAt,
      updatedAt: rawProduct.updatedAt,
      publishedAt: rawProduct.publishedAt,
      stock: rawProduct.stock,
      lowStockThreshold: rawProduct.lowStockThreshold,
      trackInventory: rawProduct.trackInventory,
      allowBackorder: rawProduct.allowBackorder,
      viewCount: rawProduct.viewCount,
      downloadCount: rawProduct.downloadCount,
      rating: rawProduct.rating.toNumber(),
      reviewCount: rawProduct.reviewCount,
      isActive: rawProduct.isActive,
      isFeatured: rawProduct.isFeatured,
      isDigital: rawProduct.isDigital,
      seoTitle: rawProduct.seoTitle,
      seoDescription: rawProduct.seoDescription,
      categoryId: rawProduct.categoryId,
    };

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: newProduct,
    } as ProductMutationResponse);
  } catch (error: unknown) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
    } as ProductMutationResponse);
  }
};

// MODIFICA PRODTTO
// PUT /api/admin/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: UpdateProductRequest = req.body;

    // ESISTE?
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      } as ProductMutationResponse);
    }

    // PREPARIAMO I DATI PER LA MODIFICA
    const data: Prisma.ProductUpdateInput = {};

    if (updateData.name !== undefined) {
      data.name = updateData.name.trim();
      data.slug = generateSlug(updateData.name);
    }
    if (updateData.description !== undefined) {
      data.description = updateData.description?.trim() || null;
    }
    if (updateData.price !== undefined) {
      const numPrice = Number(updateData.price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a positive number",
        } as ProductMutationResponse);
      }
      data.price = numPrice;
    }
    if (updateData.fileName !== undefined) {
      data.fileName = updateData.fileName.trim();
    }
    if (updateData.filePath !== undefined) {
      data.filePath = updateData.filePath.trim();
    }
    if (updateData.isActive !== undefined) {
      data.isActive = updateData.isActive;
    }
    if (updateData.categoryId !== undefined) {
      if (updateData.categoryId === null) {
        data.category = { disconnect: true };
      } else {
        data.category = { connect: { id: updateData.categoryId } };
      }
    }
    if (updateData.stock !== undefined) {
      data.stock = updateData.stock;
    }
    if (updateData.lowStockThreshold !== undefined) {
      data.lowStockThreshold = updateData.lowStockThreshold;
    }
    if (updateData.trackInventory !== undefined) {
      data.trackInventory = updateData.trackInventory;
    }
    if (updateData.allowBackorder !== undefined) {
      data.allowBackorder = updateData.allowBackorder;
    }

    // CONTROLLO NOME DUPLICATO
    if (updateData.name && updateData.name.trim() !== existingProduct.name) {
      const duplicateProduct = await prisma.product.findFirst({
        where: {
          name: updateData.name.trim(),
          isActive: true,
          id: { not: id },
        },
      });

      if (duplicateProduct) {
        return res.status(409).json({
          success: false,
          message: "Product with this name already exists",
        } as ProductMutationResponse);
      }
    }

    // AGGIORNO IL PRODOTTO
    const rawUpdatedProduct = await prisma.product.update({
      where: { id },
      data,
    });

    const updatedProduct: ProductResponse = {
      id: rawUpdatedProduct.id,
      name: rawUpdatedProduct.name,
      slug: rawUpdatedProduct.slug,
      description: rawUpdatedProduct.description,
      shortDescription: rawUpdatedProduct.shortDescription,
      price: rawUpdatedProduct.price.toNumber(),
      originalPrice: rawUpdatedProduct.originalPrice
        ? rawUpdatedProduct.originalPrice.toNumber()
        : null,
      fileName: rawUpdatedProduct.fileName,
      filePath: rawUpdatedProduct.filePath,
      createdAt: rawUpdatedProduct.createdAt,
      updatedAt: rawUpdatedProduct.updatedAt,
      publishedAt: rawUpdatedProduct.publishedAt,
      stock: rawUpdatedProduct.stock,
      lowStockThreshold: rawUpdatedProduct.lowStockThreshold,
      trackInventory: rawUpdatedProduct.trackInventory,
      allowBackorder: rawUpdatedProduct.allowBackorder,
      viewCount: rawUpdatedProduct.viewCount,
      downloadCount: rawUpdatedProduct.downloadCount,
      rating: rawUpdatedProduct.rating.toNumber(),
      reviewCount: rawUpdatedProduct.reviewCount,
      isActive: rawUpdatedProduct.isActive,
      isFeatured: rawUpdatedProduct.isFeatured,
      isDigital: rawUpdatedProduct.isDigital,
      seoTitle: rawUpdatedProduct.seoTitle,
      seoDescription: rawUpdatedProduct.seoDescription,
      categoryId: rawUpdatedProduct.categoryId,
    };

    res.json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    } as ProductMutationResponse);
  } catch (error: unknown) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
    } as ProductMutationResponse);
  }
};

// ELIMINAZIONE PRODOTTO
// DELETE /api/admin/products/:id
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ESISTE?
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      } as ProductMutationResponse);
    }

    // ELIMINAZIONE SOFT
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: "Product deleted successfully",
    } as ProductMutationResponse);
  } catch (error: unknown) {
    console.error("Delete product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete product",
    } as ProductMutationResponse);
  }
};

// LISTA PRODOTTI PER ADMIN CON PATH
export const getProductsAdmin = async (req: Request, res: Response) => {
  try {
    const search = getStringParam(req.query.search);
    const minPrice = getStringParam(req.query.minPrice);
    const maxPrice = getStringParam(req.query.maxPrice);
    const isActive = getStringParam(req.query.isActive);
    const sortBy = getStringParam(req.query.sortBy) || "createdAt";
    const sortOrder = getStringParam(req.query.sortOrder) || "desc";
    const page = getStringParam(req.query.page) || "1";
    const limit = getStringParam(req.query.limit) || "10";

    // VALIDAZIONI PARAMETRI
    const validSortFields = ["name", "price", "createdAt"];
    const validSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const validSortOrder =
      sortOrder === "asc" || sortOrder === "desc" ? sortOrder : "desc";

    // FILTRI
    const where: Prisma.ProductWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // FILTRI PREZZO
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};

      if (minPrice !== undefined) {
        where.price.gte = Number(minPrice);
      }
      if (maxPrice !== undefined) {
        where.price.lte = Number(maxPrice);
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [rawProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [validSortBy]: validSortOrder },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    // CONVERTIRE DECIMAL IN NUMBER
    const products: ProductResponse[] = rawProducts.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      price: product.price.toNumber(),
      originalPrice: product.originalPrice
        ? product.originalPrice.toNumber()
        : null,
      fileName: product.fileName,
      filePath: product.filePath,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      publishedAt: product.publishedAt,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      trackInventory: product.trackInventory,
      allowBackorder: product.allowBackorder,
      viewCount: product.viewCount,
      downloadCount: product.downloadCount,
      rating: product.rating.toNumber(),
      reviewCount: product.reviewCount,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      isDigital: product.isDigital,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      categoryId: product.categoryId,
    }));

    res.json({
      success: true,
      message: "Products retrieved successfully",
      products,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      currency: "EUR",
    });
  } catch (error: unknown) {
    console.error("Get admin products error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get products",
    });
  }
};

// CONVERSIONE PREZZO MANUALE
export const convertProductPrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fromCurrency, toCurrency, amount } = req.body;

    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        message: "fromCurrency and toCurrency are required",
      });
    }

    let priceToConvert = amount;

    if (!amount && id) {
      const product = await prisma.product.findUnique({
        where: { id },
        select: { price: true, isActive: true, name: true },
      });

      if (!product || !product.isActive) {
        return res.status(404).json({
          success: false,
          message: "Product not found or not active",
        });
      }

      priceToConvert = product.price.toNumber();
    }

    if (!priceToConvert) {
      return res.status(400).json({
        success: false,
        message: "Amount or valid product ID required",
      });
    }

    const conversion = await currencyService.convertPrice(
      priceToConvert,
      fromCurrency,
      toCurrency
    );

    res.json({
      success: true,
      data: {
        originalAmount: priceToConvert,
        convertedAmount: conversion.convertedAmount,
        fromCurrency,
        toCurrency,
        exchangeRate: conversion.rate,
        source: conversion.source,
        formattedPrice: currencyService.formatPrice(
          conversion.convertedAmount,
          toCurrency
        ),
        timestamp: conversion.timestamp,
      },
    });
  } catch (error) {
    console.error("Convert price error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to convert price",
    });
  }
};
