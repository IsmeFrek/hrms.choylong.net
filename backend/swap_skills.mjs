import mongoose from 'mongoose';

const uri = 'mongodb://localhost:27017/kshf_hospital_app';

async function swapSkills() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Use aggregation pipeline to swap fields
    const result = await mongoose.connection.collection('hrs').updateMany(
      {},
      [{
        $set: {
          skill: "$civilServantRole",
          civilServantRole: "$skill"
        }
      }]
    );

    console.log(`Updated ${result.modifiedCount} HR records.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

swapSkills();
