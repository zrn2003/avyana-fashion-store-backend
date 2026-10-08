import { prisma } from '../../config/prisma';
import { generateOrderNumber } from '../../utils/orderNumber';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../../types';
import { CreateOrderInput, FulfillOrderInput } from './order.schema';
import { PaymentService } from '../payments/payment.service';

function safeParseAddress(
  rawAddress: any,
  fallback?: { street?: string | null; city?: string | null; state?: string | null; pincode?: string | null }
): any {
  if (!rawAddress) return fallback || {};
  if (typeof rawAddress === 'object') return rawAddress;
  if (typeof rawAddress === 'string') {
    try {
      const parsed = JSON.parse(rawAddress);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch {
      return {
        street: fallback?.street || rawAddress,
        city: fallback?.city || '',
        state: fallback?.state || '',
        pincode: fallback?.pincode || '',
      };
    }
  }
  return fallback || {};
}

export class OrderService {
  static async createOrder(input: CreateOrderInput, userId?: string) {
    if (!userId) {
      const error: any = new Error('You must be logged in to place an order.');
      error.statusCode = 401;
      throw error;
    }

    const {
      customer,
      items,
      paymentMethod,
      upiUtrNumber,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    } = input;

    // Execute atomic transaction for inventory lock and order placement
    const order = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsToCreate: Array<{
        variantId: string;
        productTitle: string;
        variantDetails: string;
        sku: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
      }> = [];

      // Consolidate duplicate variant IDs if present in payload
      const quantityMap = new Map<string, number>();
      for (const item of items) {
        quantityMap.set(item.variantId, (quantityMap.get(item.variantId) || 0) + item.quantity);
      }
      const uniqueItems = Array.from(quantityMap.entries()).map(([variantId, quantity]) => ({
        variantId,
        quantity,
      }));

      for (const item of uniqueItems) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true },
        });

        if (!variant || !variant.product.isActive) {
          const error: any = new Error('One or more selected items are no longer available.');
          error.statusCode = 404;
          throw error;
        }

        // Atomically Check & Decrement Inventory to prevent concurrent overselling
        const updateResult = await tx.productVariant.updateMany({
          where: {
            id: variant.id,
            stockCount: { gte: item.quantity },
          },
          data: {
            stockCount: { decrement: item.quantity },
          },
        });

        if (updateResult.count === 0) {
          const error: any = new Error(
            `Insufficient stock for "${variant.product.title} (${variant.colorName} / ${variant.size})". Only ${variant.stockCount} left.`
          );
          error.statusCode = 409;
          throw error;
        }

        const basePrice = variant.product.salePrice ?? variant.product.basePrice;
        const unitPrice = Math.max(0, basePrice + (variant.priceDelta || 0));
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;

        orderItemsToCreate.push({
          variantId: variant.id,
          productTitle: variant.product.title,
          variantDetails: `${variant.colorName} / ${variant.size}`,
          sku: variant.sku,
          unitPrice,
          quantity: item.quantity,
          lineTotal,
        });
      }

      // Dynamic Shipping & Settings Lookup
      const storeSetting = await tx.storeSetting.findUnique({ where: { id: 'default' } });
      const freeShippingThreshold = storeSetting?.freeShippingThreshold ?? 1499;
      const standardShippingFee = storeSetting?.standardShippingFee ?? 99;
      const shippingFee = subtotal >= freeShippingThreshold ? 0 : standardShippingFee;
      const codFee = paymentMethod === 'COD' ? (storeSetting?.codFee ?? 50) : 0;
      const totalAmount = subtotal + shippingFee + codFee;

      const orderNumber = generateOrderNumber();

      // Determine Payment & Order Status with Cryptographic Signature Verification
      let initialPaymentStatus: PaymentStatus = PaymentStatus.PENDING;
      let initialOrderStatus: OrderStatus = OrderStatus.PLACED;
      let effectiveUtr: string | null = upiUtrNumber || null;
      let adminNotes: string | null = null;

      if (paymentMethod === 'ONLINE_GATEWAY' && razorpayPaymentId) {
        // Cryptographically verify Razorpay payment HMAC SHA-256 signature
        const paymentVerification = PaymentService.verifyPayment({
          razorpayOrderId: razorpayOrderId || '',
          razorpayPaymentId,
          razorpaySignature: razorpaySignature || undefined,
        });

        initialPaymentStatus = PaymentStatus.VERIFIED;
        initialOrderStatus = OrderStatus.CONFIRMED;
        effectiveUtr = razorpayPaymentId;
        adminNotes = JSON.stringify({
          gateway: 'RAZORPAY',
          paymentId: razorpayPaymentId,
          orderId: razorpayOrderId || null,
          signature: razorpaySignature || null,
          acknowledgedAt: paymentVerification.acknowledgedAt,
          verified: true,
          paymentMode: 'ONLINE_GATEWAY',
        });
      }

      let addressId: string | null = null;
      if (userId) {
        let userAddress = await tx.address.findFirst({
          where: { userId, isDefault: true },
        });
        if (!userAddress) {
          userAddress = await tx.address.create({
            data: {
              userId,
              receiverName: customer.fullName,
              phone: customer.phone,
              streetLine1: customer.street,
              city: customer.city,
              state: customer.state,
              pincode: customer.pincode,
              isDefault: true,
            },
          });
        }
        addressId = userAddress.id;
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: userId || null,
          addressId,
          shippingName: customer.fullName.trim(),
          shippingPhone: customer.phone.replace(/\D/g, '').slice(-10),
          shippingAddress: JSON.stringify(customer),
          shippingStreet: customer.street.trim(),
          shippingCity: customer.city.trim(),
          shippingState: customer.state.trim(),
          shippingPincode: customer.pincode.trim(),
          subtotal,
          shippingFee,
          discountTotal: 0,
          totalAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          paymentStatus: initialPaymentStatus,
          upiUtrNumber: effectiveUtr,
          adminNotes,
          orderStatus: initialOrderStatus,
          items: {
            create: orderItemsToCreate,
          },
          ...(razorpayPaymentId
            ? {
                transactions: {
                  create: [
                    {
                      gateway: 'RAZORPAY',
                      gatewayPaymentId: razorpayPaymentId,
                      gatewayOrderId: razorpayOrderId || null,
                      gatewaySignature: razorpaySignature || null,
                      amount: totalAmount,
                      currency: 'INR',
                      status: 'SUCCESS',
                      rawPayload: JSON.stringify({
                        paymentId: razorpayPaymentId,
                        orderId: razorpayOrderId || null,
                        signature: razorpaySignature || null,
                        verified: true,
                      }),
                    },
                  ],
                },
              }
            : effectiveUtr
            ? {
                transactions: {
                  create: [
                    {
                      gateway: 'DIRECT_UPI',
                      gatewayPaymentId: effectiveUtr,
                      amount: totalAmount,
                      currency: 'INR',
                      status: 'PENDING',
                    },
                  ],
                },
              }
            : {}),
        },
        include: {
          items: true,
          transactions: true,
        },
      });

      return createdOrder;
    });

    return {
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingName: order.shippingName,
      razorpayPaymentId: razorpayPaymentId || null,
      acknowledgedAt: new Date().toISOString(),
    };
  }

  static async trackOrder(
    orderNumber: string,
    phone: string,
    requestingUserId?: string,
    requestingUserRole?: string
  ) {
    const cleanOrderNumber = orderNumber.trim().toUpperCase();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    const order = await prisma.order.findUnique({
      where: { orderNumber: cleanOrderNumber },
      include: { items: true },
    });

    const orderPhoneClean = order ? order.shippingPhone.replace(/\D/g, '').slice(-10) : '';

    if (!order || orderPhoneClean !== cleanPhone) {
      const error: any = new Error(
        'Order details not found. Please verify both the Order Number and the 10-digit phone number used at checkout.'
      );
      error.statusCode = 404;
      throw error;
    }

    // STRICT CUSTOMER PRIVACY & ISOLATION CHECK:
    // If this order belongs to a registered customer account, only that customer or an admin can access/track it.
    // "no other will lookup on it"
    if (order.userId) {
      const isAdmin = requestingUserRole === 'ADMIN';
      const isOwner = requestingUserId && requestingUserId === order.userId;

      if (!isAdmin && !isOwner) {
        if (!requestingUserId) {
          const error: any = new Error(
            'This order is securely locked to a registered customer account. Please sign in to your customer account to view your order and live tracking.'
          );
          error.statusCode = 403;
          error.code = 'ACCOUNT_ORDER_LOCKED';
          throw error;
        } else {
          const error: any = new Error(
            'Access Denied: You cannot view orders belonging to other customers.'
          );
          error.statusCode = 403;
          error.code = 'UNAUTHORIZED_ORDER_ACCESS';
          throw error;
        }
      }
    }

    let razorpayDetails: any = null;
    if (order.adminNotes) {
      try {
        const parsed = JSON.parse(order.adminNotes);
        if (parsed.gateway === 'RAZORPAY') {
          razorpayDetails = parsed;
        }
      } catch {
        // ignore non-json admin notes
      }
    }

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      courierName: order.courierName,
      trackingAwb: order.trackingAwb,
      trackingUrl: order.trackingUrl,
      dispatchedAt: order.dispatchedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      items: order.items,
      razorpayDetails,
    };
  }

  static async getUserOrders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => {
      let razorpayDetails: any = null;
      if (order.adminNotes) {
        try {
          const parsed = JSON.parse(order.adminNotes);
          if (parsed.gateway === 'RAZORPAY') {
            razorpayDetails = parsed;
          }
        } catch {
          // ignore non-json notes
        }
      }
      return {
        ...order,
        shippingAddress: safeParseAddress(order.shippingAddress, {
          street: order.shippingStreet,
          city: order.shippingCity,
          state: order.shippingState,
          pincode: order.shippingPincode,
        }),
        razorpayDetails,
      };
    });
  }

  static async listAdminOrders(filter?: string) {
    let where: any = {};

    if (filter === 'action_required') {
      where.orderStatus = { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PACKED] };
    } else if (filter === 'in_transit') {
      where.orderStatus = OrderStatus.SHIPPED;
    } else if (filter === 'delivered') {
      where.orderStatus = OrderStatus.DELIVERED;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return orders.map((o) => {
      const tx = o.transactions?.[0];
      return {
        ...o,
        paymentId:
          tx?.gatewayPaymentId ||
          (o.upiUtrNumber ? `UPI-TXN-${o.orderNumber}` : `ORD-${o.orderNumber}`),
        gatewayPaymentId: tx?.gatewayPaymentId || null,
        shippingAddress: safeParseAddress(o.shippingAddress, {
          street: o.shippingStreet,
          city: o.shippingCity,
          state: o.shippingState,
          pincode: o.shippingPincode,
        }),
      };
    });
  }

  static async fulfillOrder(orderId: string, input: FulfillOrderInput) {
    const { courierName, trackingAwb, trackingUrl } = input;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      const error: any = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }

    if (order.orderStatus === OrderStatus.CANCELLED) {
      const error: any = new Error(
        'Cannot dispatch a cancelled order. Please reactivate or place a new order.'
      );
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: OrderStatus.SHIPPED,
        courierName,
        trackingAwb,
        trackingUrl: trackingUrl || null,
        dispatchedAt: new Date(),
      },
    });

    return {
      orderNumber: updated.orderNumber,
      orderStatus: updated.orderStatus,
      courierName: updated.courierName,
      trackingAwb: updated.trackingAwb,
      trackingUrl: updated.trackingUrl,
      dispatchedAt: updated.dispatchedAt,
    };
  }

  static async updatePaymentStatus(orderId: string, status: PaymentStatus | string) {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        const error: any = new Error('Order not found');
        error.statusCode = 404;
        throw error;
      }

      // Record transaction log when payment is verified
      if (status === PaymentStatus.VERIFIED && order.paymentStatus !== PaymentStatus.VERIFIED) {
        await tx.paymentTransaction.create({
          data: {
            orderId: order.id,
            gateway: order.paymentMethod,
            gatewayPaymentId: order.upiUtrNumber || `verified_${Date.now()}`,
            amount: order.totalAmount,
            status: 'SUCCESS',
            currency: 'INR',
            rawPayload: JSON.stringify({ verifiedAt: new Date().toISOString() }),
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: status as PaymentStatus,
          // Only promote to CONFIRMED if currently PLACED; do not downgrade PACKED/SHIPPED/DELIVERED
          ...(status === PaymentStatus.VERIFIED &&
            order.orderStatus === OrderStatus.PLACED && { orderStatus: OrderStatus.CONFIRMED }),
        },
      });
    });

    return updated;
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus | string) {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        const error: any = new Error('Order not found');
        error.statusCode = 404;
        throw error;
      }

      // State Transition Integrity: Delivered orders cannot be directly cancelled without return verification
      if (order.orderStatus === OrderStatus.DELIVERED && status === OrderStatus.CANCELLED) {
        const error: any = new Error(
          'Cannot directly cancel an order that has already been delivered. Delivered orders must proceed through the verified returns workflow.'
        );
        error.statusCode = 400;
        throw error;
      }

      // ACID Inventory Consistency Guarantee:
      // If transitioning to CANCELLED from an active order, restore inventory atomically
      if (status === OrderStatus.CANCELLED && order.orderStatus !== OrderStatus.CANCELLED) {
        for (const item of order.items) {
          await tx.productVariant.updateMany({
            where: { id: item.variantId },
            data: {
              stockCount: { increment: item.quantity },
            },
          });
        }
      }

      // If reactivating a CANCELLED order back to active, re-validate and decrement stock
      if (order.orderStatus === OrderStatus.CANCELLED && status !== OrderStatus.CANCELLED) {
        for (const item of order.items) {
          const updateRes = await tx.productVariant.updateMany({
            where: { id: item.variantId, stockCount: { gte: item.quantity } },
            data: { stockCount: { decrement: item.quantity } },
          });

          if (updateRes.count === 0) {
            const error: any = new Error(
              `Cannot reactivate order: Insufficient stock for item "${item.productTitle}".`
            );
            error.statusCode = 409;
            throw error;
          }
        }
      }

      const orderUpdated = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: status as OrderStatus,
          ...(status === OrderStatus.SHIPPED && !order.dispatchedAt && { dispatchedAt: new Date() }),
          ...(status === OrderStatus.DELIVERED && !order.deliveredAt && { deliveredAt: new Date() }),
        },
      });

      return orderUpdated;
    });

    return updated;
  }

  static async getAdminOverview() {
    const [
      recentOrders,
      totalOrders,
      revenueAgg,
      actionRequiredCount,
      inTransitCount,
      deliveredCount,
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockVariants,
    ] = await Promise.all([
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: {
          OR: [
            { paymentStatus: PaymentStatus.VERIFIED },
            { orderStatus: OrderStatus.DELIVERED },
          ],
        },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: {
          orderStatus: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.PACKED] },
        },
      }),
      prisma.order.count({ where: { orderStatus: OrderStatus.SHIPPED } }),
      prisma.order.count({ where: { orderStatus: OrderStatus.DELIVERED } }),
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: false } }),
      prisma.productVariant.findMany({
        where: { stockCount: { lte: 5 } },
        include: {
          product: {
            select: { id: true, title: true, slug: true },
          },
        },
        orderBy: { stockCount: 'asc' },
        take: 10,
      }),
    ]);

    const totalRevenue = revenueAgg._sum.totalAmount || 0;

    return {
      totalRevenue,
      totalOrders,
      actionRequiredCount,
      inTransitCount,
      deliveredCount,
      totalProducts,
      activeProducts,
      draftProducts,
      lowStockCount: lowStockVariants.length,
      lowStockVariants: lowStockVariants.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        colorName: v.colorName,
        stockCount: v.stockCount,
        productTitle: v.product.title,
        productSlug: v.product.slug,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        shippingName: o.shippingName,
        shippingPhone: o.shippingPhone,
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
        itemsCount: o.items.length,
      })),
    };
  }
}
