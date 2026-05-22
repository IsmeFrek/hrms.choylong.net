import mongoose from 'mongoose';

const EvaluationRecordSchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  yearMonth: { type: String, required: true, index: true }, // Format: 'YYYY-MM'
  performanceResult: { type: String, default: '' },
  otherNotes: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

EvaluationRecordSchema.index({ staffId: 1, yearMonth: 1 }, { unique: true });

export default mongoose.model('EvaluationRecord', EvaluationRecordSchema, 'evaluation-records');
