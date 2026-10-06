import { Router, Request, Response, NextFunction } from 'express';
import { MediaService } from './media.service';
import { sendSuccess, sendError } from '../../utils/response';
import { z } from 'zod';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { Role } from '../../types';
import { env } from '../../config/env';
import { mediaRateLimiter } from '../../middleware/rateLimit.middleware';
import { noCache } from '../../middleware/cache.middleware';

const router = Router();

router.use(noCache);

const presignedSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.string().min(1, 'File type is required'),
  folder: z.string().optional().default('products'),
});

// Admin-only: Generate presigned upload URL
router.post(
  '/presigned-url',
  mediaRateLimiter,
  authenticate,
  requireRole(Role.ADMIN),
  validate(presignedSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await MediaService.generatePresignedUrl(req.body);
      return sendSuccess(res, result, 'Presigned URL generated successfully');
    } catch (error) {
      next(error);
    }
  }
);

// List media assets (Admin-only)
router.get('/', authenticate, requireRole(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { folder, search } = req.query;
    const assets = await MediaService.listAssets(
      folder as string | undefined,
      search as string | undefined
    );
    return sendSuccess(res, { assets }, 'Media assets retrieved successfully');
  } catch (error) {
    next(error);
  }
});

// Register uploaded media asset (Admin-only)
const registerSchema = z.object({
  r2Key: z.string().min(1, 'r2Key is required'),
  publicUrl: z.string().url('Valid publicUrl is required'),
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.string().min(1, 'File type is required'),
  fileSize: z.number().optional(),
  folder: z.string().optional().default('products'),
  altText: z.string().optional(),
});

router.post(
  '/register',
  mediaRateLimiter,
  authenticate,
  requireRole(Role.ADMIN),
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const asset = await MediaService.registerAsset(req.body);
      return sendSuccess(res, { asset }, 'Media asset registered successfully');
    } catch (error) {
      next(error);
    }
  }
);

// Delete media asset (Admin-only)
router.delete('/:id', authenticate, requireRole(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await MediaService.deleteAsset(req.params.id);
    return sendSuccess(res, null, 'Media asset deleted successfully');
  } catch (error) {
    next(error);
  }
});

// Mock uploader endpoint strictly for non-production environments
router.put('/mock-upload', (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production') {
    return sendError(res, 'Not found', 404);
  }
  return res.status(200).send('Mock upload successful');
});

export default router;
