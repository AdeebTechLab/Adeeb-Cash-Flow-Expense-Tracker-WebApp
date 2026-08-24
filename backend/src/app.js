import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDb } from './config/db.js';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import adminRoutes from './routes/admin.js';
import accountRoutes from './routes/accounts.js';
import goalRoutes from './routes/goals.js';

const app = express();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const allowedOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin.replace(/\/$/, ''))) return true;
  return process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ message: 'This website is not allowed to access the API.' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/api', async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (error) {
    console.error('Database connection error:', error.message);
    res.status(503).json({ message: 'Database is temporarily unavailable. Check the MongoDB configuration.' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'Adeeb Cash Flow API' }));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/admin', adminRoutes);

if (process.env.SERVE_FRONTEND !== 'false') {
  app.use(express.static(path.join(rootDir, 'frontend')));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(rootDir, 'frontend', 'index.html')));
}

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (error?.code === 11000) return res.status(409).json({ message: error.keyPattern?.email ? 'That email address is already in use.' : 'This record already exists.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return res.status(400).json({ message: 'Some information is invalid. Please check and try again.' });
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

export default app;
