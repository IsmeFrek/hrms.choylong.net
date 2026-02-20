import mongoose from 'mongoose';
import HR from '../models/hr.js';
import User from '../models/User.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

const normalize = (v) => String(v || '').trim();
const normalizeCompact = (v) => normalize(v).replace(/\s|-/g, '');

const arg = process.argv[2];
const needle = arg ? normalize(arg) : '';

const candidates = new Set();
const add = (v) => {
  const s = normalize(v);
  if (!s) return;
  candidates.add(s);
  candidates.add(s.toLowerCase());
  candidates.add(normalizeCompact(s));
  candidates.add(normalizeCompact(s).toLowerCase());
  if (s.startsWith('+')) {
    candidates.add(s.slice(1));
    candidates.add(s.slice(1).toLowerCase());
  }
};

add(needle);
const digits = needle.replace(/\D/g, '');
if (digits && digits.length === 8) add('0' + digits);

(async () => {
  await mongoose.connect(MONGO);

  if (!needle || needle === '--recent') {
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id phone username fullName roles active createdAt')
      .lean();
    const hrs = await HR.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id staffId phone khmerName name Department_Kh position createdAt')
      .lean();
    console.log('Recent users (10):');
    console.log(users);
    console.log('Recent HR (10):');
    console.log(hrs);
    await mongoose.disconnect();
    return;
  }

  const list = Array.from(candidates);

  const users = await User.find({ $or: [{ phone: { $in: list } }, { username: { $in: list } }] })
    .select('_id phone username fullName roles active')
    .lean();

  const hrs = await HR.find({ $or: [{ staffId: { $in: list } }, { phone: { $in: list } }] })
    .select('_id staffId phone khmerName name Department_Kh position createdAt')
    .lean();

  console.log('needle:', needle);
  console.log('candidates:', list);
  console.log('users:', users);
  console.log('hrs:', hrs);

  await mongoose.disconnect();
})().catch((e) => {
  console.error('debug-myhr failed:', e?.message || e);
  process.exit(1);
});
