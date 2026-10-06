import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';
import { sendSuccess } from '../../utils/response';

export class OrderController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const result = await OrderService.createOrder(req.body, userId);
      return sendSuccess(res, result, 'Order placed successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async trackOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber, phone } = req.query;
      if (!orderNumber || !phone) {
        return res.status(400).json({ success: false, message: 'Both orderNumber and phone are required' });
      }
      const requestingUserId = req.user?.userId;
      const requestingUserRole = req.user?.role;
      const result = await OrderService.trackOrder(
        String(orderNumber),
        String(phone),
        requestingUserId,
        requestingUserRole
      );
      return sendSuccess(res, result, 'Order tracking details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async getMyOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const orders = await OrderService.getUserOrders(userId);
      return sendSuccess(res, { orders }, 'User orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async listAdminOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { filter } = req.query;
      const orders = await OrderService.listAdminOrders(filter as string);
      return sendSuccess(res, { orders }, 'Admin orders retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async fulfillOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await OrderService.fulfillOrder(id, req.body);
      return sendSuccess(res, result, 'Order marked as shipped and courier details saved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await OrderService.updatePaymentStatus(id, status);
      return sendSuccess(res, { order: updated }, 'Payment status updated');
    } catch (error) {
      next(error);
    }
  }

  static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await OrderService.updateOrderStatus(id, status);
      return sendSuccess(res, { order: updated }, `Order status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  static async getAdminOverview(_req: Request, res: Response, next: NextFunction) {
    try {
      const overview = await OrderService.getAdminOverview();
      return sendSuccess(res, overview, 'Admin overview analytics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
