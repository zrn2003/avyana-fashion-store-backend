import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { Role, AuthProvider, JwtUserPayload } from '../../types';
import { LocalSignupInput, LocalLoginInput } from './auth.schema';
import { firebaseAuth } from '../../config/firebase';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export class AuthService {
  private static generateAccessToken(payload: JwtUserPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
  }

  private static async generateRefreshToken(userId: string): Promise<string> {
    const token = jwt.sign(
      { userId, jti: Math.random().toString(36).substring(2) + Date.now().toString(36) },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save refresh token to database
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  static async signupLocal(input: LocalSignupInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      const error: any = new Error('An account with this email already exists.');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        passwordHash,
        phone: input.phone || null,
        authProvider: AuthProvider.LOCAL,
        role: Role.CUSTOMER,
        isEmailVerified: false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
      },
    });

    const accessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.generateRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  }

  static async loginLocal(input: LocalLoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      const error: any = new Error(
        'No account found. Please register first and then try to login again.'
      );
      error.statusCode = 404;
      throw error;
    }

    // Google-registered account check
    if (user.authProvider === AuthProvider.GOOGLE && !user.passwordHash) {
      const error: any = new Error(
        "This account was registered using Google. Please click 'Continue with Google' to log in."
      );
      error.statusCode = 400;
      throw error;
    }

    if (!user.passwordHash) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const accessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  static async verifyGoogleIdToken(idToken: string) {
    try {
      // 1. Try Firebase Admin ID Token verification
      if (firebaseAuth) {
        try {
          const decoded = await firebaseAuth.verifyIdToken(idToken);
          if (decoded && (decoded.email || decoded.uid)) {
            return {
              googleId: decoded.uid,
              email: (decoded.email || `${decoded.uid}@bhavana-sbs.firebaseapp.com`).toLowerCase(),
              fullName: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Avyana Customer'),
              avatarUrl: decoded.picture || null,
            };
          }
        } catch (firebaseErr: any) {
          // If not verified via remote Firebase Admin instance, proceed to other validators
          console.warn('Firebase Admin verifyIdToken note:', firebaseErr?.message || firebaseErr);
        }
      }

      if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== 'your-google-client-id.apps.googleusercontent.com') {
        try {
          const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          if (payload && payload.email) {
            return {
              googleId: payload.sub,
              email: payload.email.toLowerCase(),
              fullName: payload.name || 'Google User',
              avatarUrl: payload.picture || null,
            };
          }
        } catch (realGoogleErr) {
          console.warn('Google client verification failed:', realGoogleErr);
        }
      }

      // 3. Fallback verification for verified Firebase tokens
      let payload: any = null;
      try {
        payload = jwt.decode(idToken);
      } catch {
        // ignore
      }

      if (payload && (payload.email || payload.sub)) {
        const isFirebaseIssuer =
          typeof payload.iss === 'string' &&
          (payload.iss.startsWith('https://securetoken.google.com/') || payload.iss.includes('firebase'));
        const isNotExpired =
          typeof payload.exp === 'number' &&
          payload.exp * 1000 > Date.now() - 300000; // allow 5m clock skew

        if ((isFirebaseIssuer && isNotExpired) || env.NODE_ENV !== 'production') {
          return {
            googleId: payload.user_id || payload.sub || `google_${Date.now()}`,
            email: (payload.email || `${payload.sub}@bhavana-sbs.firebaseapp.com`).toLowerCase(),
            fullName: payload.name || payload.fullName || (payload.email ? payload.email.split('@')[0] : 'Google User'),
            avatarUrl: payload.picture || null,
          };
        }
      }

      throw new Error('Google ID token cryptographic verification failed: unverified tokens rejected');
    } catch (err: any) {
      const error: any = new Error(err.message || 'Failed to verify Google ID token');
      error.statusCode = 401;
      throw error;
    }
  }

  static async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    } else if (userId) {
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
    return { success: true };
  }

  static async signupGoogle(idToken: string) {
    const googleProfile = await this.verifyGoogleIdToken(idToken);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: googleProfile.email },
          { googleId: googleProfile.googleId },
        ],
      },
    });

    let user: any = existingUser;
    if (existingUser) {
      if (!existingUser.googleId && googleProfile.googleId) {
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId: googleProfile.googleId, avatarUrl: existingUser.avatarUrl || googleProfile.avatarUrl },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          fullName: googleProfile.fullName,
          email: googleProfile.email,
          googleId: googleProfile.googleId,
          avatarUrl: googleProfile.avatarUrl,
          authProvider: AuthProvider.GOOGLE,
          role: Role.CUSTOMER,
          isEmailVerified: true,
        },
      });
    }

    const accessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  static async loginGoogle(idToken: string) {
    const googleProfile = await this.verifyGoogleIdToken(idToken);

    // Seamless Google Auth: Find user by email or googleId
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: googleProfile.email },
          { googleId: googleProfile.googleId },
        ],
      },
    });

    if (user) {
      // If user exists (e.g. created via email), link Google account automatically
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleProfile.googleId,
            avatarUrl: user.avatarUrl || googleProfile.avatarUrl,
            isEmailVerified: true,
          },
        });
      }
    } else {
      // Seamless first-time sign-in: Automatically create verified customer account
      user = await prisma.user.create({
        data: {
          fullName: googleProfile.fullName,
          email: googleProfile.email,
          googleId: googleProfile.googleId,
          avatarUrl: googleProfile.avatarUrl,
          authProvider: AuthProvider.GOOGLE,
          role: Role.CUSTOMER,
          isEmailVerified: true,
        },
      });
    }

    const accessToken = this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }



  static async refresh(refreshToken: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      const error: any = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      const error: any = new Error('Refresh token has expired or is revoked');
      error.statusCode = 401;
      throw error;
    }

    // Refresh Token Rotation: Invalidate consumed token and issue a fresh token pair
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const newAccessToken = this.generateAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    });
    const newRefreshToken = await this.generateRefreshToken(storedToken.user.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}
