import mongoose from 'mongoose';

const letterSchema = new mongoose.Schema({
  type: { type: String, default: 'instruction' }, // 'instruction' or other types
  templateType: { type: String }, // 'appointment', 'resignation', 'onboarding', 'termination', 'maternity', 'others'
  letterNo: { type: String },
  dateText: { type: String },
  ministry: { type: String },
  department: { type: String },
  subject: { type: String },
  recipient: { type: String },
  body: { type: String },
  body1: { type: String },
  newRole: { type: String },
  currentRole: { type: String },
  gender: { type: String },
  title: { type: String },
  attachments: [{ type: String }], // filenames or URLs of attachments
  // additional workflow / role fields requested
  note: { type: String }, // សម្គាល់
  officer: { type: String }, // ពិភាក្សា/មន្រ្តី
  officerId: { type: String }, // អត្តលេខមន្ត្រី
  deputyAdmin: { type: String }, // អនុប្រធានរដ្ឋបាល
  officeHead: { type: String }, // ប្រធានការិយាល័យ
  deputyDirector9: { type: String },
  deputyDirector8: { type: String },
  deputyDirector7: { type: String },
  deputyDirector6: { type: String },
  deputyDirector5: { type: String },
  deputyDirector4: { type: String },
  deputyDirector3: { type: String },
  deputyDirector2: { type: String },
  deputyDirector1: { type: String },
  director: { type: String }, // នាយក
  // files intended for display (images or PDFs) — store as objects with filename/url/mime if available
  displayFiles: [{ filename: { type: String }, url: { type: String }, mimeType: { type: String } }],
  signPlace: { type: String },
  signTitle: { type: String },
  signName: { type: String },
  // admin approval fields
  status: { type: String, enum: ['pending', 'reviewing', 'completed', 'rejected'], default: 'pending' },
  approvedByAdmin: { type: Boolean, default: false },
  approvedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  approvedAt: { type: Date, required: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Letter', letterSchema);
