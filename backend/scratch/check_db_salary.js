import mongoose from 'mongoose';

const mongoURI = 'mongodb://localhost:27017/hrms'; // or check backend config for connection URI
// Wait, let's find the correct connection string from backend config
// Let's connect and query
async function main() {
  try {
    // Read the URI from backend config or use env
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kshf_hospital_app';
    await mongoose.connect(uri);
    console.log('Connected to DB');
    const db = mongoose.connection.db;
    const hrs = db.collection('hrs');
    
    const salaryLevels = await hrs.distinct('salaryLevel');
    console.log('Unique salary levels in DB:', salaryLevels);
    
    // Count active civil servants
    const count = await hrs.countDocuments({ status: { $ne: 'Inactive' } });
    console.log('Active employees count:', count);
    
    // Sample some employees with salaryLevel
    const sample = await hrs.find({ salaryLevel: { $exists: true, $ne: '' } }).limit(10).toArray();
    console.log('Sample employees with salaryLevel:');
    sample.forEach(s => {
      console.log(`- ${s.khmerName || s.name} (${s.staffId}): salaryLevel = ${s.salaryLevel}, status = ${s.status}, officerType = ${s.officerType}`);
    });
    
    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
}
main();
