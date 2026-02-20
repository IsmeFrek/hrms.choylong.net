import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  letterType: { type: String, required: true }, // ប្រភេទលិខិត
  no: { type: String, required: true }, // លេខរៀង (អាចមានសញ្ញា / ឬអក្សរ)
  documentName: { type: String }, // ឯកសារ (ចំណងជើងឯកសារ)
  incomingLetterNo: { type: String }, // លេខលិខិតចូល
  letterRefNo: { type: String }, // លេខលិខិត
  date: { type: Date, required: true }, // កាលបរិច្ឆេទ
  documentSource: { type: String, required: true }, // ប្រភពឯកសារ
  attachment: { type: String }, // ឯកសារ
  filename: { type: String }, // ឈ្មោះឯកសារបង្ហោះ
  stage: { type: String, default: 'draft' }, // ដំណាក់កាល
  quantity: { type: Number, default: 1 }, // ចំនួន
  comment: { type: String } // មតិយោបល
}, {
  timestamps: true
});

const File = mongoose.model('File', fileSchema);

export default File;