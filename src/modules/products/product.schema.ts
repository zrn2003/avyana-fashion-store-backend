import { z } from 'zod';

export const productVariantInputSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  size: z.string().min(1, 'Size is required'),
  colorName: z.string().min(1, 'Color name is required'),
  colorHex: z.string().optional().default('#800020'),
  stockCount: z.number().int().min(0, 'Stock count must be a non-negative integer').default(0),
  priceDelta: z.number().optional().default(0),
});

export const productImageInputSchema = z.object({
  id: z.string().optional(),
  publicUrl: z.string().min(1, 'Image URL is required'),
  r2Key: z.string().optional().default(''),
  altText: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const createProductSchema = z.object({
  title: z.string().min(3, 'Product title must be at least 3 characters'),
  slug: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  fabricCare: z.string().nullable().optional(),
  basePrice: z.number().positive('Base price (MRP) must be greater than 0'),
  salePrice: z.number().positive('Sale price must be greater than 0').nullable().optional(),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  images: z.array(productImageInputSchema).min(1, 'At least one product image is required'),
  variants: z.array(productVariantInputSchema).min(1, 'At least one variant (size & color) is required'),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
