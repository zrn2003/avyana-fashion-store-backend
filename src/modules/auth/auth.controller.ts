import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { getCookie } from '../../middleware/auth.middleware';

const setAuthCookies = (res: Response, accessToken: string, refreshToken?: string) => {
  res.cookie('boutique_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  if (refreshToken) {
    res.cookie('boutique_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  // Client-readable indicator so frontend knows an active session exists before making /auth/me requests
  res.cookie('boutique_logged_in', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie('boutique_access_token', { path: '/' });
  res.clearCookie('boutique_refresh_token', { path: '/' });
  res.clearCookie('boutique_logged_in', { path: '/' });
};

export class AuthController {
  static async signupLocal(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.signupLocal(req.body);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      return sendSuccess(res, result, 'Account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async loginLocal(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.loginLocal(req.body);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      return sendSuccess(res, result, 'Login successful', 200);
    } catch (error) {
      next(error);
    }
  }

  static async signupGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.signupGoogle(req.body.idToken);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      return sendSuccess(res, result, 'Google registration successful', 201);
    } catch (error) {
      next(error);
    }
  }

  static async loginGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.loginGoogle(req.body.idToken);
      setAuthCookies(res, result.accessToken, result.refreshToken);
      return sendSuccess(res, result, 'Google login successful', 200);
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body?.refreshToken || getCookie(req.headers.cookie, 'boutique_refresh_token');
      if (!refreshToken) {
        return sendError(res, 'Refresh token is required', 400);
      }
      const result = await AuthService.refresh(refreshToken);
      setAuthCookies(res, result.accessToken);
      return sendSuccess(res, result, 'Token refreshed successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body?.refreshToken || getCookie(req.headers.cookie, 'boutique_refresh_token');
      const userId = req.user?.userId;
      await AuthService.logout(refreshToken, userId);
      clearAuthCookies(res);
      return sendSuccess(res, { success: true }, 'Logged out and session revoked successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
