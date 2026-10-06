import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';
import { sendSuccess } from '../../utils/response';

export class PaymentController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, currency, notes } = req.body;
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Valid positive amount in INR is required' });
      }

      const orderData = await PaymentService.createRazorpayOrder({ amount, currency, notes });
      return sendSuccess(res, orderData, 'Razorpay order created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      if (!razorpayOrderId || !razorpayPaymentId) {
        return res.status(400).json({
          success: false,
          message: 'Both razorpayOrderId and razorpayPaymentId are required',
        });
      }

      const verification = PaymentService.verifyPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      return sendSuccess(res, verification, 'Razorpay payment verified & acknowledged');
    } catch (error) {
      next(error);
    }
  }
}
