import { z } from 'zod';

export const createOrderSchema = z.object({
  customer: z.object({
    fullName: z.string().min(2, 'Full name is required'),
    phone: z.string().min(10, 'Valid 10-digit phone number is required'),
    email: z.string().email('Valid email address is required'),
    street: z.string().min(5, 'Street and flat/apartment details required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.string().regex(/^\d{6}$/, 'PIN code must be a 6-digit Indian postal code'),
  }),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1, 'Variant ID is required'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50, 'Maximum 50 units allowed per item'),
      })
    )
    .min(1, 'Order must contain at least one item')
    .max(30, 'Maximum 30 items per order'),
  paymentMethod: z.enum(['DIRECT_UPI', 'ONLINE_GATEWAY', 'COD']).default('ONLINE_GATEWAY'),
  upiUtrNumber: z.string().optional().nullable(),
  razorpayPaymentId: z.string().optional().nullable(),
  razorpayOrderId: z.string().optional().nullable(),
  razorpaySignature: z.string().optional().nullable(),
});

export const fulfillOrderSchema = z.object({
  courierName: z.string().min(2, 'Courier partner name is required'),
  trackingAwb: z.string().min(3, 'AWB / Consignment tracking number is required'),
  trackingUrl: z.string().url().optional().or(z.literal('')),
});

export const updatePaymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED']),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type FulfillOrderInput = z.infer<typeof fulfillOrderSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
