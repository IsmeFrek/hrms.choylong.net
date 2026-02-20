import mongoose from 'mongoose';

const WorkScheduleSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkScheduleEmployee', required: true },
  date: { type: Date, required: true },
  shiftTitle: { type: String, required: true }, // 'Work' or 'Day Off'
  shiftStart: { type: String }, // Time like "07:30"
  shiftEnd: { type: String }, // Time like "15:30"
  shiftColor: { type: String, default: '#0b74de' },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
}, {
  collection: 'workschedules'
});

// Compound index for efficient queries
WorkScheduleSchema.index({ employeeId: 1, date: 1 }, { unique: true });
WorkScheduleSchema.index({ date: 1 });

WorkScheduleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('WorkSchedule', WorkScheduleSchema);
