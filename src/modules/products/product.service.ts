import { prisma } from '../../config/prisma';

export interface ProductListQuery {
  page?: number;
  limit?: number;
  category?: string;
  collection?: string;
  tag?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'trending';
  search?: string;
  isFeatured?: boolean;
}

export class ProductService {
  static async listProducts(query: ProductListQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
    };

    if (query.category) {
      where.category = {
        slug: query.category,
      };
    }

    if (query.collection && query.collection !== 'all') {
      where.collections = {
        has: query.collection,
      };
    }

    if (query.tag) {
      where.tags = {
        has: query.tag,
      };
    }

    if (query.isFeatured !== undefined) {
      where.isFeatured = query.isFeatured;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (query.sort === 'price_asc') {
      orderBy = { salePrice: 'asc' };
    } else if (query.sort === 'price_desc') {
      orderBy = { salePrice: 'desc' };
    } else if (query.sort === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else if (query.sort === 'trending') {
      orderBy = { viewCount: 'desc' };
    }

    const [products, totalItems] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 2,
          },
          variants: {
            select: {
              id: true,
              sku: true,
              size: true,
              colorName: true,
              colorHex: true,
              stockCount: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Format for high-converting storefront
    const formattedProducts = products.map((p) => {
      const availableSizes = Array.from(new Set(p.variants.map((v) => v.size)));
      const availableColors = Array.from(
        new Map(p.variants.map((v) => [v.colorName, { name: v.colorName, hex: v.colorHex }])).values()
      );
      const totalStock = p.variants.reduce((acc, v) => acc + v.stockCount, 0);

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        basePrice: p.basePrice,
        salePrice: p.salePrice || p.basePrice,
        discountPercentage: p.salePrice ? Math.round(((p.basePrice - p.salePrice) / p.basePrice) * 100) : 0,
        primaryImage: p.images[0]?.publicUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c',
        hoverImage: p.images[1]?.publicUrl || null,
        availableSizes,
        availableColors,
        totalStock,
        isSoldOut: totalStock === 0,
        isFeatured: p.isFeatured,
        tags: p.tags || [],
        collections: p.collections || [],
        viewCount: p.viewCount || 0,
      };
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
      products: formattedProducts,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  static async getCuratedCollections() {
    const storeSetting = await prisma.storeSetting.findFirst({
      where: { id: 'default' },
    });
    const defaultList = ['Festive Wear', 'Monsoon Edit', 'New Arrivals', 'Trending Now', 'Handloom Heritage'];
    const collectionsList = (storeSetting?.curatedCollections && storeSetting.curatedCollections.length > 0)
      ? storeSetting.curatedCollections
      : defaultList;

    const counts = await Promise.all(
      collectionsList.map(async (col) => {
        const count = await prisma.product.count({
          where: {
            isActive: true,
            collections: { has: col },
          },
        });
        return {
          name: col,
          slug: col,
          count,
        };
      })
    );

    const totalActive = await prisma.product.count({ where: { isActive: true } });

    return [
      { name: 'All Pieces', slug: 'all', count: totalActive },
      ...counts,
    ];
  }

  static async getProductBySlug(slug: string) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        variants: {
          orderBy: [{ colorName: 'asc' }, { size: 'asc' }],
        },
      },
    });

    if (!product || !product.isActive) {
      const error: any = new Error('Product not found or currently unavailable');
      error.statusCode = 404;
      throw error;
    }

    // Increment viewCount asynchronously in background
    prisma.product
      .update({
        where: { id: product.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => console.error('Failed to increment product viewCount:', err));

    const availableColors = Array.from(
      new Map(product.variants.map((v) => [v.colorName, { name: v.colorName, hex: v.colorHex }])).values()
    );
    const availableSizes = Array.from(new Set(product.variants.map((v) => v.size)));

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      fabricCare: product.fabricCare,
      basePrice: product.basePrice,
      salePrice: product.salePrice || product.basePrice,
      discountPercentage: product.salePrice
        ? Math.round(((product.basePrice - product.salePrice) / product.basePrice) * 100)
        : 0,
      category: product.category,
      images: product.images,
      variants: product.variants,
      availableColors,
      availableSizes,
      tags: product.tags || [],
      collections: product.collections || [],
      viewCount: product.viewCount || 0,
    };
  }

  static async listCategories() {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl,
      productCount: c._count.products,
    }));
  }

  static async createCategory(input: { name: string; slug?: string; imageUrl?: string }) {
    const { name, imageUrl } = input;
    if (!name || !name.trim()) {
      const error: any = new Error('Category name is required');
      error.statusCode = 400;
      throw error;
    }

    const baseSlug = (input.slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    let slug = baseSlug || `cat-${Date.now().toString(36)}`;
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      slug = `${baseSlug}-${Date.now().toString(36)}`;
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        imageUrl: imageUrl || null,
      },
    });

    return category;
  }

  static async updateCategory(id: string, input: { name?: string; slug?: string; imageUrl?: string }) {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      const error: any = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }

    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      const conflict = await prisma.category.findUnique({ where: { slug: input.slug } });
      if (conflict && conflict.id !== id) {
        slug = `${input.slug}-${Date.now().toString(36)}`;
      } else {
        slug = input.slug;
      }
    } else if (input.name && !input.slug && input.name !== existing.name) {
      const baseSlug = input.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const conflict = await prisma.category.findUnique({ where: { slug: baseSlug } });
      if (conflict && conflict.id !== id) {
        slug = `${baseSlug}-${Date.now().toString(36)}`;
      } else {
        slug = baseSlug;
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name.trim() }),
        slug,
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl || null }),
      },
    });

    return updated;
  }

  static async deleteCategory(id: string) {
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) {
      const error: any = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }

    if (existing._count.products > 0) {
      const error: any = new Error(
        `Cannot delete "${existing.name}" because it contains ${existing._count.products} product(s). Please reassign or delete these products first.`
      );
      error.statusCode = 400;
      throw error;
    }

    await prisma.category.delete({ where: { id } });
    return { id, message: `Category "${existing.name}" deleted successfully` };
  }

  // --- Admin Product Management Operations ---

  static async listAdminProducts(query?: {
    search?: string;
    categoryId?: string;
    collection?: string;
    tag?: string;
    status?: 'active' | 'draft' | 'all';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.status === 'active') {
      where.isActive = true;
    } else if (query?.status === 'draft') {
      where.isActive = false;
    }

    if (query?.categoryId && query.categoryId !== 'all') {
      where.categoryId = query.categoryId;
    }

    if (query?.collection && query.collection !== 'all') {
      where.collections = { has: query.collection };
    }

    if (query?.tag) {
      where.tags = { has: query.tag };
    }

    if (query?.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { variants: { some: { sku: { contains: query.search } } } },
      ];
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          variants: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    const formatted = products.map((p) => {
      const totalStock = p.variants.reduce((acc, v) => acc + v.stockCount, 0);
      return {
        ...p,
        totalStock,
        primaryImage: p.images[0]?.publicUrl || '',
        thumbnail: p.images[0]?.publicUrl || '',
        previewUrl: `/products/${p.slug}`,
      };
    });

    return {
      products: formatted,
      items: formatted,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
      },
    });

    if (!product) {
      const error: any = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    const totalStock = product.variants.reduce((acc, v) => acc + v.stockCount, 0);
    return {
      ...product,
      totalStock,
      primaryImage: product.images[0]?.publicUrl || '',
      thumbnail: product.images[0]?.publicUrl || '',
      previewUrl: `/products/${product.slug}`,
    };
  }

  static async toggleProductStatus(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      const error: any = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
      },
    });

    return updated;
  }

  static async toggleProductCollection(productId: string, collectionName: string) {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      const error: any = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    const currentCollections = existing.collections || [];
    let updatedCollections: string[];
    if (currentCollections.includes(collectionName)) {
      updatedCollections = currentCollections.filter((c) => c !== collectionName);
    } else {
      updatedCollections = [...currentCollections, collectionName];
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { collections: updatedCollections },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
      },
    });

    return updated;
  }

  static async quickUpdateStock(variantId: string, stockCount: number) {
    const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!existing) {
      const error: any = new Error('Variant not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: { stockCount: Math.max(0, Number(stockCount) || 0) },
    });

    return updated;
  }

  static async bulkUpdateStock(updates: Array<{ variantId: string; stockCount: number }>) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.productVariant.update({
          where: { id: u.variantId },
          data: { stockCount: Math.max(0, Number(u.stockCount) || 0) },
        })
      )
    );
    return { success: true, updatedCount: updates.length };
  }

  static async createProduct(input: any) {
    const { images, variants, categoryId, ...prodData } = input;

    // Auto-generate unique slug if not provided
    const baseSlug = (input.slug || input.title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const newProduct = await prisma.product.create({
      data: {
        ...prodData,
        slug,
        categoryId,
        ...(images && images.length > 0
          ? {
              images: {
                create: images.map((img: any, i: number) => ({
                  publicUrl: img.publicUrl,
                  r2Key: img.r2Key || `products/${slug}-${i}.webp`,
                  altText: img.altText || `${prodData.title} image`,
                  sortOrder: img.sortOrder ?? i,
                })),
              },
            }
          : {}),
        ...(variants && variants.length > 0
          ? {
              variants: {
                create: variants.map((v: any) => ({
                  sku: v.sku,
                  size: v.size,
                  colorName: v.colorName,
                  colorHex: v.colorHex || '#800020',
                  stockCount: Number(v.stockCount) || 0,
                  priceDelta: v.priceDelta ? Number(v.priceDelta) : 0,
                })),
              },
            }
          : {}),
      },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: true,
      },
    });

    return newProduct;
  }

  static async updateProduct(id: string, input: any) {
    const { images, variants, categoryId, ...prodData } = input;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      const error: any = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            ...prodData,
            ...(categoryId && { categoryId }),
          },
        });

      // Update images if provided
      if (images && images.length > 0) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          await tx.productImage.create({
            data: {
              productId: id,
              publicUrl: img.publicUrl,
              r2Key: img.r2Key || `products/${id}-${i}.webp`,
              altText: img.altText || 'Product image',
              sortOrder: img.sortOrder ?? i,
            },
          });
        }
      }

      // Update variants safely without violating Foreign Key constraints
      if (variants && variants.length > 0) {
        const existingVariants = await tx.productVariant.findMany({ where: { productId: id } });
        const processedVariantIds = new Set<string>();

        for (const v of variants) {
          const matched = existingVariants.find(
            (ev) => ev.sku === v.sku || (ev.size === v.size && ev.colorName === v.colorName)
          );

          if (matched) {
            await tx.productVariant.update({
              where: { id: matched.id },
              data: {
                sku: v.sku || matched.sku,
                stockCount: Number(v.stockCount) || 0,
                colorHex: v.colorHex || matched.colorHex || '#800020',
                priceDelta: v.priceDelta ? Number(v.priceDelta) : 0,
              },
            });
            processedVariantIds.add(matched.id);
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId: id,
                sku: v.sku,
                size: v.size,
                colorName: v.colorName,
                colorHex: v.colorHex || '#800020',
                stockCount: Number(v.stockCount) || 0,
                priceDelta: v.priceDelta ? Number(v.priceDelta) : 0,
              },
            });
            processedVariantIds.add(created.id);
          }
        }

        // Delete removed variants only if not referenced by any order items
        for (const ev of existingVariants) {
          if (!processedVariantIds.has(ev.id)) {
            const hasOrders = await tx.orderItem.count({ where: { variantId: ev.id } });
            if (hasOrders === 0) {
              await tx.productVariant.delete({ where: { id: ev.id } });
            } else {
              // Retain with zero stock to maintain historical order integrity
              await tx.productVariant.update({ where: { id: ev.id }, data: { stockCount: 0 } });
            }
          }
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          variants: true,
        },
      });
    }, {
      timeout: 20000,
      maxWait: 10000,
    });

    return updated;
  }

  static async deleteProduct(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      const error: any = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if any variants have orders
    const ordersCount = await prisma.orderItem.count({
      where: { variant: { productId: id } },
    });

    if (ordersCount > 0) {
      // Soft-archive to preserve customer order history
      await prisma.product.update({
        where: { id },
        data: { isActive: false, isFeatured: false },
      });
      return { id, message: 'Product has customer order history. It has been deactivated and archived.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productVariant.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    return { id, message: 'Product deleted successfully' };
  }

  static async validateCartItems(variantIds: string[]) {
    if (!Array.isArray(variantIds) || variantIds.length === 0) {
      return { validItems: [], removedVariantIds: [] };
    }

    const cleanIds = variantIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (cleanIds.length === 0) {
      return { validItems: [], removedVariantIds: [] };
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: cleanIds },
        product: { isActive: true },
      },
      include: {
        product: {
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
    });

    const validVariantIdSet = new Set(variants.map((v) => v.id));
    const removedVariantIds = cleanIds.filter((id) => !validVariantIdSet.has(id));

    const validItems = variants.map((v) => ({
      variantId: v.id,
      productId: v.productId,
      productTitle: v.product.title,
      slug: v.product.slug,
      size: v.size,
      colorName: v.colorName,
      colorHex: v.colorHex || undefined,
      unitPrice: (v.product.salePrice || v.product.basePrice) + (v.priceDelta || 0),
      image: v.product.images[0]?.publicUrl || '',
      maxStock: v.stockCount,
    }));

    return { validItems, removedVariantIds };
  }
}
