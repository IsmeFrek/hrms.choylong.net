import mongoose from 'mongoose';


const skillSchema = new mongoose.Schema({
  ID_skills: { type: String, required: true }, // ល.រ
  skills_Kh: { type: String, required: true }, // ឈ្មោះជាភាសាខ្មែរ
  skills_En: { type: String, required: true }, // ឈ្មោះជាភាសាអង់គ្លេស
  ministryFunction: { type: String }, // មុខងារក្រសួង
  total: { type: String },
  male: { type: String },
  female: { type: String },
  Other: { type: String }, // ផ្សេងៗ
}, { timestamps: true });

const Skill = mongoose.model('Skill', skillSchema);
export default Skill;
