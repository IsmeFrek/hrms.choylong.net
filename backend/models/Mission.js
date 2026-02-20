import mongoose from 'mongoose';

const missionSchema = new mongoose.Schema({
  no: { type: Number, unique: true },
  reference: { type: String },
  assignTo: { type: String },
  participants: { type: String },
  date: { type: Date },
  location: { type: String },
  traditionalDate: { type: String },
  letterNo: { type: String },
  letterDate: { type: Date },
  sourceDoc: { type: String },
  referenceDoc: { type: String },
  content: { type: String },
  others: { type: String },
  participationDate: { type: Date },
  participationLocation: { type: String },
  stage: { type: String },
  telegram: { type: String },
  statusKey: { type: String, default: 'pending' },
  statusText: { type: String, default: 'រង់ចាំ' },
  sourceRecordId: { type: String },
  createdFrom: { type: String, default: 'missions' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  meta: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

missionSchema.pre('save', async function(next) {
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

const Mission = mongoose.model('Mission', missionSchema);
export default Mission;
