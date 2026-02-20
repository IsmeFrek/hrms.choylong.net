import express from 'express';
import { authRequired } from '../middleware/auth.js';
import HR from '../models/HR.js';

const router = express.Router();

// Returns aggregated dashboard summary (non-personal counts)
router.get('/summary', authRequired, async (req, res, next) => {
  try {
    // total and active
    const totalEmployees = await HR.countDocuments({ status: { $ne: 'Deleted' } });
    const activeEmployees = await HR.countDocuments({ status: 'Active' });

    // new this month
    const now = new Date();
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
    const newThisMonth = await HR.countDocuments({ joinDate: { $gte: start, $lt: end } });

    // departments count (distinct non-empty)
    const deps = await HR.distinct('Department_Kh', { Department_Kh: { $exists: true, $ne: '' } });
    const departments = Array.isArray(deps) ? deps.length : 0;

    // gender counts
    const genderAgg = await HR.aggregate([
      { $match: { gender: { $in: ['Male', 'Female'] } } },
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);
    const genderCounts = { male: 0, female: 0, other: 0 };
    (genderAgg || []).forEach(g => {
      if (g._id === 'Male') genderCounts.male = g.count;
      else if (g._id === 'Female') genderCounts.female = g.count;
    });

    // simple heuristics for extra metrics
    const studyRegex = /study|training|សិក្ស|ស្រាវជ្រាវ|បណ្ដុះ/i;
    const retireRegex = /retir|និវត្ត|ចូលនិវត្ត/i;
    const studyLeave = await HR.countDocuments({ $or: [ { civilServantReason: studyRegex }, { reason: studyRegex }, { workOther: studyRegex } ] });
    const retirements = await HR.countDocuments({ $or: [ { civilServantReason: retireRegex }, { reason: retireRegex }, { workOther: retireRegex } ] });

    // vacancies heuristic: missing staffId or position
    const vacancies = await HR.countDocuments({ $or: [ { staffId: { $exists: false } }, { staffId: '' }, { position: { $exists: false } }, { position: '' } ] });

    return res.json({
      totalEmployees,
      activeEmployees,
      newThisMonth,
      departments,
      genderCounts,
      studyLeave,
      retirements,
      vacancies
    });
  } catch (err) {
    next(err);
  }
});

export default router;
