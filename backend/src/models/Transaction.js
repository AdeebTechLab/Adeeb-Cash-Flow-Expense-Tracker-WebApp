import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null, index: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true, min: 1, max: 1000000000 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  account: { type: String, trim: true, maxlength: 60, default: 'Cash' },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  transactionDate: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

transactionSchema.index({ user: 1, transactionDate: -1 });
transactionSchema.index({ user: 1, type: 1, transactionDate: -1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
