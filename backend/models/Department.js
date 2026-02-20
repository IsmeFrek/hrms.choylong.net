import mongoose from 'mongoose';

// API URL placeholder (do not hardcode production host here)
// const API_URL = process.env.API_BASE ? `${process.env.API_BASE}/api/departments` : 'http://localhost:5000/api/departments';

const departmentSchema = new mongoose.Schema({
  Department_Id: { type: String, required: true }, // ល.រ
  Department_Kh: { type: String, required: true }, // ឈ្មោះផ្នែកជាភាសាខ្មែរ
  Department_En: { type: String, required: true }, // ឈ្មោះផ្នែកជាភាសាអង់គ្លេស
  Other: { type: String }, // ព័ត៌មានផ្សេងៗ
}, { timestamps: true });

const Department = mongoose.model('Department', departmentSchema);
export default Department;

