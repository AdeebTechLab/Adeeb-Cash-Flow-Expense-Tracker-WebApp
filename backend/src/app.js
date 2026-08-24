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

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
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

app.use(express.static(path.join(rootDir, 'frontend')));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(rootDir, 'frontend', 'index.html')));

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (error?.code === 11000) return res.status(409).json({ message: error.keyPattern?.email ? 'That email address is already in use.' : 'This record already exists.' });
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return res.status(400).json({ message: 'Some information is invalid. Please check and try again.' });
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

export default app;
