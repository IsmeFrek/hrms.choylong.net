import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String },
  action: { type: String, required: true }, // e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
  resource: { type: String }, // e.g., 'Employee', 'Report', 'User'
  details: { type: String }, // Human readable description
  metadata: { type: mongoose.Schema.Types.Mixed }, // Additional data (old values/new values)
  ip: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('AuditLog', auditLogSchema);
