import mongoose from 'mongoose';

const ScheduleOverrideSchema = new mongoose.Schema({
  employeeRef: { type: String, required: true },
  date: { type: Date, required: true },
  shiftTitle: { type: String, required: true },
  shiftStart: { type: String },
  shiftEnd: { type: String },
  shiftColor: { type: String, default: '#0b74de' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: 'system' },
  notes: { type: String }
}, {
  timestamps: true
});

// Create compound index for efficient queries
ScheduleOverrideSchema.index({ employeeRef: 1, date: 1 }, { unique: true });
ScheduleOverrideSchema.index({ date: 1 });

export default mongoose.model('ScheduleOverride', ScheduleOverrideSchema);