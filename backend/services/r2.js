/**
 * Cloudflare R2 Service
 * Central module for all file uploads — uses S3-compatible API.
 * All routes import `uploadToR2` from here instead of writing to local disk.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const R2_ACCOUNT_ID     = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID  = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME    = process.env.R2_BUCKET_NAME || 'hrms-media';
const R2_PUBLIC_URL     = (process.env.R2_PUBLIC_URL || 'https://media.choylong.net').replace(/\/$/, '');

// Warn once on startup if R2 is not configured
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn('[R2] ⚠️  R2 credentials not set — file uploads will fail. Check backend/.env');
}

// Create S3-compatible client pointed at Cloudflare R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Upload a file buffer to R2 and return the public URL.
 *
 * @param {Buffer} buffer       - File content in memory
 * @param {string} filename     - Target filename in the bucket (e.g. "D0001.jpg")
 * @param {string} mimetype     - MIME type (e.g. "image/jpeg")
 * @returns {Promise<string>}   - Full public URL: https://media.choylong.net/filename
 */
export async function uploadToR2(buffer, filename, mimetype) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: mimetype,
  });

  await r2Client.send(command);
  return `${R2_PUBLIC_URL}/${filename}`;
}

/**
 * Delete a file from R2 by its filename (key).
 * Safe to call — silently ignores errors (file may not exist).
 *
 * @param {string} filename - Filename / key in the bucket
 */
export async function deleteFromR2(filename) {
  if (!filename) return;
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
    }));
  } catch (err) {
    console.warn(`[R2] Could not delete "${filename}":`, err.message);
  }
}

/**
 * Extract the R2 filename (key) from a full URL or a legacy /Uploads/ path.
 * Returns null if it cannot extract a key.
 *
 * Examples:
 *   "https://media.choylong.net/D0001.jpg"  → "D0001.jpg"
 *   "/Uploads/D0001.jpg"                    → "D0001.jpg"
 *   "D0001.jpg"                             → "D0001.jpg"
 */
export function extractR2Key(urlOrPath) {
  if (!urlOrPath) return null;
  // Full R2 URL
  if (urlOrPath.startsWith(R2_PUBLIC_URL)) {
    return urlOrPath.slice(R2_PUBLIC_URL.length + 1);
  }
  // Legacy /Uploads/ path
  if (urlOrPath.startsWith('/Uploads/')) {
    return urlOrPath.slice('/Uploads/'.length);
  }
  // Raw filename
  return urlOrPath;
}

/**
 * Sanitize a filename for safe use as an R2 key.
 * Removes path traversal, trims length, collapses special chars.
 */
export function sanitizeFilename(originalname) {
  let safe = originalname
    .replace(/[^\p{L}\p{N}\-_.]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return safe.slice(0, 120) || 'file';
}

export const R2_PUBLIC_BASE = R2_PUBLIC_URL;
