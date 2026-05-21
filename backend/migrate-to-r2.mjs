/**
 * migrate-to-r2.mjs
 * Uploads all files from public/Uploads/ to Cloudflare R2 bucket.
 * - Skips files that already exist in R2 (safe to re-run).
 * - Reports progress and final summary.
 * Run: node migrate-to-r2.mjs
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const R2_ACCOUNT_ID        = '90cad32ffe1937b559f87a394310eda6';
const R2_ACCESS_KEY_ID     = '9783719bc00ae8b9ccf0e40d90051ec0';
const R2_SECRET_ACCESS_KEY = 'c000ea20cd47b20e54e7846c4ac6b4b2443c1f662c412a0868a09bc1aa83afcd';
const R2_BUCKET_NAME       = 'hrms-media';
const R2_PUBLIC_URL        = 'https://media.choylong.net';

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'Uploads');
const CONCURRENCY = 5; // Upload 5 files at a time

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif',  '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain', '.csv': 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}

async function fileExistsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(filePath, key) {
  const buffer   = fs.readFileSync(filePath);
  const mimetype = getMimeType(key);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

async function runInBatches(items, concurrency, fn) {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(fn));
  }
}

async function migrate() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`❌ Uploads folder not found: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(UPLOADS_DIR).filter(f => {
    const stat = fs.statSync(path.join(UPLOADS_DIR, f));
    return stat.isFile();
  });

  const total   = files.length;
  let uploaded  = 0;
  let skipped   = 0;
  let failed    = 0;
  let totalBytes = 0;

  console.log(`\n🚀 Starting R2 migration`);
  console.log(`   Bucket : ${R2_BUCKET_NAME}`);
  console.log(`   Files  : ${total}`);
  console.log(`   Source : ${UPLOADS_DIR}\n`);

  const startTime = Date.now();

  await runInBatches(files, CONCURRENCY, async (filename) => {
    const filePath = path.join(UPLOADS_DIR, filename);
    const fileSize = fs.statSync(filePath).size;

    try {
      const exists = await fileExistsInR2(filename);
      if (exists) {
        skipped++;
        process.stdout.write(`\r⏩ ${uploaded + skipped + failed}/${total} | ✅ ${uploaded} uploaded | ⏩ ${skipped} skipped | ❌ ${failed} failed`);
        return;
      }

      await uploadFile(filePath, filename);
      uploaded++;
      totalBytes += fileSize;
      process.stdout.write(`\r⬆️  ${uploaded + skipped + failed}/${total} | ✅ ${uploaded} uploaded | ⏩ ${skipped} skipped | ❌ ${failed} failed`);
    } catch (err) {
      failed++;
      console.error(`\n❌ Failed: ${filename} — ${err.message}`);
    }
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const sizeMB  = (totalBytes / 1024 / 1024).toFixed(1);

  console.log(`\n\n✅ Migration Complete!`);
  console.log(`   Uploaded : ${uploaded} files (${sizeMB} MB)`);
  console.log(`   Skipped  : ${skipped} files (already in R2)`);
  console.log(`   Failed   : ${failed} files`);
  console.log(`   Time     : ${elapsed}s`);
  console.log(`\n🌐 Files accessible at: ${R2_PUBLIC_URL}/{filename}`);

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} files failed. Re-run the script to retry.`);
    process.exit(1);
  }
}

migrate().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
