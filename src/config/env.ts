import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().default('super-secret-boutique-access-key-2026'),
  JWT_REFRESH_SECRET: z.string().default('super-secret-boutique-refresh-key-2026'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  FIREBASE_PROJECT_ID: z.string().default('avyana-craft'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_CHAT_ID: z.string().optional().default(''),
  AWS_ENDPOINT_URL_S3: z.string().optional().default(''),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_REGION: z.string().default('us-east-2'),
  AWS_S3_BUCKET_NAME: z.string().default('fashion-store-data-img'),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional().default(''),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional().default(''),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().default('boutique-assets'),
  CLOUDFLARE_R2_PUBLIC_URL: z.string().default('https://images.unsplash.com'),
  BOUTIQUE_UPI_VPA: z.string().default('avyanacraft@okaxis'),
  BOUTIQUE_NAME: z.string().default('Avyana Craft'),
  COD_SURCHARGE_FEE: z.string().transform(Number).default('0.00'),
  FREE_SHIPPING_THRESHOLD: z.string().transform(Number).default('1500.00'),
  RATE_LIMIT_GLOBAL_MAX: z.string().transform(Number).default('1000'),
  RATE_LIMIT_AUTH_MAX: z.string().transform(Number).default('5'),
  RATE_LIMIT_AUTH_WINDOW_MINUTES: z.string().transform(Number).default('10'),
  RATE_LIMIT_UNAUTHORIZED_MAX: z.string().transform(Number).default('5'),
  RATE_LIMIT_UNAUTHORIZED_WINDOW_MINUTES: z.string().transform(Number).default('10'),
  RATE_LIMIT_ORDER_MAX: z.string().transform(Number).default('10'),
  RATE_LIMIT_MEDIA_MAX: z.string().transform(Number).default('30'),
  TRUST_PROXY: z.string().default('1'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      if (
        data.JWT_ACCESS_SECRET.includes('super-secret') ||
        data.JWT_ACCESS_SECRET.length < 32
      ) {
        return false;
      }
      if (
        data.JWT_REFRESH_SECRET.includes('super-secret') ||
        data.JWT_REFRESH_SECRET.length < 32
      ) {
        return false;
      }
    }
    return true;
  },
  {
    message:
      'In production, JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be strong, unique secrets of at least 32 characters and cannot use default placeholders.',
  }
);

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
