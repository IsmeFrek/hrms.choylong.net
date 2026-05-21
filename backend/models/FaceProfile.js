import mongoose from 'mongoose';

const FaceDescriptorSchema = new mongoose.Schema(
  {
    vector: { type: [Number], required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const FaceProfileSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, default: '' },
  // Store multiple descriptors per staff (for better robustness)
  descriptors: { type: [FaceDescriptorSchema], default: [] },

  // Optional small preview image (data URL) for UI tables
  snapshot: { type: String, default: '' },

  consent: {
    given: { type: Boolean, default: false },
    at: { type: Date },
    // increment this when you change consent wording in the UI
    version: { type: Number, default: 1 },
    text: { type: String, default: '' },
  },

  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

FaceProfileSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('FaceProfile', FaceProfileSchema);
