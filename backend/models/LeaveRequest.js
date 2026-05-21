import mongoose from 'mongoose';

const LeaveRequestSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  checkinmeId: { type: String, index: true }, // Unique ID from Checkinme
  name: { type: String, default: '' },
  manager: { type: String, default: '' },
  department: { type: String, default: '' },
  // Main reference date (kept for compatibility, usually same as startDate)
  date: { type: Date, required: true, index: true },
  // Optional month marker (e.g. imported "Months" column, stored as a date)
  months: { type: Date },
  // Optional explicit range
  startDate: { type: Date },
  endDate: { type: Date },
  amount: { type: Number, default: 0 },
  type: { type: String, default: '' },
  reason: { type: String, default: '' },
  comment: { type: String, default: '' },
  status: { type: String, default: 'pending', index: true },
  requestedAt: { type: Date },
  approvedAt: { type: Date },
  note: { type: String, default: '' },
  attachments: [{ type: String }], // Optional reference docs (PDF, Image)
}, {
  timestamps: true,
});

export default mongoose.model('LeaveRequest', LeaveRequestSchema, 'leave-requests');
