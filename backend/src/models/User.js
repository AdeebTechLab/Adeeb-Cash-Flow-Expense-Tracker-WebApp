import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 180 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  city: { type: String, trim: true, maxlength: 80, default: '' },
  country: { type: String, trim: true, maxlength: 80, default: '' },
  cashAccountInitialized: { type: Boolean, default: false },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
