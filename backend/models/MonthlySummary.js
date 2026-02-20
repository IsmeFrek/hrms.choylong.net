import mongoose from 'mongoose';

const MonthlySummarySchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  year: { type: Number, required: true, index: true },
  month: { type: Number, required: true, index: true },
  // Optional note fields used by the monthly report (print/export)
  leaveType: { type: String, default: '' },
  other: { type: String, default: '' },
  totalLeaveComment: { type: String, default: '' },
  dailyData: {
    type: [
      {
        day: { type: Number },
        date: { type: mongoose.Schema.Types.Mixed },
        checkIn: { type: String, default: '' },
        checkOut: { type: String, default: '' },
        status: { type: String, default: '' }
      }
    ],
    default: []
  },
  workTime: { type: String, default: '' },
  dayWorkCount: { type: Number, default: 0 },
  attendanceCount: { type: Number, default: 0 },
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
  updatedAt: { type: Date, default: Date.now }
});

MonthlySummarySchema.index({ staffId: 1, year: 1, month: 1 }, { unique: true });

// Use explicit collection name `attendance-monthly-data` as requested
export default mongoose.model('MonthlySummary', MonthlySummarySchema, 'attendance-monthly-data');
