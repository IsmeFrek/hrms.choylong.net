import mongoose from 'mongoose';
mongoose.connect('mongodb://127.0.0.1:27017/kshf_hospital_app');
const WorkSchedule = mongoose.model('WorkSchedule', new mongoose.Schema({}, { strict: false }), 'workschedules');
WorkSchedule.find({
  $or: [{ 'employeeId': { $exists: true } }]
}).populate('employeeId').then(docs => {
  // Let's just find schedules for any HR whose staffId matches 1337
  const s1337Docs = docs.filter(d => {
    const hr = d.employeeId;
    if (!hr) return false;
    const staffId = hr.staffId || hr.no || '';
    return String(staffId).includes('1337');
  });
  console.log(`Found ${s1337Docs.length} schedules for S1337`);
  s1337Docs.forEach(d => {
    const data = d.toObject();
    const dateStr = data.date ? data.date.toISOString().slice(0, 10) : '';
    console.log(`${dateStr} - shiftStart: ${data.shiftStart} - shiftEnd: ${data.shiftEnd} - title: ${data.shiftTitle}`);
  });
  mongoose.disconnect();
});
