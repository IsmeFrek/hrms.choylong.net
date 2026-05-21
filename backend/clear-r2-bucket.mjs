/**
 * clear-r2-bucket.mjs
 * Deletes ALL objects from the hrms-media R2 bucket (clean slate).
 * Run: node clear-r2-bucket.mjs
 */
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID        = '90cad32ffe1937b559f87a394310eda6';
const R2_ACCESS_KEY_ID     = '9783719bc00ae8b9ccf0e40d90051ec0';
const R2_SECRET_ACCESS_KEY = 'c000ea20cd47b20e54e7846c4ac6b4b2443c1f662c412a0868a09bc1aa83afcd';
const R2_BUCKET_NAME       = 'hrms-media';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function clearBucket() {
  console.log(`\n🗑️  Starting R2 bucket wipe: ${R2_BUCKET_NAME}`);
  console.log('This will delete ALL objects. Starting in 3 seconds...\n');
  await new Promise(r => setTimeout(r, 3000));

  let totalDeleted = 0;
  let continuationToken = undefined;

  while (true) {
    // List a batch of objects (max 1000 per request)
    const listCmd = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });

    const listRes = await r2.send(listCmd);
    const objects = listRes.Contents || [];

    if (objects.length === 0) {
      console.log('No more objects found.');
      break;
    }

    // Delete this batch
    const deleteCmd = new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: {
        Objects: objects.map(o => ({ Key: o.Key })),
        Quiet: true,
      },
    });

    await r2.send(deleteCmd);
    totalDeleted += objects.length;
    process.stdout.write(`\r🗑️  Deleted ${totalDeleted} objects...`);

    // Check if there are more pages
    if (!listRes.IsTruncated) break;
    continuationToken = listRes.NextContinuationToken;
  }

  console.log(`\n\n✅ Done! Deleted ${totalDeleted} objects from ${R2_BUCKET_NAME}`);
}

clearBucket().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
