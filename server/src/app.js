import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { createLimiters } from './middleware/rateLimit.js';
import { corsMiddleware, originCheck, securityHeaders } from './middleware/security.js';
import adminRoutes from './routes/admin.js';
import appointmentRoutes from './routes/appointments.js';
import authRoutes from './routes/auth.js';
import conversationRoutes from './routes/conversations.js';
import lawyerRoutes from './routes/lawyers.js';
import lawyerSelfRoutes from './routes/lawyerSelf.js';
import meRoutes from './routes/me.js';
import quotationRoutes from './routes/quotations.js';
import referenceRoutes from './routes/reference.js';
import reportRoutes from './routes/reports.js';
import requestRoutes from './routes/requests.js';
import reviewRoutes from './routes/reviews.js';

export function createApp({ limiterOverrides = {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  const limiters = createLimiters(limiterOverrides);
  const deps = { limiters };

  app.use(securityHeaders);
  app.use(corsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', limiters.global, authenticate, originCheck);
  app.use('/api/reference', referenceRoutes());
  app.use('/api/auth', authRoutes(deps));
  app.use('/api/lawyers', lawyerRoutes(deps));
  app.use('/api/requests', requestRoutes(deps));
  app.use('/api/conversations', conversationRoutes(deps));
  app.use('/api/quotations', quotationRoutes(deps));
  app.use('/api/appointments', appointmentRoutes(deps));
  app.use('/api/reviews', reviewRoutes(deps));
  app.use('/api/reports', reportRoutes(deps));
  app.use('/api/me', meRoutes(deps));
  app.use('/api/lawyer', lawyerSelfRoutes(deps));
  app.use('/api/admin', adminRoutes(deps));
  app.use('/api', notFoundHandler);

  // Optional: serve the built web app (npm run build) from this process, with SPA fallback.
  if (config.clientDist && fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      return res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
