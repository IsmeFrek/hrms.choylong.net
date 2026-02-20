import mongoose from 'mongoose';

const fileTransferSchema = new mongoose.Schema({
  // Sequential number for display
  no: { type: Number, unique: true },

  // Basic identifiers
  title: { type: String },            // ប្រភេទលិខិត / title
  type: { type: String },             // alternate type field
  letterNo: { type: String },         // លេខលិខិត
  entryNo: { type: String },          // លេខចូល

  // Dates
  date: { type: Date },               // កាលបរិច្ឆេទ
  created_at: { type: Date },
  entryDate: { type: Date },          // កាលបរិច្ឆេទចូល (entry date)
  entryTime: { type: String },        // ម៉ោងចូល (entry time)


  // Source / origin
  source: { type: String },           // ប្រភពឯកសារ
  origin: { type: String },

  // Counts / attachments
  qty: { type: Number },              // ចំនួន
  count: { type: Number },
  attachments: [{ type: String }],    // array of file URLs / names
  files: [{ type: String }],

  // Content and notes
  content: { type: String },          // ខ្លឹមសារ
  description: { type: String },
  others: { type: String },           // ផ្សេងៗ / notes
  notes: { type: String },

  // Status and workflow
  status: { type: String, enum: ['draft','pending','active','archived','done'], default: 'draft' },
  is_new: { type: Boolean, default: false },

  // Ownership / handler
  handler: { type: String },          // current handler
  current_handler: { type: String },
  owner: { type: String },
  creatorName: { type: String },      // name of the user who created this record

  // Reference fields
  reference: { type: String },
  ref_url: { type: String },

  // extra metadata
  meta: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

// Auto-increment the 'no' field similar to other models
fileTransferSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const last = await this.constructor.findOne().sort({ no: -1 });
      this.no = last ? (last.no || 0) + 1 : 1;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const FileTransfer = mongoose.model('FileTransfer', fileTransferSchema);
export default FileTransfer;
