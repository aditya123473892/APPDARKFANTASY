// Read-only audit. Never prints credentials, object keys, signed URLs or image content.
const path = require('node:path');
const { createRequire } = require('node:module');
const backend = path.resolve(__dirname, '../dfbackend');
const backendRequire = createRequire(path.join(backend, 'package.json'));
backendRequire('dotenv').config({ path: path.join(backend, '.env'), quiet: true });
backendRequire('dotenv').config({
  path: path.join(backend, `.env.${process.env.NODE_ENV || 'development'}`),
  override: true,
  quiet: true,
});
const { S3 } = backendRequire('@aws-sdk/client-s3');
const sharp = backendRequire('sharp');
const Bucket = process.env.AWS_DEFAULT_S3_BUCKET;
const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET || process.env.AWS_SECRET_ACCESS_KEY;
const s3 = new S3({
  region,
  requestHandler: { connectionTimeout: 5000, requestTimeout: 20000 },
  maxAttempts: 2,
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey, sessionToken: process.env.AWS_SESSION_TOKEN } }
    : {}),
});
function group(key) {
  if (/^temp\/diagnostics\//.test(key)) return 'diagnostics';
  if (/^temp\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|webp)$/.test(key)) return 'temporary';
  if (/^users\/[a-f0-9]{24}\/photos\/[a-f0-9-]{36}\.jpg$/.test(key)) return 'approved_photos';
  if (/^users\/[a-f0-9]{24}\/vault\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/.test(key))
    return 'approved_vault';
  return 'legacy_or_other';
}
async function audit() {
  console.log('runtimeSettings', JSON.stringify({ mode: process.env.NODE_ENV || '(default)', moderation: process.env.PHOTO_MODERATION_MODE || 'rekognition', verifyBucketSettings: process.env.PHOTO_VERIFY_BUCKET_SETTINGS !== 'false' }));
  if (!Bucket || !region) throw Object.assign(Error(), { code: 'StorageNotConfigured' });
  for (const [name, method] of [
    ['publicAccess', 'getPublicAccessBlock'],
    ['encryption', 'getBucketEncryption'],
    ['lifecycle', 'getBucketLifecycleConfiguration'],
  ]) {
    try {
      const value = await s3[method]({ Bucket });
      console.log(
        name,
        JSON.stringify(
          name === 'publicAccess'
            ? value.PublicAccessBlockConfiguration
            : name === 'encryption'
              ? value.ServerSideEncryptionConfiguration.Rules.map(
                  (r) => r.ApplyServerSideEncryptionByDefault.SSEAlgorithm,
                )
              : value.Rules.map((r) => ({
                  status: r.Status,
                  prefix: r.Prefix ?? r.Filter?.Prefix ?? '(complex filter)',
                  expirationDays: r.Expiration?.Days,
                })),
        ),
      );
    } catch (error) {
      console.log(name, 'unavailable:', error.code || error.name);
    }
  }
  const totals = {},
    samples = {};
  let token,
    scanned = 0;
  do {
    const page = await s3
      .listObjectsV2({ Bucket, ContinuationToken: token, MaxKeys: 1000 });
    for (const item of page.Contents || []) {
      const category = group(item.Key);
      const total = (totals[category] ||= { objects: 0, bytes: 0 });
      total.objects++;
      total.bytes += item.Size;
      scanned++;
      if (
        category.startsWith('approved_') &&
        item.Size <= 5 * 1024 * 1024 &&
        (!samples[category] || samples[category].LastModified < item.LastModified)
      )
        samples[category] = item;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token && scanned < 10000);
  console.log('objectCounts', JSON.stringify(totals), 'truncated', Boolean(token));
  for (const [category, item] of Object.entries(samples)) {
    const result = await s3.getObject({ Bucket, Key: item.Key });
    const meta = await sharp(Buffer.from(await result.Body.transformToByteArray())).metadata();
    console.log(
      'latestSample',
      JSON.stringify({
        category,
        bytes: item.Size,
        format: meta.format,
        width: meta.width,
        height: meta.height,
        exif: Boolean(meta.exif),
        contentType: result.ContentType,
        serverEncryption: result.ServerSideEncryption,
      }),
    );
  }
  if (!process.env.DATABASE_URL) return;
  const mongoose = backendRequire('mongoose');
  const conn = await mongoose
    .createConnection(process.env.DATABASE_URL, {
      dbName: process.env.DATABASE_NAME,
      serverSelectionTimeoutMS: 8000,
    })
    .asPromise();
  try {
    for (const collection of ['PhotoUploads', 'VaultPhotos', 'VaultTombstones']) {
      console.log(
        'databaseStates',
        collection,
        JSON.stringify(
          await conn.db
            .collection(collection)
            .aggregate([{ $group: { _id: '$state', count: { $sum: 1 } } }])
            .toArray(),
        ),
      );
    }
  } finally {
    await conn.close();
  }
}
audit().catch((error) => {
  console.error('Read-only storage audit failed:', error.code || error.name);
  process.exitCode = 1;
});
