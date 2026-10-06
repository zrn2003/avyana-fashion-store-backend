import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { sendError } from '../utils/response';

/**
 * Standardized 429 Too Many Requests response handler
 */
const createRateLimitHandler = (message: string) => {
  return (req: Request, res: Response) => {
    const retryAfter = res.getHeader('Retry-After') || '900';
    return sendError(res, message, 429, {
      retryAfterSeconds: Number(retryAfter) || 900,
      path: req.originalUrl,
    });
  };
};

/**
 * 1. Global Baseline Limiter:
 * Protects entire application against scraping, brute force, and volume bursts.
 * Default: 1,000 requests per 15 minutes per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_GLOBAL_MAX || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many requests from this IP address. Please slow down and try again shortly.'
  ),
  skip: (req) => req.path === '/api/v1/health',
});

/**
 * 2. Authentication Rate Limiter:
 * Protects login, signup, password checks, and token refresh against credential stuffing.
 * Default: 15 requests per 15 minutes per IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_AUTH_MAX || 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many authentication attempts. For security reasons, please wait 15 minutes before trying again.'
  ),
});

/**
 * 2b. Token Refresh Limiter:
 * Allows legitimate active browsing sessions with multiple tabs to refresh tokens without false-positive 429 lockouts.
 * Default: 60 requests per 15 minutes per IP.
 */
export const tokenRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many session refresh attempts. Please log in again.'
  ),
});

/**
 * 3. Order Checkout Rate Limiter:
 * Protects inventory reservation and prevents bot hoarding or checkout spam.
 * Default: 10 orders per 10 minutes per IP/User.
 */
export const orderRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.RATE_LIMIT_ORDER_MAX || 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || 'anonymous',
  handler: createRateLimitHandler(
    'Order placement rate limit reached. Please wait a few minutes before submitting another order.'
  ),
});

/**
 * 4. Media Upload Rate Limiter:
 * Restricts S3/R2 presigned URL generation and asset registration to prevent storage flooding.
 * Default: 30 requests per 15 minutes.
 */
export const mediaRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_MEDIA_MAX || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Media upload rate limit reached. Please wait before generating more upload signatures.'
  ),
});

/**
 * 5. Public Storefront Catalog Limiter:
 * High-throughput limiter for browsing products, search, and category navigation.
 * Default: 600 requests per 5 minutes per IP.
 */
export const catalogRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Browsing rate limit exceeded. Please pause for a moment and refresh.'
  ),
});
