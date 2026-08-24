import { Router } from 'express';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  if (!req.user.cashAccountInitialized) {
    await Account.findOneAndUpdate(
      { user: req.user._id, accountType: 'cash' },
      { $setOnInsert: { user: req.user._id, accountName: req.user.name, bankName: 'Cash', accountType: 'cash', openingBalance: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await User.updateOne({ _id: req.user._id }, { cashAccountInitialized: true });
  }
  const [accounts, movements] = await Promise.all([
    Account.find({ user: req.user._id }).sort({ accountType: -1, createdAt: 1 }).lean(),
    Transaction.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: { account: '$account', type: '$type' }, total: { $sum: '$amount' } } },
    ]),
  ]);
  const rows = accounts.map((account) => {
    const accountMovements = movements.filter((item) => item._id.account === account.bankName || (account.accountType === 'cash' && item._id.account === account.accountName));
    const income = accountMovements.find((item) => item._id.type === 'income')?.total || 0;
    const expense = accountMovements.find((item) => item._id.type === 'expense')?.total || 0;
    return { ...account, balance: account.openingBalance + income - expense, income, expense };
  });
  res.json({ accounts: rows });
});

router.post('/', async (req, res) => {
  const accountName = String(req.body.accountName || '').trim();
  const bankName = String(req.body.bankName || '').trim();
  const accountType = String(req.body.accountType || 'bank');
  const openingBalance = Number(req.body.openingBalance || 0);
  if (!accountName || !bankName || !Number.isFinite(openingBalance)) return res.status(400).json({ message: 'Please provide valid account details.' });
  const existing = await Account.exists({ user: req.user._id, accountName, bankName });
  if (existing) return res.status(409).json({ message: 'This bank or wallet account is already added.' });
  const account = await Account.create({ user: req.user._id, accountName, bankName, accountType, openingBalance });
  res.status(201).json({ account: { ...account.toObject(), balance: openingBalance } });
});

router.patch('/:id', async (req, res) => {
  const account = await Account.findOne({ _id: req.params.id, user: req.user._id });
  if (!account) return res.status(404).json({ message: 'Account not found.' });
  const accountName = String(req.body.accountName || '').trim();
  const bankName = String(req.body.bankName || '').trim();
  const openingBalance = Number(req.body.openingBalance || 0);
  if (!accountName || !bankName || !Number.isFinite(openingBalance)) return res.status(400).json({ message: 'Please provide valid account details.' });
  const existing = await Account.exists({ user: req.user._id, accountName, bankName, _id: { $ne: account._id } });
  if (existing) return res.status(409).json({ message: 'This bank or wallet account is already added.' });
  account.accountName = accountName;
  account.bankName = bankName;
  account.openingBalance = openingBalance;
  await account.save();
  res.json({ account: account.toObject() });
});

router.delete('/:id', async (req, res) => {
  const selected = await Account.findOne({ _id: req.params.id, user: req.user._id });
  const account = selected && await Account.findByIdAndDelete(selected._id);
  if (!account) return res.status(404).json({ message: 'Account not found.' });
  res.json({ message: 'Account removed. Existing transactions were kept.' });
});

export default router;
