import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import { sendSuccess } from '../../utils/response';

export class ProductController {
  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, category, collection, tag, sort, search, isFeatured } = req.query;
      const result = await ProductService.listProducts({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        category: category as string,
        collection: collection as string,
        tag: tag as string,
        sort: sort as any,
        search: search as string,
        isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      });
      return sendSuccess(res, result, 'Catalog retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getCuratedCollections(_req: Request, res: Response, next: NextFunction) {
    try {
      const collections = await ProductService.getCuratedCollections();
      return sendSuccess(res, { collections }, 'Curated collections retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getProductBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const product = await ProductService.getProductBySlug(slug);
      return sendSuccess(res, { product }, 'Product details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await ProductService.listCategories();
      return sendSuccess(res, { categories }, 'Categories retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await ProductService.createCategory(req.body);
      return sendSuccess(res, { category }, 'Category created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const category = await ProductService.updateCategory(id, req.body);
      return sendSuccess(res, { category }, 'Category updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await ProductService.deleteCategory(id);
      return sendSuccess(res, result, 'Category deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // --- Admin Controllers ---

  static async listAdminProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, categoryId, collection, tag, status, page, limit } = req.query;
      const result = await ProductService.listAdminProducts({
        search: search as string,
        categoryId: categoryId as string,
        collection: collection as string,
        tag: tag as string,
        status: status as any,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return sendSuccess(res, result, 'Admin product catalog retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);
      return sendSuccess(res, { product }, 'Product details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async toggleProductStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await ProductService.toggleProductStatus(id);
      const statusLabel = product.isActive ? 'Active (Live)' : 'Draft (Hidden)';
      return sendSuccess(res, { product }, `Product visibility changed to ${statusLabel}`);
    } catch (error) {
      next(error);
    }
  }

  static async toggleProductCollection(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { collectionName } = req.body;
      if (!collectionName) {
        return res.status(400).json({ success: false, message: 'collectionName is required' });
      }
      const product = await ProductService.toggleProductCollection(id, collectionName);
      return sendSuccess(res, { product }, `Collection pin updated for ${collectionName}`);
    } catch (error) {
      next(error);
    }
  }

  static async quickUpdateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params; // variantId
      const { stockCount } = req.body;
      const variant = await ProductService.quickUpdateStock(id, stockCount);
      return sendSuccess(res, { variant }, 'Variant stock count updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async bulkUpdateStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, message: 'Array of variant stock updates is required' });
      }
      const result = await ProductService.bulkUpdateStock(updates);
      return sendSuccess(res, result, `Bulk stock updated for ${result.updatedCount} variant SKUs successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.createProduct(req.body);
      return sendSuccess(
        res,
        {
          product,
          previewUrl: product ? `/products/${product.slug}` : '',
        },
        'Product drop created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await ProductService.updateProduct(id, req.body);
      return sendSuccess(res, { product }, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await ProductService.deleteProduct(id);
      return sendSuccess(res, result, 'Product deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async validateCart(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantIds } = req.body;
      const result = await ProductService.validateCartItems(variantIds || []);
      return sendSuccess(res, result, 'Cart validated successfully');
    } catch (error) {
      next(error);
    }
  }
}
