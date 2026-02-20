import express from 'express';
import DocumentFlow from '../models/DocumentFlow.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authRequired, requirePermission } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

router.use(authRequired);

// Multer config to store under public/Uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../public/Uploads');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOADS_DIR); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'docflow-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
const uploadMany = (req, res, next) => upload.array('files', 8)(req, res, (err) => {
  if (err) return res.status(400).json({ message: err.message || 'Upload error' });
  next();
});

// List
router.get('/', requirePermission('view:documents'), async (req, res) => {
  const list = await DocumentFlow.find().sort({ createdAt: -1 });
  res.json(list);
});

// Create
router.post('/', requirePermission('edit:documents'), async (req, res) => {
  const body = req.body || {};
  try {
    const doc = await DocumentFlow.create(body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Update
router.put('/:id', requirePermission('edit:documents'), async (req, res) => {
  try {
    const doc = await DocumentFlow.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Delete
router.delete('/:id', requirePermission('edit:documents'), async (req, res) => {
  const doc = await DocumentFlow.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json({ ok: true });
});

// Upload reference files (images/pdf) and attach to documentFlow
router.post('/:id/reference-files', requirePermission('edit:documents'), uploadMany, async (req, res) => {
  const doc = await DocumentFlow.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  const files = (req.files || []).map(f => ({ filename: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size }));
  doc.referenceFiles = [...(doc.referenceFiles || []), ...files];
  await doc.save();
  res.json(doc);
});

// Remove a reference file by filename
router.delete('/:id/reference-files/:filename', requirePermission('edit:documents'), async (req, res) => {
  const { id, filename } = req.params;
  const doc = await DocumentFlow.findById(id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  const before = (doc.referenceFiles || []).length;
  doc.referenceFiles = (doc.referenceFiles || []).filter(f => f.filename !== filename);
  await doc.save();
  // Do not delete the actual file from disk to keep logs; optional: unlink
  return res.json({ ok: true, removed: before - doc.referenceFiles.length, doc });
});

// Upload a signature image for office/deputy1/deputy2/director and set URL on document
router.post('/:id/signature/:who', requirePermission('edit:documents'), upload.single('file'), async (req, res) => {
  const { id, who } = req.params;
  const map = {
    office: 'officeSignUrl',
    deputy1: 'deputySign1Url',
    deputy2: 'deputySign2Url',
    deputy3: 'deputySign3Url',
    deputy4: 'deputySign4Url',
    deputy5: 'deputySign5Url',
    deputy6: 'deputySign6Url',
    deputy7: 'deputySign7Url',
    deputy8: 'deputySign8Url',
    deputy9: 'deputySign9Url',
    director: 'directorSignUrl'
  };
  const field = map[who];
  if (!field) return res.status(400).json({ message: 'Invalid target' });
  const doc = await DocumentFlow.findById(id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  const f = req.file;
  if (!f) return res.status(400).json({ message: 'No file uploaded' });
  // Store relative URL under /Uploads
  doc[field] = `/Uploads/${f.filename}`;
  await doc.save();
  return res.json({ ok: true, doc, field, url: doc[field] });
});

// Request comment form (create a comment request and move stage)
router.post('/:id/request-comment', requirePermission('edit:documents'), async (req, res) => {
  const { content } = req.body || {};
  const user = req.auth?.user;
  const doc = await DocumentFlow.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  doc.commentRequest = {
    content: content || '',
    byUserId: user?._id,
    byName: user?.fullName || user?.email,
    requestedAt: new Date()
  };
  doc.stage = 'comment_request';
  await doc.save();
  // Notify requestor themself (simple) - optionally expand to a team later
  try {
    if (user?._id) {
      await Notification.create({
        userId: user._id,
        title: 'សុំមតិយោបល់',
        message: `សុំមតិលើលិខិត ${doc.letterNumber || ''} (${doc.source || ''})`,
        link: `/`,
      });
    }
  } catch {}
  res.json(doc);
});

// Advance workflow: office -> deputy9 -> ... -> director -> completed
const ORDER = ['office','deputy9','deputy8','deputy7','deputy6','deputy5','deputy4','deputy3','deputy2','director'];

router.post('/:id/advance', requirePermission('approve:hr'), async (req, res) => {
  const { comment, decision } = req.body || {};
  const user = req.auth?.user;
  const doc = await DocumentFlow.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });

  // If still draft or comment_request, send to office first
  if (doc.stage === 'draft' || doc.stage === 'comment_request') {
    doc.stage = 'office';
  } else {
    const idx = ORDER.indexOf(doc.stage);
    if (idx === -1) doc.stage = 'office';
    else if (idx < ORDER.length - 1) doc.stage = ORDER[idx + 1];
    else doc.stage = 'completed';
  }

  doc.approvals.push({
    step: doc.stage,
    byUserId: user?._id,
    byName: user?.fullName || user?.email,
    comment: comment || '',
    decision: decision || 'commented',
    decidedAt: new Date()
  });
  await doc.save();
  res.json(doc);
});

// Assign helper route (place after export default in file if needed by bundler ordering)
// POST /api/document-flow/:id/assign { stage, name, officerName, officeName, leftName, rightName, directorName, officeUserId, deputyUserId1, deputyUserId2, directorUserId }
router.post('/:id/assign', requirePermission('approve:hr'), async (req, res) => {
  const {
    stage,
    name,
    assigneeUserId,
    officerName,
    officeName,
    rightName,
    leftName,
    directorName,
    officeUserId,
    deputyUserId1,
    deputyUserId2,
    directorUserId
  } = req.body || {};
  const doc = await DocumentFlow.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  const requested = (stage || '').trim();
  const nextStage = ORDER.includes(requested) ? requested : 'office';
  doc.stage = nextStage;
  doc.assigneeName = name || '';
  if (assigneeUserId) doc.assigneeUserId = assigneeUserId;
  // Save all 5 stage names
  if (officerName !== undefined) doc.officerName = officerName;
  if (officeName !== undefined) doc.officeHeadName = officeName;
  if (rightName !== undefined) doc.rightName = rightName;
  if (leftName !== undefined) doc.leftName = leftName;
  if (directorName !== undefined) doc.directorName = directorName;
  // Save per-stage user IDs if provided
  if (officeUserId !== undefined) doc.officeUserId = officeUserId || undefined;
  if (deputyUserId1 !== undefined) doc.deputyUserId1 = deputyUserId1 || undefined;
  if (deputyUserId2 !== undefined) doc.deputyUserId2 = deputyUserId2 || undefined;
  if (directorUserId !== undefined) doc.directorUserId = directorUserId || undefined;
  await doc.save();
  // Notify the assignee if a user is linked (top-level assigneeUserId)
  try {
    if (doc.assigneeUserId) {
      await Notification.create({
        userId: doc.assigneeUserId,
        title: 'ការបញ្ជាក់មតិ',
        message: `សូមពិនិត្យ និងបញ្ចេញមតិ: លិខិត ${doc.letterNumber || ''} (${doc.source || ''})`,
        link: `/`,
      });
    }
  } catch {}
  res.json(doc);
});

export default router;
