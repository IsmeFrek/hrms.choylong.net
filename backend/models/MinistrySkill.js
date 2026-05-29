import mongoose from 'mongoose';

const ministrySkillSchema = new mongoose.Schema({
  ID_skills: { type: String, required: true, unique: true }, // លេខសម្គាល់
  ministryFunction: { type: String }, // មុខងារក្រសួង
  amount: { type: String }, // ទឹកប្រាក់
  total: { type: String }, // សរុប
  male: { type: String }, // ប្រុស
  female: { type: String }, // ស្រី
  Other: { type: String }, // ព័ត៌មានផ្សេងៗ
}, { timestamps: true });

const MinistrySkill = mongoose.model('MinistrySkill', ministrySkillSchema);
export default MinistrySkill;
