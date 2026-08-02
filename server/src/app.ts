import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import passport from './config/passport';
import { errorHandler } from './middleware/error';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import cookbookRoutes from './routes/cookbooks';
import recipeRoutes from './routes/recipes';
import tagRoutes from './routes/tags';
import mealPlanRoutes from './routes/mealPlans';
import exportRoutes from './routes/export';
import importRoutes from './routes/import';

export function createApp() {
  const app = express();

  // ─── Security & Middleware ─────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow image serving
    }),
  );

  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:80',
      credentials: true,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // ─── Rate Limiting ────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { success: false, message: 'Too many auth attempts, please try again later' },
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
  });

  // ─── Passport ────────────────────────────
  app.use(passport.initialize());

  // ─── Static Uploads ───────────────────────
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), {
      maxAge: '7d',
    }),
  );

  // ─── Health Check ─────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── API Routes ───────────────────────────
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/users', apiLimiter, userRoutes);
  app.use('/api/cookbooks', apiLimiter, cookbookRoutes);
  app.use('/api/recipes', apiLimiter, recipeRoutes);
  app.use('/api/tags', apiLimiter, tagRoutes);
  app.use('/api/meal-plans', apiLimiter, mealPlanRoutes);
  app.use('/api/export', apiLimiter, exportRoutes);
  app.use('/api/import', apiLimiter, importRoutes);

  // ─── 404 Catch-all ────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // ─── Error Handler ────────────────────────
  app.use(errorHandler);

  return app;
}
