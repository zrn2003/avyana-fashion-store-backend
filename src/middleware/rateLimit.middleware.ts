import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { sendError } from '../utils/response';

/**
 * Standardized 429 Too Many Requests response handler
 */
const createRateLimitHandler = (message: string, defaultRetrySeconds: number = 600) => {
  return (req: Request, res: Response) => {
    const retryAfter = res.getHeader('Retry-After') || String(defaultRetrySeconds);
    return sendError(res, message, 429, {
      retryAfterSeconds: Number(retryAfter) || defaultRetrySeconds,
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
    'Too many requests from this IP address. Please slow down and try again shortly.',
    900
  ),
  skip: (req) => req.path === '/api/v1/health',
});

/**
 * 2. Authentication Rate Limiter:
 * Protects login, signup, password checks against credential stuffing and brute force.
 * Strict quota: 5 failed attempts within 10 minutes per IP before triggering a 10-minute lockout.
 * Successful logins/signups (HTTP 2xx) are exempt via skipSuccessfulRequests: true.
 */
export const authRateLimiter = rateLimit({
  windowMs: (env.RATE_LIMIT_AUTH_WINDOW_MINUTES || 10) * 60 * 1000,
  max: env.RATE_LIMIT_AUTH_MAX || 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many failed authentication attempts. For security reasons, your account/IP has been temporarily locked. Please wait 10 minutes before trying again.',
    (env.RATE_LIMIT_AUTH_WINDOW_MINUTES || 10) * 60
  ),
});

/**
 * 2b. Unauthorized Access Limiter (API Security Guard):
 * Protects protected endpoints from unauthorized probing and token spoofing.
 * Tracks 401 Unauthorized and 403 Forbidden responses per IP.
 * If 5 unauthorized attempts occur within 10 minutes, the client IP is locked out with 429.
 */
export const unauthorizedAccessLimiter = rateLimit({
  windowMs: (env.RATE_LIMIT_UNAUTHORIZED_WINDOW_MINUTES || 10) * 60 * 1000,
  max: env.RATE_LIMIT_UNAUTHORIZED_MAX || 5,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req: Request, res: Response) => {
    // 429 indicates active rate-limit lockout; do not decrement so lockout remains in force
    if (res.statusCode === 429) return false;
    // 401 Unauthorized or 403 Forbidden represent unauthorized strikes; keep them in the quota
    if (res.statusCode === 401 || res.statusCode === 403) return false;
    // All other valid requests (2xx, 3xx, non-auth client errors) are decremented
    return true;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many unauthorized access attempts detected. Your IP has been temporarily locked for 10 minutes for security purposes.',
    (env.RATE_LIMIT_UNAUTHORIZED_WINDOW_MINUTES || 10) * 60
  ),
  skip: (req: Request) =>
    req.path === '/api/v1/health' ||
    req.originalUrl.includes('/login') ||
    req.originalUrl.includes('/signup'),
});

/**
 * 2c. Token Refresh Limiter:
 * Allows legitimate active browsing sessions with multiple tabs to refresh tokens without false-positive 429 lockouts.
 * Default: 60 requests per 15 minutes per IP.
 */
export const tokenRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(
    'Too many session refresh attempts. Please log in again.',
    900
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
