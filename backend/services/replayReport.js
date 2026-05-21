import fs from 'fs';
import path from 'path';
import SignSchema from '../models/SignSchema.js';

function escapeHtml(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
const KHMER_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

function toKhmerDigits(num) {
  if (num === null || num === undefined) return '';
  const s = String(num);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch >= '0' && ch <= '9') out += KHMER_DIGITS[parseInt(ch, 10)];
    else out += ch;
  }
  return out;
}

function formatKhmerDate(d) {
  if (!d) return '........';
  try {
    const day = toKhmerDigits(d.getDate());
    const month = KHMER_MONTHS[d.getMonth()] || '';
    const year = toKhmerDigits(d.getFullYear());
    return `ថ្ងៃទី ${day}  ខែ ${month}  ឆ្នាំ ${year}`;
  } catch (e) {
    return '........';
  }
}

function pad2(n) {
  if (n === null || n === undefined) return '';
  return n < 10 ? `0${n}` : String(n);
}

function formatKhmerDateTime(d) {
  if (!d) return '........';
  try {
    const datePart = formatKhmerDate(d);
    const hh = d.getHours();
    const mm = d.getMinutes();
    return `${datePart}  ម៉ោង ${toKhmerDigits(pad2(hh))}:${toKhmerDigits(pad2(mm))}`;
  } catch (e) {
    return formatKhmerDate(d);
  }
}

function applyEntryTime(baseDate, entryTime) {
  if (!baseDate) return null;
  const clone = new Date(baseDate);
  if (!entryTime || typeof entryTime !== 'string') return clone;
  const parts = entryTime.split(':').map((p) => parseInt(p, 10));
  if (!parts.length) return clone;
  const [hh, mm = 0, ss = 0] = parts;
  if (!Number.isNaN(hh)) clone.setHours(hh, Number.isNaN(mm) ? 0 : mm, Number.isNaN(ss) ? 0 : ss);
  return clone;
}

function parsePreferLocalTime(raw, entryTime) {
  if (!raw) return null;
  const d = raw instanceof Date ? new Date(raw.getTime()) : new Date(raw);
  try {
    let isDateOnly = false;
    if (typeof raw === 'string') {
      if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/.test(raw)) isDateOnly = true;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) isDateOnly = true;
    }
    // Only substitute `now` for date-only / midnight-UTC when there is no
    // explicit `entryTime` provided. If `entryTime` exists, prefer that value
    // and avoid using the viewer's current time which would vary between renders.
    if (!entryTime && (isDateOnly || (d.getHours && d.getHours() === 0 && d.getMinutes && d.getMinutes() === 0 && /(?:Z|\+00:00)$/.test(String(raw))))) {
      const now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }
  } catch (e) { }
  return d;
}

function extToMime(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.gif') return 'image/gif';
  if (e === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function fileToDataUri(absPath) {
  try {
    if (!absPath) return null;
    const buf = await fs.promises.readFile(absPath);
    const mime = extToMime(path.extname(absPath));
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    return null;
  }
}

function resolveUploadsAbsPath(filePathValue) {
  if (!filePathValue) return null;
  const s = String(filePathValue).trim();
  if (!s) return null;
  const basename = path.basename(s);
  // server runs from repo root (task uses `node backend/server.js`)
  const a = path.resolve(process.cwd(), 'public', 'Uploads', basename);
  const b = path.resolve(process.cwd(), 'public', 'uploads', basename);
  try {
    if (fs.existsSync(a)) return a;
    if (fs.existsSync(b)) return b;
  } catch (e) { }
  return a;
}

async function resolveStageSignature(stageAssigned) {
  try {
    if (!stageAssigned) return null;

    if (typeof stageAssigned === 'object') {
      const filePath = stageAssigned.filePath || stageAssigned.signatureUrl || stageAssigned.url;
      const name = stageAssigned.fullNameKh || stageAssigned.fullName || stageAssigned.name || '';
      if (filePath) {
        const abs = resolveUploadsAbsPath(filePath);
        const dataUri = abs ? await fileToDataUri(abs) : null;
        return { name, filePath, dataUri };
      }
    }

    const id = String(stageAssigned).trim();
    if (!id) return null;

    const sig = await SignSchema.findById(id).lean().exec().catch(() => null);
    if (!sig) {
      // If not a signature id, this might already be a display name.
      // Avoid showing raw ObjectId-like values.
      if (/^[a-fA-F0-9]{24}$/.test(id)) return null;
      return { name: id, filePath: null, dataUri: null };
    }

    const filePath = sig.filePath || sig.signatureUrl;
    const name = sig.fullNameKh || sig.fullName || sig.name || '';
    const abs = resolveUploadsAbsPath(filePath);
    const dataUri = abs ? await fileToDataUri(abs) : null;
    return { name, filePath, dataUri };
  } catch (e) {
    return null;
  }
}

function safeNum(n, fallback, { min = -Infinity, max = Infinity } = {}) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  if (v < min) return fallback;
  if (v > max) return fallback;
  return v;
}

function noteHasValue(note) {
  try {
    return String(note || '').trim().length > 0;
  } catch (e) {
    return false;
  }
}

function renderStageBox({
  roleLabel,
  roleFontSize,
  noteText,
  noteTextAlign = 'justify',
  dateText,
  signatureDataUri,
  signatureStyle,
  senderName,
  outerPaddingPx = 1,
  outerMarginTopPx = 5,
  innerPaddingPx = 1,
  showDateAndSignature,
}) {
  const note = String(noteText || '');
  const has = noteHasValue(note);
  const showSig = Boolean(showDateAndSignature && has);

  const sigImg = showSig && signatureDataUri
    ? `<div style="margin-top:0;"><img src="${signatureDataUri}" alt="sig" style="${signatureStyle || 'max-width:100px; max-height:80px; object-fit:contain; display:block; margin:0 auto;'}" /></div>`
    : '';
  const dateLine = showSig && dateText ? `<div>ធ្វើនៅ ${escapeHtml(dateText)}</div>` : '';

  return `
    <div style="border:1px dashed #161616ff; padding:${outerPaddingPx}px; margin-top:${outerMarginTopPx}px;">
      <div style="padding:${innerPaddingPx}px;">
        <div class="role-label" style="text-align:center; margin-top:2px; font-family:'Khmer OS Muol Light','Khmer OS',Arial,sans-serif; ${roleFontSize ? `font-size:${roleFontSize}px;` : ''}">${escapeHtml(roleLabel || '')}</div>
        <div class="note" style="width:100%; height:auto; min-height:24px; line-height:inherit; text-align:${noteTextAlign}; margin:0; padding:5px; box-sizing:border-box; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; text-indent:30px;">${escapeHtml(note)}</div>
        <div style="text-align:center; margin-top:0;">
          ${dateLine}
          ${sigImg}
          <div class="sender-name" style="font-family:'Khmer OS muol light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,'sans-serif'; margin-top:0; font-weight:100;">${escapeHtml(senderName || '')}</div>
        </div>
      </div>
    </div>
  `;
}

function computeVisibleBuckets(item) {
  const meta = item?.meta || {};
  const stages = meta?.feedbackStages || {};

  const buckets = [
    { key: 'S', variants: ['s', 'S'], metaKey: 'CourseNote', dateKey: 'CourseDate' },
    { key: 'S1', variants: ['s1', 'S1'], metaKey: 'Course1Note', dateKey: 'Course1Date' },
    { key: 'S2', variants: ['s2', 'S2'], metaKey: 'Course2Note', dateKey: 'Course2Date' },
    { key: 'S3', variants: ['sd', 'SD', 's3', 'S3'], metaKey: 'Course3Note', dateKey: 'Course3Date' },
    { key: 'S4', variants: ['sdr', 'SDR', 's4', 'S4'], metaKey: 'Course4Note', dateKey: 'Course4Date' },
    { key: 'S5', variants: ['s5', 'S5', 'dir', 'DIR', 'sdir', 'SDIR'], metaKey: 'Course5Note', dateKey: 'Course5Date' },
    { key: 'S6', variants: ['s6', 'S6', 'ho', 'HO'], metaKey: 'Course6Note', dateKey: 'Course6Date' },
  ];

  const variantSelected = (variants) => {
    try {
      for (const k of variants || []) {
        const v = stages?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return true;
      }
    } catch (e) { }
    return false;
  };

  const hasNote = (metaKey) => {
    try {
      const v = meta?.[metaKey];
      return v !== undefined && v !== null && String(v).trim() !== '';
    } catch (e) {
      return false;
    }
  };

  const present = buckets
    .map((b) => ({ bucket: b, present: variantSelected(b.variants) || hasNote(b.metaKey) }))
    .filter((x) => x.present)
    .map((x) => x.bucket);

  const orderKeys = buckets.map((b) => b.key);
  const anySavedNote = present.some((b) => hasNote(b.metaKey));

  const withDates = present.map((b) => {
    let ts = null;
    try {
      const raw = meta?.[b.dateKey];
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) ts = d.getTime();
      }
    } catch (e) {
      ts = null;
    }
    return { key: b.key, ts, bucket: b };
  });

  if (anySavedNote) {
    withDates.sort((a, z) => {
      if (a.ts !== null && z.ts !== null) return a.ts - z.ts;
      if (a.ts !== null && z.ts === null) return -1;
      if (a.ts === null && z.ts !== null) return 1;
      return orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key);
    });
  } else {
    withDates.sort((a, z) => orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key));
  }

  const ordered = withDates.map((x) => x.bucket);

  let lastNotedIndex = -1;
  for (let i = 0; i < ordered.length; i++) {
    if (hasNote(ordered[i].metaKey)) lastNotedIndex = i;
  }

  const visibleKeys = new Set();
  if (ordered.length > 0) {
    if (lastNotedIndex >= 0) {
      for (let i = 0; i <= lastNotedIndex; i++) visibleKeys.add(ordered[i].key);
      if (lastNotedIndex + 1 < ordered.length) visibleKeys.add(ordered[lastNotedIndex + 1].key);
    } else {
      visibleKeys.add(ordered[0].key);
    }
  }

  return ordered.filter((b) => visibleKeys.has(b.key));
}

function stageRoleLabel(meta, stageKey) {
  try {
    const roles = meta?.feedbackStageRoles;
    const key = String(stageKey || '').toLowerCase();
    if (roles && typeof roles === 'object' && roles[key]) return String(roles[key]);
  } catch (e) { }

  const map = {
    s: 'មន្រ្តីទទួលបន្ទុក',
    s1: 'យោបល់ប្រធានការិយាល័យបច្ចេកទេស',
    s2: 'យោបល់ប្រធានការិយាល័យហិរញ្ញវត្ថុ',
    s3: 'យោបល់ប្រធានការិយាល័យរដ្ឋបាលបុគ្គលិក',
    s4: 'យោបល់នាយករងមន្ទីរពេទ្យ',
    s5: 'យោបល់នាយករងមន្ទីរពេទ្យ',
    s6: 'យោបល់នាយកមន្ទីរពេទ្យ',
  };
  return map[String(stageKey || '').toLowerCase()] || '';
}

function bucketStageKey(bucketKey) {
  // bucketKey is like 'S3' -> stageKey for roles is 's3'
  return String(bucketKey || '').toLowerCase();
}

function noteForBucket(meta, bucket) {
  try {
    const v = meta?.[bucket.metaKey];
    return v === undefined || v === null ? '' : String(v);
  } catch (e) {
    return '';
  }
}

function dateForBucket(meta, bucket, fallbackDate) {
  try {
    const raw = meta?.[bucket.dateKey] || fallbackDate;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch (e) {
    return null;
  }
}

function pickStageAssigned(meta, bucket) {
  try {
    const stages = meta?.feedbackStages || {};
    for (const k of bucket.variants || []) {
      const v = stages?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  } catch (e) { }
  return null;
}

function fallbackCapturedDate(item) {
  const raw = item?.date || item?.createdAt || item?.created_at || null;
  const d = parsePreferLocalTime(raw) || new Date();
  return d;
}

export async function buildReplayReportHtml(item, options = {}) {
  const {
    fontSize = 15,
    lineHeight = 1.8,
    paraBeforePx = 1,
    paraAfterPx = 1,
    paddingTopMm = 5,
  } = options || {};

  const meta = item?.meta || {};
  const captured = fallbackCapturedDate(item);

  const logoAbs = path.resolve(process.cwd(), 'src', 'assets', '3.JPG');
  const logoData = await fileToDataUri(logoAbs);

  const visibleBuckets = computeVisibleBuckets(item);
  const visibleKeys = new Set((visibleBuckets || []).map((b) => b.key));

  // Resolve signatures for visible stages (best-effort)
  const sigByKey = {};
  for (const b of visibleBuckets) {
    const assigned = pickStageAssigned(meta, b);
    sigByKey[b.key] = await resolveStageSignature(assigned);
  }

  const entryNo = item?.entryNo || item?.entry_no || '';
  const entryDateRaw = item?.entryDate || item?.entry_date || item?.date || null;
  const entryTime = (item?.entryTime || item?.entry_time || '').trim();
  const entryDate = applyEntryTime(parsePreferLocalTime(entryDateRaw, entryTime) || captured, entryTime);

  const letterNo = item?.letterNo || item?.letter_no || '';
  const letterDateRaw = item?.date || captured;
  const letterDate = parsePreferLocalTime(letterDateRaw) || captured;

  const source = item?.source || item?.origin || item?.from || '';
  const content = item?.content || item?.description || item?.summary || item?.subject || '';
  const creatorName = item?.creatorName || item?.owner || item?.handler || item?.current_handler || '';

  const getBucket = (k) => (visibleBuckets || []).find((b) => b.key === k) || null;

  const renderS = () => {
    if (!visibleKeys.has('S')) return '';
    const b = getBucket('S');
    const note = b ? noteForBucket(meta, b) : '';
    const d = b ? dateForBucket(meta, b, captured) : captured;
    const sig = sigByKey.S || null;
    const role = (meta?.feedbackStageRoles?.s) || stageRoleLabel(meta, 's') || meta?.reporterName || '';
    return renderStageBox({
      roleLabel: role,
      roleFontSize: 10,
      noteText: note,
      dateText: formatKhmerDateTime(d),
      signatureDataUri: sig?.dataUri || null,
      signatureStyle: 'max-width:100px; max-height:80px; object-fit:contain; display:block; margin:0 auto;',
      senderName: sig?.name || '',
      outerPaddingPx: 1,
      outerMarginTopPx: 5,
      innerPaddingPx: 1,
      showDateAndSignature: true,
    });
  };

  const renderS1 = () => {
    if (!visibleKeys.has('S1')) return '';
    const b = getBucket('S1');
    const note = b ? noteForBucket(meta, b) : '';
    const d = b ? dateForBucket(meta, b, captured) : captured;
    const sig = sigByKey.S1 || null;
    const role = stageRoleLabel(meta, 's1');
    return renderStageBox({
      roleLabel: role,
      noteText: note,
      dateText: formatKhmerDateTime(d),
      signatureDataUri: sig?.dataUri || null,
      signatureStyle: 'max-width:120px; max-height:80px; object-fit:contain; display:block; margin:0 auto;',
      senderName: sig?.name || '',
      outerPaddingPx: 1,
      outerMarginTopPx: 5,
      innerPaddingPx: 1,
      showDateAndSignature: true,
    });
  };

  const renderS2 = () => {
    if (!visibleKeys.has('S2')) return '';
    const b = getBucket('S2');
    const note = b ? noteForBucket(meta, b) : '';
    const d = b ? dateForBucket(meta, b, captured) : captured;
    const sig = sigByKey.S2 || null;
    const role = stageRoleLabel(meta, 's2');
    return renderStageBox({
      roleLabel: role,
      noteText: note,
      dateText: formatKhmerDateTime(d),
      signatureDataUri: sig?.dataUri || null,
      signatureStyle: 'max-width:120px; max-height:60px; object-fit:contain; display:block; margin:0 auto;',
      senderName: sig?.name || '',
      outerPaddingPx: 1,
      outerMarginTopPx: 5,
      innerPaddingPx: 1,
      showDateAndSignature: true,
    });
  };

  const renderDeputyStack = () => {
    const hasS3 = visibleKeys.has('S3');
    const hasS4 = visibleKeys.has('S4');
    const hasS5 = visibleKeys.has('S5');
    // Mirror ReplayfilePage: avoid rendering S4 here if S5 is present (S4 will be rendered side-by-side with S5)
    const leftVisible = hasS3;
    const rightVisible = hasS4 && !hasS5;
    if (!leftVisible && !rightVisible) return '';

    const s3 = (() => {
      if (!leftVisible) return '';
      const b = getBucket('S3');
      const note = b ? noteForBucket(meta, b) : '';
      const d = b ? dateForBucket(meta, b, captured) : captured;
      const sig = sigByKey.S3 || null;
      const role = stageRoleLabel(meta, 's3');
      return renderStageBox({
        roleLabel: role,
        noteText: note,
        dateText: formatKhmerDateTime(d),
        signatureDataUri: sig?.dataUri || null,
        signatureStyle: 'max-width:100px; max-height:80px; object-fit:contain; display:block; margin:0 auto;',
        senderName: sig?.name || '',
        outerPaddingPx: 1,
        outerMarginTopPx: 5,
        innerPaddingPx: 1,
        showDateAndSignature: true,
      });
    })();

    const s4 = (() => {
      if (!rightVisible) return '';
      const b = getBucket('S4');
      const note = b ? noteForBucket(meta, b) : '';
      const d = b ? dateForBucket(meta, b, captured) : captured;
      const sig = sigByKey.S4 || null;
      const role = stageRoleLabel(meta, 's4');
      return renderStageBox({
        roleLabel: role,
        noteText: note,
        dateText: formatKhmerDateTime(d),
        signatureDataUri: sig?.dataUri || null,
        signatureStyle: 'max-width:120px; max-height:80px; object-fit:contain; display:block; margin:0 auto;',
        senderName: sig?.name || '',
        outerPaddingPx: 1,
        outerMarginTopPx: 5,
        innerPaddingPx: 1,
        showDateAndSignature: true,
      });
    })();

    if (leftVisible && rightVisible) {
      return `<div style="margin-top:5px;">${s3}<div style="height:5px;"></div>${s4}</div>`;
    }
    return s3 || s4;
  };

  const renderS4S5SideBySideOrS5 = () => {
    const hasS5 = visibleKeys.has('S5');
    if (!hasS5) return '';
    const hasS4 = visibleKeys.has('S4');

    const s5Bucket = getBucket('S5');
    const s5Note = s5Bucket ? noteForBucket(meta, s5Bucket) : '';
    const s5Date = s5Bucket ? dateForBucket(meta, s5Bucket, captured) : captured;
    const sig5 = sigByKey.S5 || null;
    const role5 = stageRoleLabel(meta, 's5');

    const renderS5Box = (sigStyle) => renderStageBox({
      roleLabel: role5,
      noteText: s5Note,
      dateText: formatKhmerDateTime(s5Date),
      signatureDataUri: sig5?.dataUri || null,
      signatureStyle: sigStyle,
      senderName: sig5?.name || '',
      outerPaddingPx: 1,
      outerMarginTopPx: 5,
      innerPaddingPx: 1,
      showDateAndSignature: true,
    });

    if (hasS4) {
      const s4Bucket = getBucket('S4');
      const s4Note = s4Bucket ? noteForBucket(meta, s4Bucket) : '';
      const s4Date = s4Bucket ? dateForBucket(meta, s4Bucket, captured) : captured;
      const sig4 = sigByKey.S4 || null;
      const role4 = stageRoleLabel(meta, 's4');

      const s4Box = renderStageBox({
        roleLabel: role4,
        noteText: s4Note,
        dateText: formatKhmerDateTime(s4Date),
        signatureDataUri: sig4?.dataUri || null,
        signatureStyle: 'max-width:100px; max-height:80px; object-fit:contain; display:block; margin:0 auto;',
        senderName: sig4?.name || '',
        outerPaddingPx: 5,
        outerMarginTopPx: 0,
        innerPaddingPx: 1,
        showDateAndSignature: true,
      });

      const s5Box = renderStageBox({
        roleLabel: role5,
        noteText: s5Note,
        dateText: formatKhmerDateTime(s5Date),
        signatureDataUri: sig5?.dataUri || null,
        signatureStyle: 'max-width:100px; max-height:70px; object-fit:contain; display:block; margin:0 auto;',
        senderName: sig5?.name || '',
        outerPaddingPx: 5,
        outerMarginTopPx: 0,
        innerPaddingPx: 1,
        showDateAndSignature: true,
      });

      return `<div style="margin-top:5px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">${s4Box}${s5Box}</div>`;
    }

    // Full-width director
    return renderS5Box('max-width:50px; max-height:50px; object-fit:contain; display:block; margin:0 auto;');
  };

  const renderS6 = () => {
    if (!visibleKeys.has('S6')) return '';
    const b = getBucket('S6');
    const note = b ? noteForBucket(meta, b) : '';
    const d = b ? dateForBucket(meta, b, captured) : captured;
    const sig = sigByKey.S6 || null;
    const role = stageRoleLabel(meta, 's6');
    return renderStageBox({
      roleLabel: role,
      noteText: note,
      noteTextAlign: 'center',
      dateText: formatKhmerDateTime(d),
      signatureDataUri: sig?.dataUri || null,
      signatureStyle: 'max-width:160px; max-height:90px; object-fit:contain; display:block; margin:0 auto;',
      senderName: sig?.name || '',
      outerPaddingPx: 1,
      outerMarginTopPx: 5,
      innerPaddingPx: 1,
      showDateAndSignature: true,
    });
  };

  // Match the ReplayfilePage header layout closely
  const html = `<!doctype html>
<html lang="km">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>REPORT</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif;
      color: #000;
      font-size: ${safeNum(fontSize, 15, { min: 8, max: 36 })}px;
      line-height: ${safeNum(lineHeight, 1.8, { min: 0.8, max: 3.5 })};
      background: #9dadbb;
    }
    .sheet {
      width: 210mm;
      min-width: 210mm;
      height: 297mm;
      min-height: 297mm;
      box-sizing: border-box;
      background: #9dadbb;
      display: flex;
      flex-direction: column;
    }
    .page {
      padding: 10mm;
      padding-top: ${safeNum(paddingTopMm, 5, { min: 0, max: 40 })}mm;
      box-sizing: border-box;
      flex: 1;
      height: 100%;
      overflow: hidden;
      background: #9dadbb;
    }
    .sheet .page, .sheet .page * { font-size: inherit; line-height: inherit; }
    .field { margin-top: ${safeNum(paraBeforePx, 1, { min: 0, max: 40 })}px; margin-bottom: ${safeNum(paraAfterPx, 1, { min: 0, max: 40 })}px; display:flex; align-items:flex-start; gap: 0; }
    .label { width: 140px; min-width: 140px; font-family:'Khmer OS Muol Light','Khmer OS',Arial,sans-serif; font-size: 15px; }
    .value { flex:1; }
    .value-plain { flex:1; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
    .role-label { font-size: 12px; }
    .sender-name { font-size: 12px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="page">
      <div style="text-align:center; font-weight:300; margin-bottom: 2mm; font-family:'Khmer OS Muol Light','Khmer OS',Arial,sans-serif; font-size: 18px;">ព្រះរាជាណាចក្រកម្ពុជា</div>
      <div style="text-align:center; font-weight:300; margin-bottom: 0.5mm; font-family:'Khmer OS Muol Light','Khmer OS',Arial,sans-serif; font-size: 14px;">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>

      <div style="position:relative; text-align:center; margin: 0mm 0 0mm; height: 0mm;">
        ${logoData ? `<img src="${logoData}" alt="" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:100px; height:auto; opacity:0.98;" />` : ''}
      </div>
      <div style="text-align:left; padding: 0mm 0; font-family:'Khmer OS Muol Light','Khmer OS',Arial,sans-serif; font-size: 16px;">ក្រសួងសុខាភិបាល</div>
      <div style="text-align:left; padding: 1mm 0; font-family:'Khmer OS Muol Light','Khmer OS',Arial,sans-serif; font-size: 15px;">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
      <div style="text-align:center; font-family:'Khmer OS Muol Light','Khmer OS',Arial,sans-serif; font-size: 15px; margin-top: 0;">កំណត់បង្ហាញ</div>

      <div class="field" style="margin-top: 0mm;">
        <span class="label">លេខលិខិតចូល:</span>
        <span class="value">
          <div style="display:flex; align-items:center; gap: 12px;">
            <div style="line-height:1;">${escapeHtml(entryNo ? toKhmerDigits(entryNo) : '')} ម.ម.ខ.ស</div>
            <div style="font-size: 14px;">ចុះ ${escapeHtml(formatKhmerDateTime(entryDate))}</div>
          </div>
        </span>
      </div>

      <div class="field" style="margin-top: 0mm;">
        <span class="label">លិខិតលេខ:</span>
        <span class="value">
          <div style="display:flex; align-items:center; gap: 8px;">
            <div>${escapeHtml(letterNo ? toKhmerDigits(letterNo) : '')}</div>
            <div style="font-size: 12px;">ចុះ ${escapeHtml(formatKhmerDate(letterDate))}</div>
          </div>
        </span>
      </div>

      <div class="field">
        <span class="label">មកពី:</span>
        <span class="value">${escapeHtml(source || '')}</span>
      </div>

      <div class="field">
        <span class="label">កម្មវត្ថុ:</span>
        <span class="value-plain">${escapeHtml(content || '')}</span>
      </div>

      <div class="field">
        <span class="label">បញ្ចូលលិខិតដោយ:</span>
        <span class="value">${escapeHtml(creatorName || '')}</span>
      </div>

      ${renderS()}
      ${renderS1()}
      ${renderS2()}
      ${renderDeputyStack()}
      ${renderS4S5SideBySideOrS5()}
      ${renderS6()}

    </div>
  </div>
</body>
</html>`;

  return html;
}
