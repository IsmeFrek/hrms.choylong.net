import mongoose from 'mongoose';
import User from './models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kshf_hospital_app';

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Update the user with fullName "ថ្នាក់ដឹកនាំ" to have department "ទាក់ទង"
    const result = await User.updateOne(
      { fullName: 'ថ្នាក់ដឹកនាំ' },
      { $set: { department: 'ទាក់ទង' } }
    );
    console.log('Update result:', result);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
