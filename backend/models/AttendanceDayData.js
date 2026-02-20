import mongoose from 'mongoose';

const AttendanceDayDataSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  date: { type: Date, required: true, index: true },
  checkIn: { type: String, default: '' },
  checkOut: { type: String, default: '' },
  status: { type: String, default: '' },
  forgotCount: { type: Number, default: 0 },
  checkinLateCount: { type: Number, default: 0 },
  checkinLateMinutes: { type: Number, default: 0 },
  checkoutEarlyCount: { type: Number, default: 0 },
  checkoutEarlyMinutes: { type: Number, default: 0 },
  checkoutOvertimeCount: { type: Number, default: 0 },
  checkoutOvertimeMinutes: { type: Number, default: 0 },
  dayWorkCount: { type: Number, default: 0 },
  attendanceCount: { type: Number, default: 0 },
  workTime: { type: Number, default: 0 },
  clockMinutes: { type: Number, default: 0 },
  clockCount: { type: Number, default: 0 },
  absentCount: { type: Number, default: 0 },
  leaveCount: { type: Number, default: 0 },
  A: { type: String, default: '' },
  Plech: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

AttendanceDayDataSchema.index({ staffId: 1, date: 1 }, { unique: true });

export default mongoose.model('AttendanceDayData', AttendanceDayDataSchema);
