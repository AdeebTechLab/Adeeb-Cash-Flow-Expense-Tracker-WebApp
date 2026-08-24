import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

let adminRolesNormalized = false;
router.use(async (req, res, next) => {
  if (!adminRolesNormalized) {
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail) {
      await User.updateMany({ role: 'admin', email: { $ne: adminEmail } }, { $set: { role: 'user' } });
      await User.updateOne({ email: adminEmail }, { $set: { role: 'admin' } });
    }
    adminRolesNormalized = true;
  }
  next();
});

router.get('/stats', async (req, res) => {
  const userIds = await User.find({ role: 'user' }).distinct('_id');
  const [users, activeUsers, transactions, cash] = await Promise.all([
    User.countDocuments({ role: 'user' }), User.countDocuments({ role: 'user', status: 'active' }), Transaction.countDocuments({ user: { $in: userIds } }),
    Transaction.aggregate([{ $match: { user: { $in: userIds } } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
  ]);
  const income = cash.find((item) => item._id === 'income')?.total || 0;
  const expense = cash.find((item) => item._id === 'expense')?.total || 0;
  res.json({ users, activeUsers, transactions, income, expense });
});

router.get('/users', async (req, res) => {
  const filter = { role: 'user' };
  if (req.query.search) filter.$or = [
    { name: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
    { email: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
    { phone: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
  ];
  const users = await User.find(filter).sort({ createdAt: -1 }).select('-passwordHash').lean();
  const userIds = users.map((user) => user._id);
  const [totals, accountCounts] = await Promise.all([
    Transaction.aggregate([{ $match: { user: { $in: userIds } } }, { $group: { _id: { user: '$user', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Account.aggregate([{ $match: { user: { $in: userIds } } }, { $group: { _id: '$user', count: { $sum: 1 } } }]),
  ]);
  const mapped = users.map((user) => {
    const rows = totals.filter((item) => item._id.user.toString() === user._id.toString());
    return { ...user, accountCount: accountCounts.find((item) => item._id.toString() === user._id.toString())?.count || 0, transactionCount: rows.reduce((sum, item) => sum + item.count, 0), income: rows.find((item) => item._id.type === 'income')?.total || 0, expense: rows.find((item) => item._id.type === 'expense')?.total || 0 };
  });
  res.json({ users: mapped });
});

router.get('/users/:id/transactions', async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'user' }).select('name email').lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const transactions = await Transaction.find({ user: user._id }).sort({ transactionDate: -1, createdAt: -1 }).limit(1000).lean();
  const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  res.json({ user, transactions, summary: { income, expense, balance: income - expense } });
});

router.patch('/users/:id', async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'city', 'country', 'status'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (req.params.id === req.user._id.toString() && updates.status === 'suspended') return res.status(400).json({ message: 'You cannot suspend your own account.' });
  if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-passwordHash');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user });
});

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: 'You cannot delete your own account.' });
  const userId = new mongoose.Types.ObjectId(req.params.id);
  const user = await User.findByIdAndDelete(userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  await Transaction.deleteMany({ user: userId });
  await Account.deleteMany({ user: userId });
  res.json({ message: 'User and their transactions were deleted.' });
});

export default router;
