import mongoose from 'mongoose';

const AttendanceDetailReportSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  staffName: { type: String },
  date: { type: Date, required: true, index: true }, // The day the scan happened
  checkTime: { type: String }, // Exact time string: "07:41 AM"
  mode: { type: String }, // "In", "Out", "Overtime", etc.
  branch: { type: String },
  department: { type: String },
  device: { type: String },
  employeeCategory: { type: String },
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
AttendanceDetailReportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Use specific collection name as requested: 'attendance-Datail-report'
export default mongoose.model('AttendanceDetailReport', AttendanceDetailReportSchema, 'attendance-Datail-report');
