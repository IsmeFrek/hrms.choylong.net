import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema({
  step: { type: String, required: true }, // e.g., office, deputy9..2, director
  byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName: { type: String },
  comment: { type: String },
  decidedAt: { type: Date, default: Date.now },
  decision: { type: String, enum: ['commented', 'approved', 'noted'], default: 'commented' },
}, { _id: false });

const documentFlowSchema = new mongoose.Schema({
    officerName: { type: String },
    rightName: { type: String },
    leftName: { type: String },
  letterType: { type: String, required: true }, // ប្រភេទលិខិត
  letterNumber: { type: String }, // លេខលិខិត
  incomingNumber: { type: String }, // លេខចូល
  date: { type: Date, required: true }, // កាលបរិច្ឆេទ
  source: { type: String, required: true }, // ប្រភពឯកសារ
  quantity: { type: Number }, // ចំនួន
  referenceDocs: { type: String }, // ឯកសារយោង
  // Attachments for reference docs (images/PDFs)
  referenceFiles: {
    type: [
      new mongoose.Schema({
        filename: { type: String, required: true }, // stored filename under /public/Uploads
        originalName: { type: String },
        mimeType: { type: String },
        size: { type: Number }
      }, { _id: false })
    ],
    default: []
  },
  content: { type: String }, // ខ្លឹមសារ
  other: { type: String }, // ផ្សេងៗ
  // Opinions, dates, and signature image URLs
  officeOpinion: { type: String },
  officeDate: { type: Date },
  officeSignUrl: { type: String },
  deputyOpinion1: { type: String },
  deputyDate1: { type: Date },
  deputySign1Url: { type: String },
  deputyOpinion2: { type: String },
  deputyDate2: { type: Date },
  deputySign2Url: { type: String },
  // additional deputies (3..9)
  deputyOpinion3: { type: String },
  deputyDate3: { type: Date },
  deputySign3Url: { type: String },
  deputyOpinion4: { type: String },
  deputyDate4: { type: Date },
  deputySign4Url: { type: String },
  deputyOpinion5: { type: String },
  deputyDate5: { type: Date },
  deputySign5Url: { type: String },
  deputyOpinion6: { type: String },
  deputyDate6: { type: Date },
  deputySign6Url: { type: String },
  deputyOpinion7: { type: String },
  deputyDate7: { type: Date },
  deputySign7Url: { type: String },
  deputyOpinion8: { type: String },
  deputyDate8: { type: Date },
  deputySign8Url: { type: String },
  deputyOpinion9: { type: String },
  deputyDate9: { type: Date },
  deputySign9Url: { type: String },
  directorOpinion: { type: String },
  directorDate: { type: Date },
  directorSignUrl: { type: String },
  // Responsible names per stage (for display/assignment)
  officeHeadName: { type: String },
  deputyName1: { type: String },
  deputyName2: { type: String },
  deputyName3: { type: String },
  deputyName4: { type: String },
  deputyName5: { type: String },
  deputyName6: { type: String },
  deputyName7: { type: String },
  deputyName8: { type: String },
  deputyName9: { type: String },
  // Optional per-stage assigned user IDs (grant explicit permissions to a user account)
  officeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deputyUserId1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deputyUserId2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  directorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // administrative head and employee fields
  adminHeadName: { type: String },
  employeeName: { type: String },
  directorName: { type: String },
  // Generic current assignee name (who should provide the opinion now)
  assigneeName: { type: String },
  // Optional: link to the user account for notifications
  assigneeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  stage: {
    type: String,
    enum: ['draft', 'comment_request', 'office', 'deputy9', 'deputy8', 'deputy7', 'deputy6', 'deputy5', 'deputy4', 'deputy3', 'deputy2', 'director', 'completed'],
    default: 'draft'
  },
  approvals: { type: [approvalSchema], default: [] },
  commentRequest: {
    content: { type: String },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String },
    requestedAt: { type: Date }
  }
}, { timestamps: true });

const DocumentFlow = mongoose.model('DocumentFlow', documentFlowSchema);
export default DocumentFlow;
