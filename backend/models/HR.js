import mongoose from 'mongoose';

const hrSchema = new mongoose.Schema({
  no: { type: Number, unique: true },
  staffId: { type: String, unique: true },
  khmerName: { type: String },
  name: { type: String },
  gender: { type: String, enum: ['Male', 'Female'] },
  dob: {
    type: Date,
    // Accept strings in dd/mm/yyyy or yyyy-mm-dd and convert to Date
    set: function(val) {
      // If already a Date, return as-is
      if (!val) return val;
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        const s = val.trim();
        // dd/mm/yyyy
        const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmY) {
          const d = dmY[1].padStart(2, '0');
          const m = dmY[2].padStart(2, '0');
          const y = dmY[3];
          // create Date using ISO format
          return new Date(`${y}-${m}-${d}`);
        }
        // yyyy-mm-dd or ISO
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) {
          return new Date(s);
        }
      }
      return val;
    }
  },
  maritalStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  phone: { type: String },
  email: { type: String },
  birthPlace: { type: String },
  currentPlace: { type: String },
  // Parent information
  fatherName: { type: String },
  fatherDob: {
    type: Date,
    set: function(val) {
      if (!val) return val;
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        const s = val.trim();
        const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmY) {
          const d = dmY[1].padStart(2, '0');
          const m = dmY[2].padStart(2, '0');
          const y = dmY[3];
          return new Date(`${y}-${m}-${d}`);
        }
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(s);
      }
      return val;
    }
  },
  fatherOccupation: { type: String },
  fatherPhone: { type: String },
  fatherNote: { type: String },
  motherName: { type: String },
  motherDob: {
    type: Date,
    set: function(val) {
      if (!val) return val;
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        const s = val.trim();
        const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmY) {
          const d = dmY[1].padStart(2, '0');
          const m = dmY[2].padStart(2, '0');
          const y = dmY[3];
          return new Date(`${y}-${m}-${d}`);
        }
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(s);
      }
      return val;
    }
  },
  motherOccupation: { type: String },
  motherPhone: { type: String },
  motherNote: { type: String },
  // Union / association information
  unionName: { type: String },
  unionMemberId: { type: String },
  unionJoinDate: {
    type: Date,
    set: function(val) {
      if (!val) return val;
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        const s = val.trim();
        const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmY) {
          const d = dmY[1].padStart(2, '0');
          const m = dmY[2].padStart(2, '0');
          const y = dmY[3];
          return new Date(`${y}-${m}-${d}`);
        }
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(s);
      }
      return val;
    }
  },
  unionRole: { type: String },
  unionPhone: { type: String },
  unionNote: { type: String },
  // Children list: allow multiple children
  childrenList: [{
    name: { type: String },
    gender: { type: String, enum: ['Male', 'Female', ''] },
    dob: { type: Date },
    nid: { type: String },
    note: { type: String }
  }],
  // Education list: allow multiple education records
  educationList: [{
    degreeLevel: { type: String },
    skill: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
  institution: { type: String },
  fileUrl: { type: String }
  }],
  // Documents list
  documents: [{
    type: { type: String },
    fileUrl: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    other: { type: String },
    expiryDate: { type: Date }
  }],
  // Study-related ad-hoc subdocument for training/study leave
  stu: {
    studySkill: { type: String },
    studyPlace: { type: String },
    validity: { type: String },
    other: { type: String },
    studyStart: { type: Date },
    studyEnd: { type: Date },
    image: { type: String }
  },
  // New: Unpaid leave subdocument (parallel to `stu`) to support migrated field names
  unpaid: {
    Reason: { type: String },
    number: { type: String },
    validity: { type: String },
    other: { type: String },
    Start: { type: Date },
    End: { type: Date },
    image: { type: String }
  },
  officerType: { type: String },
  position: { type: String },
  skill: { type: String },
  Department_Kh: { type: String },
  joinDate: {
    type: Date,
    set: function(val) {
      if (!val) return val;
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        const s = val.trim();
        const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmY) {
          const d = dmY[1].padStart(2, '0');
          const m = dmY[2].padStart(2, '0');
          const y = dmY[3];
          return new Date(`${y}-${m}-${d}`);
        }
        const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) {
          return new Date(s);
        }
      }
      return val;
    }
  },
  civilServantRole: { type: String },
  civilServantStartDate: {
    type: Date
  },
  // ថ្ងៃតាំងស៊ប់
  nominationStartDate: {
    type: Date
  },
  dateJoinedMinistry: {
    type: Date
  },
  salastSalaryIncrementDate: { type: String },
  workOther: { type: String },
  degreeLevel: { type: String },
  degree: { type: String },
  educationLevel: { type: String },
  officerId: { type: String },
  cardNumber: { type: String },
  nid: { type: String },
  bankAccount: { type: String },
  civilServantId: { type: String },
  dateJoinedGov: { type: String },
  yearsInCurrentRank: { type: Number },
  rankExitReason: { type: String },
  rankExitDuration: { type: Number },
  grade: { type: String },
  proposedBy: { type: String },
  yearsInRank: { type: Number },
  totalYearsWorked: { type: Number },
  asOfDate: { type: String },
  salaryLevel: { type: String },
  mentorName: { type: String },
  mentorDate: { type: String },
  // Civil Servant reason/notes
  civilServantReason: { type: String },
  creativityScore: { type: Number, min: 0, max: 10 },
  responsibilityScore: { type: Number, min: 0, max: 10 },
  patriotismScore: { type: Number, min: 0, max: 10 },
  leadershipScore: { type: Number, min: 0, max: 10 },
  ethicsScore: { type: Number, min: 0, max: 10 },
  totalScore: { type: Number },
  reason1: { type: String },
  reason2: { type: String },
  reason3: { type: String },
  reason4: { type: String },
  reason5: { type: String },
  reason6: { type: String },
  reason: {
    type: String
  },
  status: { type: String, enum: ['Active', 'Inactive', 'Resigned', 'Deleted'], default: 'Active' },
  resignationDate: { type: Date },
  // Date when record was removed from dataset (ដកទិន្នន័យ)
  dateRemoved: { type: Date },
  // Store resignation/termination reason and any uploaded document (base64 or URL)
  resignationReason: { type: String },
  resignationDocument: { type: String },
  // Extra note for resignation/delisted reporting (e.g., month report entry)
  resignationOther: { type: String },
  // Flag to indicate former civil servant who retired and continued as contract staff
  isRetiredThenContract: { type: Boolean, default: false },
  // Flag to indicate a part-time / outside-hours contract (for reporting)
  isPartTime: { type: Boolean, default: false },
  image: { type: String },
  other: { type: String },
  salaryPromotionDate: {
    type: Date
  },
  salaryPromotionBy: {
    type: String
  },
  // Medal/Award
  medalType: { type: String },
  medalReceivedDate: { type: Date }
}, {
  timestamps: true
});

// Helper: parse common date string formats (dd/mm/yyyy or yyyy-mm-dd or ISO) to Date
function parseStringToDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val !== 'string') return null;
  const s = val.trim();
  // dd/mm/yyyy
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const d = Number(dmY[1]);
    const m = Number(dmY[2]);
    const y = Number(dmY[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (!isNaN(dt.getTime())) return dt;
    return null;
  }
  // yyyy-mm-dd or ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    return null;
  }
  return null;
}

// Normalize and validate date-like fields before validation/save
hrSchema.pre('validate', function(next) {
  const dateFields = [
    'dob',
    'joinDate',
    'fatherDob',
    'motherDob',
    'unionJoinDate',
    'medalReceivedDate',
    'civilServantStartDate',
    'stu.studyStart',
    'stu.studyEnd',
    // New unpaid fields
    'unpaid.Start',
    'unpaid.End',
  'nominationStartDate',
    'dateJoinedMinistry',
    'salaryPromotionDate',
    'resignationDate',
    'dateRemoved',
    'resignDate'
  ];
  for (const field of dateFields) {
    // support nested paths like 'stu.studyStart'
    const parts = field.split('.');
    let target = this;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target) break;
      target = target[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (!target) continue; // nothing to normalize
    const val = target[last];
    if (val == null || val === '') {
      // leave empty
      target[last] = undefined;
      continue;
    }
    // If already a Date, normalize to UTC midnight
    if (val instanceof Date) {
      const d = val;
      target[last] = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      continue;
    }
    // If string, try to parse
    if (typeof val === 'string') {
      const parsed = parseStringToDate(val);
      if (parsed) {
        target[last] = parsed;
        continue;
      }
      // invalid date string -> validation error
      const err = new mongoose.Error.ValidationError(this);
      err.addError(field, new mongoose.Error.ValidatorError({ message: `${field} has invalid date format` }));
      return next(err);
    }
    // unsupported type
    const err = new mongoose.Error.ValidationError(this);
    err.addError(field, new mongoose.Error.ValidatorError({ message: `${field} has unsupported type` }));
    return next(err);
  }
  // Normalize childrenList DOBs if present
  if (Array.isArray(this.childrenList)) {
    for (let i = 0; i < this.childrenList.length; i++) {
      const child = this.childrenList[i];
      if (!child) continue;
      const val = child.dob;
      if (val == null || val === '') {
        // leave empty
        this.childrenList[i].dob = undefined;
        continue;
      }
      if (val instanceof Date) {
        const d = val;
        this.childrenList[i].dob = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        continue;
      }
      if (typeof val === 'string') {
        const parsed = parseStringToDate(val);
        if (parsed) {
          this.childrenList[i].dob = parsed;
          continue;
        }
        const err = new mongoose.Error.ValidationError(this);
        err.addError(`childrenList.${i}.dob`, new mongoose.Error.ValidatorError({ message: `childrenList.${i}.dob has invalid date format` }));
        return next(err);
      }
      const err = new mongoose.Error.ValidationError(this);
      err.addError(`childrenList.${i}.dob`, new mongoose.Error.ValidatorError({ message: `childrenList.${i}.dob has unsupported type` }));
      return next(err);
    }
  }
  // Normalize educationList dates if present
  if (Array.isArray(this.educationList)) {
    for (let i = 0; i < this.educationList.length; i++) {
      const edu = this.educationList[i];
      if (!edu) continue;
      // startDate
      const sVal = edu.startDate;
      if (sVal == null || sVal === '') {
        this.educationList[i].startDate = undefined;
      } else if (sVal instanceof Date) {
        const d = sVal;
        this.educationList[i].startDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      } else if (typeof sVal === 'string') {
        const parsed = parseStringToDate(sVal);
        if (parsed) {
          this.educationList[i].startDate = parsed;
        } else {
          const err = new mongoose.Error.ValidationError(this);
          err.addError(`educationList.${i}.startDate`, new mongoose.Error.ValidatorError({ message: `educationList.${i}.startDate has invalid date format` }));
          return next(err);
        }
      } else {
        const err = new mongoose.Error.ValidationError(this);
        err.addError(`educationList.${i}.startDate`, new mongoose.Error.ValidatorError({ message: `educationList.${i}.startDate has unsupported type` }));
        return next(err);
      }

      // endDate
      const eVal = edu.endDate;
      if (eVal == null || eVal === '') {
        this.educationList[i].endDate = undefined;
      } else if (eVal instanceof Date) {
        const d = eVal;
        this.educationList[i].endDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      } else if (typeof eVal === 'string') {
        const parsed = parseStringToDate(eVal);
        if (parsed) {
          this.educationList[i].endDate = parsed;
        } else {
          const err = new mongoose.Error.ValidationError(this);
          err.addError(`educationList.${i}.endDate`, new mongoose.Error.ValidatorError({ message: `educationList.${i}.endDate has invalid date format` }));
          return next(err);
        }
      } else {
        const err = new mongoose.Error.ValidationError(this);
        err.addError(`educationList.${i}.endDate`, new mongoose.Error.ValidatorError({ message: `educationList.${i}.endDate has unsupported type` }));
        return next(err);
      }
    }
  }
  // Normalize documents dates if present
  if (Array.isArray(this.documents)) {
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!doc) continue;
      // startDate
      const sVal = doc.startDate;
      if (sVal == null || sVal === '') {
        this.documents[i].startDate = undefined;
      } else if (sVal instanceof Date) {
        const d = sVal;
        this.documents[i].startDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      } else if (typeof sVal === 'string') {
        const parsed = parseStringToDate(sVal);
        if (parsed) {
          this.documents[i].startDate = parsed;
        } else {
          const err = new mongoose.Error.ValidationError(this);
          err.addError(`documents.${i}.startDate`, new mongoose.Error.ValidatorError({ message: `documents.${i}.startDate has invalid date format` }));
          return next(err);
        }
      } else {
        const err = new mongoose.Error.ValidationError(this);
        err.addError(`documents.${i}.startDate`, new mongoose.Error.ValidatorError({ message: `documents.${i}.startDate has unsupported type` }));
        return next(err);
      }

      // endDate
      const eVal = doc.endDate;
      if (eVal == null || eVal === '') {
        this.documents[i].endDate = undefined;
      } else if (eVal instanceof Date) {
        const d = eVal;
        this.documents[i].endDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      } else if (typeof eVal === 'string') {
        const parsed = parseStringToDate(eVal);
        if (parsed) {
          this.documents[i].endDate = parsed;
        } else {
          const err = new mongoose.Error.ValidationError(this);
          err.addError(`documents.${i}.endDate`, new mongoose.Error.ValidatorError({ message: `documents.${i}.endDate has invalid date format` }));
          return next(err);
        }
      } else {
        const err = new mongoose.Error.ValidationError(this);
        err.addError(`documents.${i}.endDate`, new mongoose.Error.ValidatorError({ message: `documents.${i}.endDate has unsupported type` }));
        return next(err);
      }

      // expiryDate
      const xVal = doc.expiryDate;
      if (xVal == null || xVal === '') {
        this.documents[i].expiryDate = undefined;
      } else if (xVal instanceof Date) {
        const d = xVal;
        this.documents[i].expiryDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      } else if (typeof xVal === 'string') {
        const parsed = parseStringToDate(xVal);
        if (parsed) {
          this.documents[i].expiryDate = parsed;
        } else {
          const err = new mongoose.Error.ValidationError(this);
          err.addError(`documents.${i}.expiryDate`, new mongoose.Error.ValidatorError({ message: `documents.${i}.expiryDate has invalid date format` }));
          return next(err);
        }
      } else {
        const err = new mongoose.Error.ValidationError(this);
        err.addError(`documents.${i}.expiryDate`, new mongoose.Error.ValidatorError({ message: `documents.${i}.expiryDate has unsupported type` }));
        return next(err);
      }
    }
  }
  next();
});

// Auto-increment the 'no' field
hrSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const lastHR = await this.constructor.findOne().sort({ no: -1 });
      this.no = lastHR ? lastHR.no + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  if (this.creativityScore || this.responsibilityScore || this.patriotismScore ||
      this.leadershipScore || this.ethicsScore) {
    this.totalScore = (this.creativityScore || 0) +
                      (this.responsibilityScore || 0) +
                      (this.patriotismScore || 0) +
                      (this.leadershipScore || 0) +
                      (this.ethicsScore || 0);
  }
  next();
});

const HR = mongoose.models && mongoose.models.HR ? mongoose.models.HR : mongoose.model('HR', hrSchema);
export default HR;
