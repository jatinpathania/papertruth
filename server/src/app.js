import express from 'express';
import cors from 'cors';
import { env, geminiEnabled } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import examRoutes from './routes/exams.js';
import submissionRoutes from './routes/submissions.js';
import consensusRoutes from './routes/consensus.js';
import disputeRoutes from './routes/disputes.js';
import resultRoutes from './routes/results.js';
import validationRoutes from './routes/validation.js';
import integrityRoutes from './routes/integrity.js';

function corsOrigins() {
  const list = env.clientUrl
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return list.length <= 1 ? list[0] || false : list;
}

export function createApp({ io } = {}) {
  const app = express();
  if (io) app.set('io', io);

  app.use(cors({ origin: corsOrigins(), credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.use((req, res, next) => {
    req.io = app.get('io');
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'papertruth',
      time: new Date().toISOString(),
      semanticGrouping: geminiEnabled
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api', submissionRoutes);
  app.use('/api', consensusRoutes);
  app.use('/api', disputeRoutes);
  app.use('/api', resultRoutes);
  app.use('/api', validationRoutes);
  app.use('/api', integrityRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
