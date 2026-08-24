import { Router } from 'express';
import Goal from '../models/Goal.js';
import Transaction from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function cleanGoal(body) {
  const title = String(body.title || '').trim();
  const kind = String(body.kind || 'purchase').trim();
  const amount = Number(body.amount);
  const savedAmount = Number(body.savedAmount || 0);
  const dueDate = new Date(body.dueDate);
  const frequency = String(body.frequency || 'once');
  const category = String(body.category || '').trim();
  const note = String(body.note || '').trim();
  if (title.length < 2 || kind.length < 2 || kind.length > 60 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(savedAmount) || savedAmount < 0 || savedAmount > amount || Number.isNaN(dueDate.getTime()) || !['once', 'monthly', 'yearly'].includes(frequency) || category.length < 2 || category.length > 60) return null;
  return { title, kind, amount, savedAmount, dueDate, frequency, category, note };
}

router.get('/', async (req, res) => {
  const goals = await Goal.find({ user: req.user._id }).sort({ status: 1, dueDate: 1, createdAt: -1 }).lean();
  const payments = goals.length ? await Transaction.aggregate([
    { $match: { user: req.user._id, goal: { $in: goals.map((goal) => goal._id) }, type: 'expense' } },
    { $group: { _id: '$goal', total: { $sum: '$amount' } } },
  ]) : [];
  const paymentMap = new Map(payments.map((item) => [String(item._id), item.total]));
  res.json({ goals: goals.map((goal) => {
    const paidAmount = paymentMap.get(String(goal._id)) || 0;
    const fundedAmount = Math.min(goal.amount, Number(goal.savedAmount || 0) + paidAmount);
    return { ...goal, paidAmount, fundedAmount, remainingAmount: Math.max(0, goal.amount - fundedAmount) };
  }) });
});

router.post('/', async (req, res) => {
  const payload = cleanGoal(req.body);
  if (!payload) return res.status(400).json({ message: 'Please provide valid goal details.' });
  const goal = await Goal.create({ user: req.user._id, ...payload });
  res.status(201).json({ goal });
});

router.patch('/:id', async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) return res.status(404).json({ message: 'Goal not found.' });
  if (req.body.title !== undefined) {
    const payload = cleanGoal(req.body);
    if (!payload) return res.status(400).json({ message: 'Please provide valid goal details.' });
    Object.assign(goal, payload);
  }
  if (req.body.status && ['pending', 'completed'].includes(req.body.status)) {
    goal.status = req.body.status;
    goal.completedAt = req.body.status === 'completed' ? new Date() : null;
  }
  await goal.save();
  res.json({ goal });
});

router.delete('/:id', async (req, res) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!goal) return res.status(404).json({ message: 'Goal not found.' });
  res.json({ message: 'Goal deleted.' });
});

export default router;
