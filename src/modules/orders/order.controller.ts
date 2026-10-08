import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../config/prisma';
import {
  generateDeliveryStickerMarkdown,
  generateTaxInvoiceMarkdown,
  renderReceiptSvg,
} from './orderReceipt.service';

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

  static async getOrderReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const type = (req.query.type as string) || 'all';
      const format = (req.query.format as string) || 'json';

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const storeSettings = await prisma.storeSetting.findFirst();

      const stickerMarkdown = generateDeliveryStickerMarkdown(order, storeSettings);
      const invoiceMarkdown = generateTaxInvoiceMarkdown(order, storeSettings);

      if (format === 'svg') {
        const doc = type === 'invoice' ? invoiceMarkdown : stickerMarkdown;
        const svg = renderReceiptSvg(doc);
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svg);
      }

      const stickerSvg = renderReceiptSvg(stickerMarkdown);
      const invoiceSvg = renderReceiptSvg(invoiceMarkdown);

      return sendSuccess(
        res,
        {
          orderNumber: order.orderNumber,
          sticker: {
            markdown: stickerMarkdown,
            svg: stickerSvg,
          },
          invoice: {
            markdown: invoiceMarkdown,
            svg: invoiceSvg,
          },
        },
        'ReceiptLine documents generated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async renderCustomReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { markdown, cpl } = req.body;
      if (!markdown || typeof markdown !== 'string') {
        return res.status(400).json({ success: false, message: 'Markdown content is required' });
      }
      const svg = renderReceiptSvg(markdown, cpl ? Number(cpl) : 44);
      return sendSuccess(res, { svg }, 'Receipt rendered successfully');
    } catch (error) {
      next(error);
    }
  }
}
