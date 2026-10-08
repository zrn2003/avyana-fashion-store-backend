import { Router } from 'express';
import { OrderController } from './order.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createOrderSchema,
  fulfillOrderSchema,
  updatePaymentStatusSchema,
  updateOrderStatusSchema,
} from './order.schema';
import { authenticate, optionalAuth, requireRole } from '../../middleware/auth.middleware';
import { Role } from '../../types';
import { orderRateLimiter } from '../../middleware/rateLimit.middleware';
import { noCache } from '../../middleware/cache.middleware';

const router = Router();

// Orders are sensitive financial transactions: disable browser/proxy caching
router.use(noCache);

// Customer Endpoints
router.post('/orders', orderRateLimiter, authenticate, validate(createOrderSchema), OrderController.createOrder);
router.get('/orders/track', optionalAuth, OrderController.trackOrder);
router.get('/orders/my-orders', authenticate, OrderController.getMyOrders);

// Admin Portal Endpoints
router.get('/admin/overview', authenticate, requireRole(Role.ADMIN), OrderController.getAdminOverview);
router.get('/admin/orders', authenticate, requireRole(Role.ADMIN), OrderController.listAdminOrders);
router.get('/admin/orders/:id/receipt', authenticate, requireRole(Role.ADMIN), OrderController.getOrderReceipt);
router.post('/admin/orders/receipt/render', authenticate, requireRole(Role.ADMIN), OrderController.renderCustomReceipt);
router.patch(
  '/admin/orders/:id/fulfill',
  authenticate,
  requireRole(Role.ADMIN),
  validate(fulfillOrderSchema),
  OrderController.fulfillOrder
);
router.patch(
  '/admin/orders/:id/payment',
  authenticate,
  requireRole(Role.ADMIN),
  validate(updatePaymentStatusSchema),
  OrderController.updatePaymentStatus
);
router.patch(
  '/admin/orders/:id/status',
  authenticate,
  requireRole(Role.ADMIN),
  validate(updateOrderStatusSchema),
  OrderController.updateOrderStatus
);

export default router;
