import mongoose from 'mongoose';

const evaluationGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  members: [{ type: String }], // Array of staffId or no
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String }
}, { timestamps: true });

const EvaluationGroup = mongoose.model('EvaluationGroup', evaluationGroupSchema);
export default EvaluationGroup;
