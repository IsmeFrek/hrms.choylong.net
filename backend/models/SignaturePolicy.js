import mongoose from 'mongoose';

const SignaturePolicySchema = new mongoose.Schema({
  keyword: { type: String, required: true, unique: true },
  leftTitle: { type: String, required: true },
  rightTitle: { type: String, required: true },
  priority: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('SignaturePolicy', SignaturePolicySchema);
