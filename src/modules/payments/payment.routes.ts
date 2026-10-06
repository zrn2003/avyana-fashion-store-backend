import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { optionalAuth } from '../../middleware/auth.middleware';
import { noCache } from '../../middleware/cache.middleware';

const router = Router();

router.use(noCache);

// Razorpay Payment Endpoints
router.post('/razorpay/create-order', optionalAuth, PaymentController.createOrder);
router.post('/razorpay/verify', optionalAuth, PaymentController.verifyPayment);

export default router;
