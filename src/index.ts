import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { sendSuccess, sendError } from './utils/response';
import { errorHandler } from './middleware/error.middleware';
import { globalRateLimiter, unauthorizedAccessLimiter } from './middleware/rateLimit.middleware';
import authRoutes from './modules/auth/auth.routes';
import productRoutes from './modules/products/product.routes';
import orderRoutes from './modules/orders/order.routes';
import mediaRoutes from './modules/media/media.routes';
import settingsRoutes from './modules/settings/settings.routes';
import paymentRoutes from './modules/payments/payment.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import logisticsRoutes from './modules/logistics/logistics.routes';

const app = express();

// Trust reverse proxy (Cloudflare, AWS ALB, Nginx, Railway, Render)
// Required for accurate IP extraction and rate-limiting behind load balancers
app.set('trust proxy', Number(env.TRUST_PROXY) || 1);

// Security & Header Hardening
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const configuredOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
      const isAllowed =
        configuredOrigins.includes(origin) ||
        origin === 'http://localhost:5173' ||
        origin === 'https://localhost:5173' ||
        origin === 'http://127.0.0.1:5173' ||
        origin === 'https://127.0.0.1:5173' ||
        /\.vercel\.app$/.test(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
      return callback(null, isAllowed);
    },
    credentials: true,
  })
);

// Global Baseline Rate Limiting (1,000 req / 15m)
app.use(globalRateLimiter);

// Strict Security Guard: Lock out IPs with 5 unauthorized (401/403) attempts for 10 minutes
app.use(unauthorizedAccessLimiter);

// Body Parsers (with size restrictions to prevent payload bloat)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', productRoutes);
app.use('/api/v1', orderRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1', settingsRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1', analyticsRoutes);
app.use('/api/v1/logistics', logisticsRoutes);

// Production Deep Health Check with Database Probing
app.get('/api/v1/health', async (_req: Request, res: Response) => {
  let dbStatus = 'connected';
  let dbLatencyMs = 0;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
  } catch (err: any) {
    dbStatus = 'disconnected';
    console.error('Database health check probe failed:', err?.message || err);
    return res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        database: dbStatus,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      message: 'Database service unavailable',
    });
  }

  return sendSuccess(
    res,
    {
      status: 'healthy',
      database: dbStatus,
      dbLatencyMs,
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
    'Boutique Fashion Platform API is operational'
  );
});

// Centralized Error Handling
app.use(errorHandler);

const PORT = env.PORT || 5000;

let server: any;

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 Boutique Fashion Server running on port ${PORT} in ${env.NODE_ENV} mode`);
    console.log(`👉 Health check: http://localhost:${PORT}/api/v1/health`);
  });

  // Graceful Process Termination for Production Rolling Deployments & Autoscaling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Draining active HTTP connections...`);
    if (server) {
      server.close(async () => {
        console.log('✅ Closed all in-flight HTTP connections.');
        try {
          await prisma.$disconnect();
          console.log('✅ Disconnected from database.');
          process.exit(0);
        } catch (err) {
          console.error('❌ Error during database disconnect:', err);
          process.exit(1);
        }
      });

      // Force terminate if active requests don't finish within 10 seconds
      setTimeout(() => {
        console.error('⚠️ Forcefully terminating after 10s timeout.');
        process.exit(1);
      }, 10000).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
