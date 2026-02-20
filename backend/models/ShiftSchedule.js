import mongoose from 'mongoose';

const ShiftScheduleSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true, index: true },
  scheduledStart: { type: String },
  scheduledEnd: { type: String },
  scheduledGraceMinutes: { type: Number, default: 0 },
  scheduledEndGraceMinutes: { type: Number, default: 0 },
  department: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

ShiftScheduleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('ShiftSchedule', ShiftScheduleSchema);
