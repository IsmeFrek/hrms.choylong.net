import mongoose from 'mongoose';

const DepartmentRequestSchema = new mongoose.Schema({
  fromDept: { type: String, default: '' },
  date: { type: Date },
  toWhom: { type: String, default: '' },
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('DepartmentRequest', DepartmentRequestSchema);
