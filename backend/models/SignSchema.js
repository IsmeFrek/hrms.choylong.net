import mongoose from 'mongoose';

const signSchema = new mongoose.Schema({
  // ឈ្មោះ ឬ លេខកូដ (Name or Employee ID)
  name: { 
    type: String, 
    required: true,
    unique: true // ធានាថាមានតែមួយហត្ថលេខាសម្រាប់ឈ្មោះ/លេខកូដមួយ
  },
  
  // ឈ្មោះពេញ (Full name in Khmer)
  fullNameKh: { 
    type: String 
  },
  
  // ប្រភេទហត្ថលេខា (Signature type)
  type: {
    type: String,
    enum: ['khmer', 'employee', 'director', 'deputy', 'office', 'admin'],
    default: 'employee'
  },
  
  // ផ្លូវឯកសារហត្ថលេខា (Signature file path)
  filePath: {
    type: String,
    required: true
  },
  
  // ឈ្មោះឯកសារដើម (Original filename)
  originalFileName: {
    type: String
  },
  
  // ប្រភេទឯកសារ (File mime type)
  mimeType: {
    type: String,
    default: 'image/jpeg'
  },
  
  // ទំហំឯកសារ (File size in bytes)
  fileSize: {
    type: Number
  },
  
  // ការពិពណ៌នា (Description)
  description: {
    type: String
  },
  
  // តួនាទី/មុខតំណែង (Position/Role)
  position: {
    type: String
  },
  
  // ផ្នែក/នាយកដ្ឋាន (Department)
  department: {
    type: String
  },
  
  // ស្ថានភាព (Status)
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  
  // អ្នកបង្កើត (Created by user)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // អ្នកកែប្រែចុងក្រោយ (Last updated by user)
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // កំណត់សម្គាល់បន្ថែម (Additional notes)
  notes: {
    type: String
  },
  
  // កាលបរិច្ឆេទផុតកំណត់ (Expiry date for signature validity)
  expiryDate: {
    type: Date
  },
  
  // ទិន្នន័យ metadata បន្ថែម
  metadata: {
    // ដំណោះស្រាយរូបភាព (Image resolution)
    width: { type: Number },
    height: { type: Number },
    
    // ចុងក្រោយបានប្រើ (Last used)
    lastUsed: { type: Date },
    
    // ចំនួនដងប្រើប្រាស់ (Usage count)
    usageCount: { type: Number, default: 0 },
    
    // តាគឬស្លាក (Tags for categorization)
    tags: [{ type: String }]
  }
}, {
  timestamps: true // បន្ថែម createdAt និង updatedAt ដោយស្វ័យប្រវត្តិ
});

// Index សម្រាប់ការស្វែងរកលឿន
signSchema.index({ name: 1 });
signSchema.index({ type: 1 });
signSchema.index({ status: 1 });
signSchema.index({ department: 1 });
signSchema.index({ createdAt: -1 });

// Middleware ដើម្បីធ្វើបច្ចុប្បន្នភាព usageCount
signSchema.methods.recordUsage = function() {
  this.metadata.usageCount += 1;
  this.metadata.lastUsed = new Date();
  return this.save();
};

// Static method ដើម្បីស្វែងរកហត្ថលេខាតាមឈ្មោះ
signSchema.statics.findByName = function(name) {
  return this.findOne({ 
    name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
    status: 'active'
  });
};

// Static method ដើម្បីស្វែងរកហត្ថលេខាតាមប្រភេទ
signSchema.statics.findByType = function(type) {
  return this.find({ 
    type: type,
    status: 'active'
  }).sort({ name: 1 });
};

// Virtual ដើម្បីទទួលបាន URL ពេញ
signSchema.virtual('signatureUrl').get(function() {
  if (this.filePath) {
    // ធានាថា filePath ចាប់ផ្តើមដោយ /
    return this.filePath.startsWith('/') ? this.filePath : '/' + this.filePath;
  }
  return null;
});

// ធានាថា virtual fields ត្រូវបានរួមបញ្ចូលនៅពេល JSON serialization
signSchema.set('toJSON', { virtuals: true });
signSchema.set('toObject', { virtuals: true });

const SignSchema = mongoose.model('SignSchema', signSchema);

export default SignSchema;