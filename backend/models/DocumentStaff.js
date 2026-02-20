import mongoose from 'mongoose';

const documentStaffSchema = new mongoose.Schema({
  staffId: { type: String, required: true }, // លេខសម្គាល់បុគ្គលិក
  khmerName: { type: String, required: true }, // ឈ្មោះជាភាសាខ្មែរ
  name: { type: String, required: true }, // ឈ្មោះឯកសារ ឬចំណងជើង
  type: { type: String, required: true }, // ប្រភេទឯកសារ
  issuedDate: { type: Date, required: true }, // កាលបរិច្ឆេទចេញឯកសារ
  expiryDate: { type: Date }, // កាលបរិច្ឆេទផុតកំណត់
  attachment: { type: String }, // ឯកសារភ្ជាប់
  other: { type: String }, // ព័ត៌មានផ្សេងៗ
  stage: { type: String, default: 'draft' } // ដំណាក់កាល (draft, reviewed, signed, printed, completed)
}, {
  timestamps: true
});

const DocumentStaff = mongoose.model('DocumentStaff', documentStaffSchema);
export default DocumentStaff;
