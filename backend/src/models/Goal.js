import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  kind: { type: String, required: true, trim: true, maxlength: 60, default: 'purchase' },
  amount: { type: Number, required: true, min: 1, max: 1000000000 },
  savedAmount: { type: Number, default: 0, min: 0, max: 1000000000 },
  dueDate: { type: Date, required: true },
  frequency: { type: String, enum: ['once', 'monthly', 'yearly'], default: 'once' },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

goalSchema.index({ user: 1, status: 1, dueDate: 1 });

export default mongoose.models.Goal || mongoose.model('Goal', goalSchema);
