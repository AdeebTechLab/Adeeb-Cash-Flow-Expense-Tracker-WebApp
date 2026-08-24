import { Router } from 'express';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import Account from '../models/Account.js';
import Goal from '../models/Goal.js';
import Transaction from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const query = { user: req.user._id };
  if (['income', 'expense'].includes(req.query.type)) query.type = req.query.type;
  if (req.query.search) query.$or = [
    { title: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
    { category: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
    { account: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } },
  ];
  const transactions = await Transaction.find(query).sort({ transactionDate: -1, createdAt: -1 }).limit(500).lean();
  res.json({ transactions });
});

router.get('/summary', async (req, res) => {
  const user = new mongoose.Types.ObjectId(req.user._id);
  const [summary, categories, accounts] = await Promise.all([
    Transaction.aggregate([{ $match: { user } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $match: { user, type: 'expense' } }, { $group: { _id: '$category', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }, { $limit: 8 }]),
    Transaction.aggregate([{ $match: { user } }, { $group: { _id: { account: '$account', type: '$type' }, total: { $sum: '$amount' } } }]),
  ]);
  const income = summary.find((item) => item._id === 'income')?.total || 0;
  const expense = summary.find((item) => item._id === 'expense')?.total || 0;
  const accountMap = {};
  for (const item of accounts) accountMap[item._id.account] = (accountMap[item._id.account] || 0) + (item._id.type === 'income' ? item.total : -item.total);
  res.json({ income, expense, balance: income - expense, categories, accounts: Object.entries(accountMap).map(([name, balance]) => ({ name, balance })) });
});

router.get('/report.pdf', async (req, res, next) => {
  try {
    const requestedCurrency = String(req.query.currency || '').toUpperCase();
    const currency = /^[A-Z]{3}$/.test(requestedCurrency) ? requestedCurrency : 'PKR';
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? String(req.query.month) : 'all';
    const startText = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.start || '')) ? String(req.query.start) : '';
    const endText = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.end || '')) ? String(req.query.end) : '';
    const customRange = Boolean(startText && endText && startText <= endText);
    const requestedRange = req.query.start !== undefined || req.query.end !== undefined;
    if (requestedRange && !customRange) return res.status(400).json({ message: 'Please provide a valid start and end date.' });
    const transactionQuery = { user: req.user._id };
    if (customRange) {
      const rangeStart = new Date(startText + 'T00:00:00.000Z');
      const rangeEnd = new Date(endText + 'T00:00:00.000Z');
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
      transactionQuery.transactionDate = { $gte: rangeStart, $lt: rangeEnd };
    } else if (month !== 'all') {
      const rangeStart = new Date(month + '-01T00:00:00.000Z');
      const rangeEnd = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + 1, 1));
      transactionQuery.transactionDate = { $gte: rangeStart, $lt: rangeEnd };
    }
    const [transactions, accounts] = await Promise.all([
      Transaction.find(transactionQuery).sort({ transactionDate: -1, createdAt: -1 }).lean(),
      Account.find({ user: req.user._id }).lean(),
    ]);
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    const amount = (value) => currency === 'PKR' ? 'Rs ' + Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 }) : currency + ' ' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    const bankName = (value) => accounts.find((account) => account.bankName === value)?.bankName || accounts.find((account) => account.accountType === 'cash' && account.accountName === value)?.bankName || accounts.find((account) => account.accountName === value)?.bankName || value || 'Cash';
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: 'Adeeb Cash Flow - Transaction Report', Author: req.user.name } });
    const filename = 'adeeb-cash-flow-report-' + new Date().toISOString().slice(0, 10) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    doc.pipe(res);
    const logoPath = fileURLToPath(new URL('../../../frontend/assets/logos/adeeb-cash-flow-logo.png', import.meta.url));
    doc.image(logoPath, 42, 38, { width: 42, height: 42 });
    doc.fillColor('#152034').font('Helvetica-Bold').fontSize(19).text('Adeeb Cash Flow', 96, 42);
    doc.fillColor('#7c8698').font('Helvetica').fontSize(8).text('COMPLETE TRANSACTION REPORT', 96, 67);
    doc.fillColor('#64748b').fontSize(8).text('Account: ' + req.user.name, 380, 44, { width: 173, align: 'right' });
    const periodLabel = customRange ? new Date(startText + 'T00:00:00.000Z').toLocaleDateString('en-PK', { timeZone: 'UTC' }) + ' - ' + new Date(endText + 'T00:00:00.000Z').toLocaleDateString('en-PK', { timeZone: 'UTC' }) : month === 'all' ? 'All months' : new Date(month + '-01T00:00:00.000Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    doc.text('Period: ' + periodLabel + '  |  ' + new Date().toLocaleDateString('en-PK'), 350, 60, { width: 203, align: 'right' });
    doc.moveTo(42, 94).lineTo(553, 94).strokeColor('#e2e8f0').stroke();
    const summary = [
      ['Total income', amount(income), '#0f9f68'],
      ['Total expense', amount(expense), '#e04b5f'],
      ['Net balance', amount(income - expense), '#246bfd'],
    ];
    summary.forEach(([label, value, color], index) => {
      const x = 42 + index * 174;
      doc.roundedRect(x, 112, 162, 58, 8).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#7c8698').font('Helvetica').fontSize(8).text(label, x + 12, 126);
      doc.fillColor(color).font('Helvetica-Bold').fontSize(13).text(value, x + 12, 143, { width: 138 });
    });
    doc.fillColor('#152034').font('Helvetica-Bold').fontSize(12).text('All transactions (' + transactions.length + ')', 42, 194);
    const columns = { date: 42, description: 112, category: 270, account: 354, amount: 448 };
    const drawHeader = (y) => {
      doc.roundedRect(42, y, 511, 24, 4).fill('#edf4ff');
      doc.fillColor('#52627a').font('Helvetica-Bold').fontSize(7);
      doc.text('DATE', columns.date + 7, y + 8).text('TRANSACTION', columns.description, y + 8).text('CATEGORY', columns.category, y + 8).text('BANK / WALLET', columns.account, y + 8).text('AMOUNT', columns.amount, y + 8, { width: 96, align: 'right' });
      return y + 31;
    };
    let y = drawHeader(215);
    transactions.forEach((item) => {
      if (y > 760) { doc.addPage(); y = drawHeader(42); }
      doc.fillColor('#64748b').font('Helvetica').fontSize(7).text(new Date(item.transactionDate).toLocaleDateString('en-PK'), columns.date, y + 5, { width: 62 });
      doc.fillColor('#152034').font('Helvetica-Bold').fontSize(8).text(item.title, columns.description, y + 3, { width: 150, ellipsis: true });
      doc.fillColor('#8a94a6').font('Helvetica').fontSize(6.5).text(item.note || item.type.toUpperCase(), columns.description, y + 14, { width: 150, ellipsis: true });
      doc.fillColor('#64748b').fontSize(7).text(item.category, columns.category, y + 7, { width: 76, ellipsis: true });
      doc.text(bankName(item.account), columns.account, y + 7, { width: 86, ellipsis: true });
      doc.fillColor(item.type === 'income' ? '#0f9f68' : '#e04b5f').font('Helvetica-Bold').fontSize(8).text((item.type === 'income' ? '+' : '-') + amount(item.amount), columns.amount, y + 7, { width: 96, align: 'right' });
      y += 30;
      doc.moveTo(42, y).lineTo(553, y).strokeColor('#edf1f5').stroke();
    });
    if (!transactions.length) doc.fillColor('#7c8698').font('Helvetica').fontSize(10).text('No transactions available.', 42, y + 18, { width: 511, align: 'center' });
    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(index);
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(7).text('Adeeb Cash Flow  |  Page ' + (index + 1) + ' of ' + pages.count, 42, 810, { width: 511, align: 'center' });
    }
    doc.end();
  } catch (error) { next(error); }
});

router.post('/', async (req, res) => {
  const amount = Number(req.body.amount);
  const type = String(req.body.type || '');
  const title = String(req.body.title || '').trim();
  const category = String(req.body.category || '').trim();
  if (!['income', 'expense'].includes(type) || !title || !category || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Please provide valid transaction details.' });
  let goal = null;
  if (req.body.goal) {
    if (!mongoose.isValidObjectId(req.body.goal) || !await Goal.exists({ _id: req.body.goal, user: req.user._id })) return res.status(400).json({ message: 'Please select a valid goal.' });
    goal = req.body.goal;
  }
  const transaction = await Transaction.create({ user: req.user._id, goal, type, amount, title, category, account: String(req.body.account || 'Cash').trim(), note: String(req.body.note || '').trim(), transactionDate: req.body.transactionDate ? new Date(req.body.transactionDate) : new Date() });
  res.status(201).json({ transaction });
});

router.patch('/:id', async (req, res) => {
  const allowed = ['goal', 'type', 'amount', 'title', 'category', 'account', 'note', 'transactionDate'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (updates.goal) {
    if (!mongoose.isValidObjectId(updates.goal) || !await Goal.exists({ _id: updates.goal, user: req.user._id })) return res.status(400).json({ message: 'Please select a valid goal.' });
  } else if ('goal' in updates) updates.goal = null;
  const transaction = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, updates, { new: true, runValidators: true });
  if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
  res.json({ transaction });
});

router.delete('/:id', async (req, res) => {
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
  res.json({ message: 'Transaction deleted.' });
});

export default router;
