import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accountName: { type: String, required: true, trim: true, maxlength: 80 },
  bankName: { type: String, required: true, trim: true, maxlength: 100 },
  accountType: { type: String, enum: ['bank', 'cash', 'mobile-wallet', 'credit-card', 'other'], default: 'bank' },
  openingBalance: { type: Number, default: 0, min: -1000000000, max: 1000000000 },
}, { timestamps: true });

accountSchema.index({ user: 1, accountName: 1, bankName: 1 }, { unique: true });

export default mongoose.models.Account || mongoose.model('Account', accountSchema);
