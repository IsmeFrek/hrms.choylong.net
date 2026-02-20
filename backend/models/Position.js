import mongoose from 'mongoose';

// API URL placeholder (do not hardcode production host here)
// const API_URL = process.env.API_BASE ? `${process.env.API_BASE}/api/positions` : 'http://localhost:5000/api/positions';

const positionSchema = new mongoose.Schema({
  Position_Id: { type: String, required: true }, // ល.រ
  Position_Kh: { type: String, required: true }, // ឈ្មោះតួនាទី (ខ្មែរ)
  Position_En: { type: String, required: true }, // ឈ្មោះតួនាទី (អង់គ្លេស)
  Other: { type: String }, // ព័ត៌មានផ្សេងៗ
}, { timestamps: true });

const Position = mongoose.model('Position', positionSchema);
export default Position;