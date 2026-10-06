import { Router } from 'express';
import { ProductController } from './product.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createProductSchema, updateProductSchema } from './product.schema';
import { Role } from '../../types';
import { catalogRateLimiter } from '../../middleware/rateLimit.middleware';
import { publicCache, noCache } from '../../middleware/cache.middleware';

const router = Router();

// Public Catalog Endpoints (High-throughput with CDN edge cache headers)
router.get('/products', catalogRateLimiter, publicCache(60, 300), ProductController.listProducts);
router.get('/products/:slug', catalogRateLimiter, publicCache(60, 300), ProductController.getProductBySlug);
router.get('/categories', catalogRateLimiter, publicCache(300, 900), ProductController.listCategories);

// Protected Admin Product Management Endpoints (Ensure no caching for real-time inventory)
router.use('/admin', noCache);
router.get(
  '/admin/products',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.listAdminProducts
);

router.get(
  '/admin/products/:id',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.getProductById
);

router.post(
  '/admin/products',
  authenticate,
  requireRole(Role.ADMIN),
  validate(createProductSchema),
  ProductController.createProduct
);

router.put(
  '/admin/products/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validate(updateProductSchema),
  ProductController.updateProduct
);

router.patch(
  '/admin/products/:id/toggle-status',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.toggleProductStatus
);

router.patch(
  '/admin/variants/:id/stock',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.quickUpdateStock
);

router.patch(
  '/admin/variants/bulk-stock',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.bulkUpdateStock
);

router.delete(
  '/admin/products/:id',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.deleteProduct
);

// Protected Admin Category Management Endpoints
router.post(
  '/admin/categories',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.createCategory
);

router.put(
  '/admin/categories/:id',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.updateCategory
);

router.delete(
  '/admin/categories/:id',
  authenticate,
  requireRole(Role.ADMIN),
  ProductController.deleteCategory
);

export default router;
