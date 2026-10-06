import { Request, Response, NextFunction } from 'express';

/**
 * Cache-Control middleware for high-traffic public catalog endpoints.
 * Instructs browser caches and CDN edges (Cloudflare / Fastly / CloudFront) to cache responses.
 *
 * @param maxAgeSeconds Browser cache duration (default 60s)
 * @param sMaxAgeSeconds Shared CDN / Proxy edge cache duration (default 300s / 5m)
 * @param staleWhileRevalidate Seconds CDN can serve stale content while asynchronously revalidating (default 600s / 10m)
 */
export const publicCache = (
  maxAgeSeconds: number = 60,
  sMaxAgeSeconds: number = 300,
  staleWhileRevalidate: number = 600
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache safe idempotent GET/HEAD requests
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.setHeader(
        'Cache-Control',
        `public, max-age=${maxAgeSeconds}, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidate}`
      );
    }
    next();
  };
};

/**
 * Disables caching for sensitive, mutable, or user-specific authenticated endpoints.
 */
export const noCache = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};
