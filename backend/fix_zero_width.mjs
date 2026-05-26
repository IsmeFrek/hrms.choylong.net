import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const AttendanceSummarySchema = new mongoose.Schema({ staffId: String, year: Number, month: Number }, { strict: false });
const AttendanceSummary = mongoose.model('AttendanceSummary', AttendanceSummarySchema, 'attendance-summary');

const MonthlySummarySchema = new mongoose.Schema({ staffId: String, year: Number, month: Number }, { strict: false });
const MonthlySummary = mongoose.model('MonthlySummary', MonthlySummarySchema, 'monthly-summary');

const AttendanceDailyReportSchema = new mongoose.Schema({ staffId: String }, { strict: false });
const AttendanceDailyReport = mongoose.model('AttendanceDailyReport', AttendanceDailyReportSchema, 'attendancedailyreports');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app');
  
  // 1. Fix AttendanceSummary
  const summaries = await AttendanceSummary.find({ staffId: /[\u200b]/ });
  console.log(`Found ${summaries.length} AttendanceSummary with zero-width space.`);
  
  for (const doc of summaries) {
    const cleanId = doc.staffId.replace(/[\u200b]/g, '');
    
    // Check if cleanId exists
    const existing = await AttendanceSummary.findOne({ staffId: cleanId, year: doc.year, month: doc.month });
    if (existing) {
      if (doc.attendanceCount > existing.attendanceCount) {
        // Replace existing with doc
        await AttendanceSummary.deleteOne({ _id: existing._id });
        await AttendanceSummary.updateOne({ _id: doc._id }, { $set: { staffId: cleanId } });
        console.log(`Merged and replaced for ${cleanId}`);
      } else {
        // Just delete the dirty one
        await AttendanceSummary.deleteOne({ _id: doc._id });
        console.log(`Deleted dirty for ${cleanId} (existing has more/equal attendance)`);
      }
    } else {
      await AttendanceSummary.updateOne({ _id: doc._id }, { $set: { staffId: cleanId } });
      console.log(`Updated staffId to ${cleanId}`);
    }
  }

  // 2. Fix MonthlySummary
  const monthlies = await MonthlySummary.find({ staffId: /[\u200b]/ });
  console.log(`Found ${monthlies.length} MonthlySummary with zero-width space.`);
  for (const doc of monthlies) {
    const cleanId = doc.staffId.replace(/[\u200b]/g, '');
    const existing = await MonthlySummary.findOne({ staffId: cleanId, year: doc.year, month: doc.month });
    if (existing) {
      await MonthlySummary.deleteOne({ _id: doc._id });
      console.log(`Deleted dirty MonthlySummary for ${cleanId}`);
    } else {
      await MonthlySummary.updateOne({ _id: doc._id }, { $set: { staffId: cleanId } });
      console.log(`Updated MonthlySummary staffId to ${cleanId}`);
    }
  }

  // 3. Fix AttendanceDailyReport
  const dailies = await AttendanceDailyReport.find({ staffId: /[\u200b]/ });
  console.log(`Found ${dailies.length} AttendanceDailyReport with zero-width space.`);
  for (const doc of dailies) {
    const cleanId = doc.staffId.replace(/[\u200b]/g, '');
    await AttendanceDailyReport.updateOne({ _id: doc._id }, { $set: { staffId: cleanId } });
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(console.error);
