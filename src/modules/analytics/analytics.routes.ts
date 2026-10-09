import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { Role } from '../../types';
import { noCache } from '../../middleware/cache.middleware';

const router = Router();

// Public storefront activity & telemetry ingestion (ad-blocker resilient aliases)
router.post('/store/activity', AnalyticsController.recordEvent);
router.post('/telemetry/event', AnalyticsController.recordEvent);
router.post('/analytics/event', AnalyticsController.recordEvent);

// Protected Admin Analytics Endpoints
router.get(
  '/admin/analytics',
  noCache,
  authenticate,
  requireRole(Role.ADMIN),
  AnalyticsController.getStoreAnalytics
);

router.get(
  '/admin/analytics/export',
  noCache,
  authenticate,
  requireRole(Role.ADMIN),
  AnalyticsController.exportReport
);

export default router;
