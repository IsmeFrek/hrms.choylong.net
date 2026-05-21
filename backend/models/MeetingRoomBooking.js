import mongoose from 'mongoose';

const meetingRoomBookingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  user: { type: String, required: true },
  roomId: { type: String, required: true },
  slot: { type: String, required: true },
  roomName: { type: String },
  dateStr: { type: String, required: true }, // YYYY-MM-DD
  dateText: { type: String },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  participants: { type: String },
  amenities: { type: String },
  attachmentUrl: { type: String },
  attachmentName: { type: String },
  attachmentSize: { type: Number },
  note: { type: String },
  isCancelled: { type: Boolean, default: false },
  cancelledAt: { type: String }
}, { timestamps: true });

export default mongoose.model('MeetingRoomBooking', meetingRoomBookingSchema);
