import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  name: { type: String, required: true },
  description: { type: String },
  isManual: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Holiday', holidaySchema);
