import { Router, Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service';
import { sendSuccess } from '../../utils/response';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../../middleware/validate.middleware';
import { publicCache, noCache } from '../../middleware/cache.middleware';
import { catalogRateLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// Public route to fetch store settings (Always real-time, no stale browser cache)
router.get('/settings', catalogRateLimiter, noCache, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await SettingsService.getSettings();
    return sendSuccess(res, { settings }, 'Store settings retrieved');
  } catch (error) {
    next(error);
  }
});

// Admin routes (Never cached)
router.use('/admin', noCache);
router.get(
  '/admin/settings',
  authenticate,
  requireRole('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await SettingsService.getSettings();
      return sendSuccess(res, { settings }, 'Admin store settings retrieved');
    } catch (error) {
      next(error);
    }
  }
);

const updateSettingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  supportEmail: z.string().email().optional(),
  supportPhone: z.string().min(5).optional(),
  whatsappNumber: z.string().min(5).optional(),
  upiVpa: z.string().min(3).optional(),
  upiPayeeName: z.string().min(1).optional(),
  codFee: z.number().min(0).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  standardShippingFee: z.number().min(0).optional(),
  announcementText: z.string().optional(),
  isAnnouncementActive: z.boolean().optional(),
});

router.put(
  '/admin/settings',
  authenticate,
  requireRole('ADMIN'),
  validate(updateSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await SettingsService.updateSettings(req.body);
      return sendSuccess(res, { settings }, 'Store settings updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
