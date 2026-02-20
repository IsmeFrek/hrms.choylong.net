import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  title: { type: String },
  message: { type: String },
  link: { type: String },
  unread: { type: Boolean, default: true },
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
