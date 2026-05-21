import mongoose from 'mongoose';

const AttendanceDailyReportSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  hrId: { type: mongoose.Schema.Types.ObjectId, ref: 'HR', index: true },
  no: { type: Number },
  staffName: { type: String },
  date: { type: Date, required: true, index: true },
  status: { type: String },
  checkIn: { type: String },
  checkOut: { type: String },
  checkIn2: { type: String },
  // Mapping for frontend consistency
  checkin1: { type: String },
  checkout1: { type: String },
  checkin2: { type: String },
  checkout2: { type: String },
  workHours: { type: Number },
  isLate: { type: Boolean, default: false },
  leftEarly: { type: Boolean, default: false },
  plech: { type: Boolean, default: false },
  note: { type: String },
  department: { type: String },
  employeeCategory: { type: String },
  manager: { type: String },
  leaveType: { type: String, default: '' },
  leaveReason: { type: String, default: '' },
  remarks: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
AttendanceDailyReportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Collection name: attendance-daily-reports
export default mongoose.model('AttendanceDailyReport', AttendanceDailyReportSchema, 'attendance-daily-reports');
