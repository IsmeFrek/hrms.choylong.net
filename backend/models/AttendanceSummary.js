import mongoose from 'mongoose';

const AttendanceSummarySchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  // fromDate and toDate removed; use year/month for monthly summary
  year: { type: Number, default: 0, index: true },
  month: { type: Number, default: 0, index: true },
  dayWorkCount: { type: Number, default: 0 },
  attendanceCount: { type: Number, default: 0 },
  workTime: { type: Number, default: 0 }, // minutes
  clock: { type: Number, default: 0 },
  clockCount: { type: Number, default: 0 },
  checkinLateMinutes: { type: Number, default: 0 },
  checkinLateCount: { type: Number, default: 0 },
  checkoutEarlyMinutes: { type: Number, default: 0 },
  checkoutEarlyCount: { type: Number, default: 0 },
  checkoutOvertimeMinutes: { type: Number, default: 0 },
  checkoutOvertimeCount: { type: Number, default: 0 },
  absentCount: { type: Number, default: 0 },
  leaveCount: { type: Number, default: 0 },
  A: { type: Number, default: 0 },
  plech: { type: Number, default: 0 },
  skill: { type: String, default: '' }, // ឯកទេស
  updatedAt: { type: Date, default: Date.now }
});

AttendanceSummarySchema.index({ staffId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model('AttendanceSummary', AttendanceSummarySchema, 'attendance-summary');
