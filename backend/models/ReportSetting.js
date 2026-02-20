import mongoose from 'mongoose';

const reportSettingSchema = new mongoose.Schema({
  key: { type: String, required: true },
  groupName: { type: String, required: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Unique index per key+group
reportSettingSchema.index({ key: 1, groupName: 1 }, { unique: true });

const ReportSetting = mongoose.model('ReportSetting', reportSettingSchema);
export default ReportSetting;
