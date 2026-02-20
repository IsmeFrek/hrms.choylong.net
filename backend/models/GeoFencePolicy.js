import mongoose from 'mongoose';

const GeoFencePolicySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },

    // Matching fields (all optional). If provided, must match the staff HR profile.
    match: {
      staffId: { type: String, trim: true, default: '' },
      department: { type: String, trim: true, default: '' }, // HR.Department_Kh
      skill: { type: String, trim: true, default: '' },       // HR.skill
      position: { type: String, trim: true, default: '' },    // HR.position
      officerType: { type: String, trim: true, default: '' }, // HR.officerType
      role: { type: String, trim: true, default: '' },        // User role name (optional)
    },

    fence: {
      centerLat: { type: Number, default: null },
      centerLng: { type: Number, default: null },
      radiusM: { type: Number, default: 200 },
      maxAccuracyM: { type: Number, default: 250 },
    },

    note: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

GeoFencePolicySchema.index({ enabled: 1, priority: -1 });
GeoFencePolicySchema.index({ 'match.department': 1, 'match.skill': 1 });
GeoFencePolicySchema.index({ 'match.staffId': 1 });

export default mongoose.model('GeoFencePolicy', GeoFencePolicySchema);
