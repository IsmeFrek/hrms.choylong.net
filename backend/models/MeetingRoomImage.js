import mongoose from 'mongoose';

const meetingRoomImageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  originalFilename: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: String
}, { timestamps: true });

export default mongoose.model('MeetingRoomImage', meetingRoomImageSchema);
