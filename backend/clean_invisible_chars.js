import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/kshf_hospital_app').then(async () => {
  const models = ['HR', 'Attendance', 'AttendanceDailyReport', 'MonthlySummary', 'WorkScheduleEmployee'];
  
  const invisiblePattern = /[\u200B-\u200D\uFEFF]/;

  for (const modelName of models) {
    const Model = mongoose.model(modelName, new mongoose.Schema({}, {strict: false}));
    const docs = await Model.find({});
    let updated = 0;
    
    for (const doc of docs) {
      if (typeof doc.staffId === 'string' && invisiblePattern.test(doc.staffId)) {
        const cleaned = doc.staffId.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        await Model.updateOne({ _id: doc._id }, { $set: { staffId: cleaned } });
        updated++;
      }
    }
    console.log(`Model ${modelName}: cleaned ${updated} docs.`);
  }

  process.exit(0);
});
