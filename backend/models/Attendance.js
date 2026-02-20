import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  status: { type: String, enum: ['present','absent','leave','late','remote'], default: 'present' },
  service: { type: String },
  // Stored times: keep both 'inTime/outTime' (legacy) and 'checkIn/checkOut' used by frontend
  inTime: { type: String },
  outTime: { type: String },
  checkIn: { type: String },
  checkOut: { type: String },
  // secondary check-in/out (second pair)
  inTime2: { type: String },
  outTime2: { type: String },
  checkIn2: { type: String },
  checkOut2: { type: String },
  // Optional scheduled shift times (strings like '07:30' or ISO)
  scheduledStart: { type: String },
  scheduledEnd: { type: String },
  // Computed flags
  isLate: { type: Boolean, default: false },
  lateMinutes: { type: Number, default: 0 },
  leftEarly: { type: Boolean, default: false },
  earlyMinutes: { type: Number, default: 0 },
  // Grace minutes applied when computing late/early (optional)
  scheduledGraceMinutes: { type: Number, default: 0 },
  scheduledEndGraceMinutes: { type: Number, default: 0 },
  notes: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

AttendanceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// --- new Khmer labels and helper methods ---
/**
 * Field labels in Khmer for display purposes.
 * Use Attendance.fieldLabels or instance.getFieldLabels()
 */
AttendanceSchema.statics.fieldLabels = {
  staffId: 'លេខកាត',
  date: 'ថ្ងៃ',
  status: 'ស្ថានភាព',
  service: 'សេវាកម្ម',
  inTime: 'ម៉ោងចូល (ចាស់)',
  outTime: 'ម៉ោងចេញ (ចាស់)',
  checkIn: 'ម៉ោងចូល',
  checkOut: 'ម៉ោងចេញ',
  inTime2: 'ម៉ោងចូល២ (ចាស់)',
  outTime2: 'ម៉ោងចេញ២ (ចាស់)',
  checkIn2: 'ម៉ោងចូល២',
  checkOut2: 'ម៉ោងចេញ២',
  scheduledStart: 'ម៉ោងចាប់ផ្តើមកំណត់',
  scheduledEnd: 'ម៉ោងបញ្ចប់កំណត់',
  isLate: 'យឺត',
  lateMinutes: 'នាទីយឺត',
  leftEarly: 'ចាកចេញពីមុន',
  earlyMinutes: 'នាទីចេញមុន',
  scheduledGraceMinutes: 'នាទីអនុស្សរណៈចាប់ផ្តើម',
  scheduledEndGraceMinutes: 'នាទីអនុស្សរណៈបញ្ចប់',
  notes: 'កំណត់សម្គាល់',
  createdAt: 'បង្កើតនៅ',
  updatedAt: 'ផ្លាស់ប្តូរថ្មី'
};

/**
 * Human-readable Khmer labels for status values.
 */
AttendanceSchema.statics.statusLabels = {
  present: 'មក',
  absent: 'អវត្តមាន',
  leave: 'ឈប់',
  late: 'យឺត',
  remote: 'ធ្វើពីចម្ងាយ'
};

// Helper to get all field labels (static)
AttendanceSchema.statics.getFieldLabels = function () {
  return this.fieldLabels || {};
};

// Helper to get status label (static)
AttendanceSchema.statics.getStatusLabel = function (statusKey) {
  return (this.statusLabels && this.statusLabels[statusKey]) || statusKey || '';
};

// Instance helpers (convenience)
AttendanceSchema.methods.getFieldLabels = function () {
  return this.constructor.getFieldLabels();
};
AttendanceSchema.methods.getStatusLabel = function () {
  return this.constructor.getStatusLabel(this.status);
};
// --- end additions ---

// Use explicit collection name `addattendances` instead of the default pluralized name
export default mongoose.model('Attendance', AttendanceSchema, 'addattendances');
