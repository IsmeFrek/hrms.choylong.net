import mongoose from 'mongoose';

const ShiftTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  shortTitle: { type: String },
  color: { type: String },
  // department(s) stored as array of strings (prefer Department_Kh values)
  department: [{ type: String }],
  startAt: { type: String },
  endAt: { type: String },
  startAt2: { type: String },
  endAt2: { type: String },
  notes: { type: String }
}, { timestamps: true });

export default mongoose.model('ShiftTemplate', ShiftTemplateSchema);
