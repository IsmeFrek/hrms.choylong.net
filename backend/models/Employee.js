import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  // Auto-increment ID
  no: { type: Number, unique: true },
  
  // Basic Personal Information
  staffId: { type: String, unique: true },
  khmerName: { type: String },
  name: { type: String },
  gender: { type: String, enum: ['Male', 'Female'] },
  dob: { type: Date },
  maritalStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  
  // Contact Information
  phone: { type: String },
  birthPlace: { type: String },
  currentPlace: { type: String },
  
  // Work Information (តាមរូបភាព)
  officerType: { type: String }, // ប្រភេទមន្ត្រី
  position: { type: String },    // តួនាទី
  civilServantRole: { type: String }, // ជំនាញក្រសួង
  skill: { type: String },  // ឯកទេស/ជំនាញមន្ទីរពេទ្យ
  Department_Kh: { type: String },  // ផ្នែក
  joinDate: { type: Date },      // កាលបរិច្ឆេទចូលបម្រើការងារ
  dateJoinedMinistry: { type: String }, // កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរពេទ្យ
  lastSalaryIncrementDate: { type: String }, // កាលបរិច្ឆេទបញ្ចប់តំណែងមន្ទីរពេទ្យ
  workOther: { type: String },   // ផ្សេងៗ
  
  // Education
  degreeLevel: { type: String },
  degree: { type: String },
  educationLevel: { type: String }, // កម្រិតវប្បធម៌
  
  // Documents
  officerId: { type: String },
  cardNumber: { type: String },
  nid: { type: String },
  bankAccount: { type: String },
  
  // Civil Servant Information (matching MongoDB civilServants collection)
  civilServantId: { type: String },
  dateJoinedGov: { type: String }, // "15/01/2010" format to match MongoDB
  dateJoinedMinistry: { type: String }, // "10/03/2012" format to match MongoDB
  yearsInCurrentRank: { type: Number },
  lastSalaryIncrementDate: { type: String }, // "01/01/2023" format to match MongoDB
  rankExitReason: { type: String },
  rankExitDuration: { type: Number },
  grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F'] },
  proposedBy: { type: String },
  yearsInRank: { type: Number },
  totalYearsWorked: { type: Number },
  asOfDate: { type: String }, // "01/08/2025" format to match MongoDB
  salaryLevel: { type: String },
  mentorName: { type: String },
  mentorDate: { type: String },
  
  // Performance Scores (matching MongoDB civilServants collection)
  creativityScore: { type: Number, min: 0, max: 10 },
  responsibilityScore: { type: Number, min: 0, max: 10 },
  patriotismScore: { type: Number, min: 0, max: 10 },
  leadershipScore: { type: Number, min: 0, max: 10 },
  ethicsScore: { type: Number, min: 0, max: 10 },
  totalScore: { type: Number },
  
  // Evaluation Reasons (matching MongoDB civilServants collection)
  reason1: { type: String },
  reason2: { type: String },
  reason3: { type: String },
  reason4: { type: String },
  reason5: { type: String },
  reason6: { type: String },
  
  // Additional Information
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  image: { type: String },
  customPattern: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  other: { type: String }
}, {
  timestamps: true
});

// Auto-increment the 'no' field
employeeSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const lastEmployee = await this.constructor.findOne().sort({ no: -1 });
      this.no = lastEmployee ? lastEmployee.no + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  // Auto-calculate total score
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

const Employee = mongoose.model('Employee', employeeSchema, 'hrs');
export default Employee;
