import mongoose from 'mongoose';

const WorkScheduleEmployeeSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true },
  khmerName: { type: String, required: true },
  phoneNumber: { type: String },
  position: { type: String },
  department: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
}, {
  collection: 'workschedule_employees'
});

WorkScheduleEmployeeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('WorkScheduleEmployee', WorkScheduleEmployeeSchema);
