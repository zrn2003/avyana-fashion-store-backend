import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  localSignupSchema,
  localLoginSchema,
  googleAuthSchema,
  refreshTokenSchema,
} from './auth.schema';
import { authenticate, optionalAuth } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { prisma } from '../../config/prisma';
import { authRateLimiter, tokenRefreshLimiter } from '../../middleware/rateLimit.middleware';
import { noCache } from '../../middleware/cache.middleware';

const router = Router();

// Ensure auth responses are never cached by intermediaries
router.use(noCache);

// Local Email/Password Auth (Protected against brute-force)
router.post('/signup/local', authRateLimiter, validate(localSignupSchema), AuthController.signupLocal);
router.post('/login/local', authRateLimiter, validate(localLoginSchema), AuthController.loginLocal);

// Google OAuth
router.post('/signup/google', authRateLimiter, validate(googleAuthSchema), AuthController.signupGoogle);
router.post('/login/google', authRateLimiter, validate(googleAuthSchema), AuthController.loginGoogle);

// Token Refresh & Logout
router.post('/refresh', tokenRefreshLimiter, validate(refreshTokenSchema), AuthController.refresh);
router.post('/logout', optionalAuth, AuthController.logout);

// Current User Profile
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        authProvider: true,
        avatarUrl: true,
        addresses: true,
      },
    });
    if (!user) {
      return sendError(res, 'User profile not found', 404);
    }
    return sendSuccess(res, { user }, 'User profile retrieved');
  } catch (error) {
    next(error);
  }
});

// Update User Profile & Delivery Address
router.put('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, phone, address } = req.body;

    // 1. Update basic user profile
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(fullName && { fullName: fullName.trim() }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
      },
    });

    // 2. If delivery address details are provided, upsert default address
    if (address && (address.streetLine1 || address.street)) {
      const streetLine1 = (address.streetLine1 || address.street || '').trim();
      const streetLine2 = (address.streetLine2 || '').trim() || null;
      const receiverName = (address.receiverName || fullName || '').trim();
      const addressPhone = (address.phone || phone || '').trim();
      const city = (address.city || '').trim();
      const state = (address.state || 'Maharashtra').trim();
      const pincode = (address.pincode || '').trim();

      const existingAddress = await prisma.address.findFirst({
        where: { userId: req.user!.userId, isDefault: true },
      });

      if (existingAddress) {
        await prisma.address.update({
          where: { id: existingAddress.id },
          data: {
            receiverName: receiverName || existingAddress.receiverName,
            phone: addressPhone || existingAddress.phone,
            streetLine1: streetLine1 || existingAddress.streetLine1,
            streetLine2,
            city: city || existingAddress.city,
            state: state || existingAddress.state,
            pincode: pincode || existingAddress.pincode,
          },
        });
      } else {
        await prisma.address.create({
          data: {
            userId: req.user!.userId,
            receiverName: receiverName || 'Boutique Customer',
            phone: addressPhone || '9876543210',
            streetLine1,
            streetLine2,
            city,
            state,
            pincode,
            isDefault: true,
          },
        });
      }
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        authProvider: true,
        avatarUrl: true,
        addresses: true,
      },
    });

    return sendSuccess(res, { user: updatedUser }, 'User profile and delivery address saved successfully');
  } catch (error) {
    next(error);
  }
});


export default router;
