import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { clearSessionCookie, setSessionCookie, signSession } from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
// Authentication and self-service profile routes.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, phone: user.phone, city: user.city, country: user.country, role: user.role, status: user.status, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt };
}

router.post('/signup', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ message: 'Please enter your full name.' });
  if (!emailPattern.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
  const existing = await User.exists({ email });
  if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });
  const role = email === String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() ? 'admin' : 'user';
  const user = await User.create({ name, email, phone, passwordHash: await bcrypt.hash(password, 12), role, lastLoginAt: new Date() });
  setSessionCookie(res, signSession(user));
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const remember = req.body.remember === true;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  if (user.status !== 'active') return res.status(403).json({ message: 'This account is suspended. Please contact an administrator.' });
  user.lastLoginAt = new Date();
  await user.save();
  setSessionCookie(res, signSession(user, remember), remember);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Signed out successfully.' });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: { ...req.user, id: req.user._id } }));

router.patch('/profile', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const phone = String(req.body.phone || '').trim();
  const city = String(req.body.city || '').trim();
  const country = String(req.body.country || '').trim();
  if (name.length < 2) return res.status(400).json({ message: 'Please enter your full name.' });
  if (!emailPattern.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (phone.length > 30) return res.status(400).json({ message: 'Phone number is too long.' });
  if (city.length > 80 || country.length > 80) return res.status(400).json({ message: 'Some profile details are too long.' });
  const existing = await User.exists({ email, _id: { $ne: req.user._id } });
  if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });
  const user = await User.findByIdAndUpdate(req.user._id, { name, email, phone, city, country }, { new: true, runValidators: true });
  res.json({ user: publicUser(user) });
});

export default router;
