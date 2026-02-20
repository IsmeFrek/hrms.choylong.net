import mongoose from 'mongoose';

// Structured payload to make querying/validation easier
const PayloadSchema = new mongoose.Schema({
  titleText: { type: String, trim: true },
  subText: { type: String, trim: true },
  // Arbitrary simple key/value changes coming from UI
  fields: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Free-form notes; we keep as Mixed to allow flexible structure
  notes: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Array of attachment items
  attachments: [{
    url: { type: String, trim: true },
    name: { type: String, trim: true },
    type: { type: String, trim: true },
    size: { type: Number }
  }],
  // Denormalized meta from target document for easy display
  meta: {
    staffNo: { type: Number },
    staffId: { type: String, trim: true }
  }
}, { _id: false });

const changeRequestSchema = new mongoose.Schema(
  {
    // e.g. 'hr', 'employee', etc.
    targetType: { type: String, required: true, trim: true },
    // ObjectId of the target document in its own collection
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // structured payload used by approvals UI
    payload: { type: PayloadSchema, required: true },

    // requester info
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now },

    // workflow
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewerNote: { type: String, trim: true },

    // optional metadata / denormalized fields for faster filtering in UI
    reason: { type: String, trim: true },
    staffNo: { type: Number, index: true },
    staffId: { type: String, trim: true, index: true },
  attachmentsCount: { type: Number, default: 0 },
  // simple list of keys present in payload.fields (used by UI for quick display)
  changedKeys: [{ type: String }],
  // snapshot of target's previous values for changed keys at approval time
  prev: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

// Keep useful compound indexes for fast list screens
changeRequestSchema.index({ targetType: 1, targetId: 1, status: 1 });
changeRequestSchema.index({ status: 1, staffId: 1, requestedAt: -1 });
changeRequestSchema.index({ attachmentsCount: 1, status: 1, requestedAt: -1 });

// Auto-derive denormalized fields before validation/save
changeRequestSchema.pre('validate', function(next) {
  try {
    const p = this.payload || {};
    // Denormalize staffNo/staffId
    if (p.meta) {
      if (this.staffNo == null && typeof p.meta.staffNo !== 'undefined') this.staffNo = p.meta.staffNo;
      if (!this.staffId && p.meta.staffId) this.staffId = String(p.meta.staffId);
    }
    // Attachments count
    if (Array.isArray(p.attachments)) {
      this.attachmentsCount = p.attachments.length;
    } else if (Array.isArray(p?.files)) {
      // fallback if old payload used `files`
      this.attachmentsCount = p.files.length;
    }
    // Changed keys
    const f = p.fields || {};
    if (f && typeof f === 'object') {
      this.changedKeys = Object.keys(f);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

export default mongoose.model('ChangeRequest', changeRequestSchema);
