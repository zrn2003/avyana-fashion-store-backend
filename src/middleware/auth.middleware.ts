import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtUserPayload } from '../types';
import { sendError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export function getCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    token = getCookie(req.headers.cookie, 'boutique_access_token');
  }

  if (!token) {
    return sendError(res, 'Authentication required. No token provided.', 401);
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtUserPayload;
    req.user = payload;
    next();
  } catch {
    return sendError(res, 'Invalid or expired access token.', 401);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    token = getCookie(req.headers.cookie, 'boutique_access_token');
  }

  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtUserPayload;
      req.user = payload;
    } catch {
      // Ignore token error for optional auth
    }
  }
  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required.', 401);
    }
    if (req.user.role !== role) {
      return sendError(res, 'Forbidden: Insufficient privileges.', 403);
    }
    next();
  };
}
