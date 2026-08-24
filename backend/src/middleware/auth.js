import User from '../models/User.js';
import { COOKIE_NAME, verifySession } from '../utils/auth.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
    const payload = verifySession(token);
    const user = await User.findById(payload.sub).select('-passwordHash').lean();
    if (!user || user.status !== 'active') return res.status(401).json({ message: 'Your account is unavailable.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access is required.' });
  next();
}
