import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import * as AWS from 'aws-sdk';
import sharp = require('sharp');

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export function imageType(bytes: Buffer): string | undefined {
  if (
    bytes.length >= 12 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
}

@Injectable()
export class S3BucketService implements OnModuleInit {
  private get developmentModerationBypass(): boolean {
    const mode = process.env.PHOTO_MODERATION_MODE || 'rekognition';
    if (mode === 'rekognition') return false;
    if (
      mode === 'development-bypass' &&
      ['development', 'test'].includes(process.env.NODE_ENV || '')
    )
      return true;
    throw new ServiceUnavailableException(
      'PHOTO_MODERATION_MODE must be rekognition outside development/test',
    );
  }
  onModuleInit() {
    if (this.developmentModerationBypass)
      Logger.warn(
        'Development photo mode: content moderation is disabled',
        S3BucketService.name,
      );
  }
  private get options(): AWS.S3.ClientConfiguration {
    const accessKeyId =
      process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.AWS_SECRET || process.env.AWS_SECRET_ACCESS_KEY;
    if (!!accessKeyId !== !!secretAccessKey)
      throw new Error(
        'Both AWS credential variables are required when using static credentials',
      );
    return {
      region: process.env.AWS_S3_REGION || process.env.AWS_REGION,
      signatureVersion: 'v4',
      httpOptions: { connectTimeout: 5000, timeout: 30000 },
      maxRetries: 2,
      ...(accessKeyId
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
              sessionToken: process.env.AWS_SESSION_TOKEN,
            },
          }
        : {}),
    };
  }
  private client?: AWS.S3;
  private configuration?: { until: number; check: Promise<void> };
  get s3() {
    return (this.client ||= new AWS.S3(this.options));
  }
  set s3(client: AWS.S3) {
    this.client = client;
  }
  get bucket(): string {
    const value = process.env.AWS_DEFAULT_S3_BUCKET;
    if (!value || !(process.env.AWS_S3_REGION || process.env.AWS_REGION)) {
      throw new ServiceUnavailableException('Photo storage is not configured');
    }
    return value;
  }
  async uploadFile(_file: unknown, _folder: string): Promise<any> {
    throw new BadRequestException(
      'Upload images through /photos/upload-url and /photos/confirm',
    );
  }
  async uploadPrivateFile(
    _file: Express.Multer.File,
    _key: string,
  ): Promise<any> {
    throw new BadRequestException(
      'Upload images through /photos/upload-url and /photos/confirm',
    );
  }
  async presign(key: string, contentType: string, seconds = 300) {
    await this.ensurePrivate();
    return new Promise<AWS.S3.PresignedPost>((resolve, reject) =>
      this.s3.createPresignedPost(
        {
          Bucket: this.bucket,
          Expires: Math.max(1, Math.min(300, seconds)),
          Fields: {
            key,
            'Content-Type': contentType,
            success_action_status: '204',
          },
          Conditions: [
            ['eq', '$key', key],
            ['eq', '$Content-Type', contentType],
            ['eq', '$success_action_status', '204'],
            ['content-length-range', 1, PHOTO_MAX_BYTES],
          ],
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      ),
    );
  }
  async readVerified(key: string, expectedType: string) {
    const head = await this.s3
      .headObject({ Bucket: this.bucket, Key: key })
      .promise();
    if (
      !head.ContentLength ||
      head.ContentLength > PHOTO_MAX_BYTES ||
      head.ContentType !== expectedType ||
      !head.ETag
    ) {
      throw new BadRequestException('Invalid image size or type');
    }
    const stream = this.s3
      .getObject({ Bucket: this.bucket, Key: key, IfMatch: head.ETag })
      .createReadStream();
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const part of stream) {
      const chunk = Buffer.from(part);
      length += chunk.length;
      if (length > PHOTO_MAX_BYTES) {
        stream.destroy();
        throw new BadRequestException('Image exceeds 5MB');
      }
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    if (
      bytes.length !== head.ContentLength ||
      imageType(bytes) !== expectedType
    ) {
      throw new UnsupportedMediaTypeException(
        'Image content does not match its declared type',
      );
    }
    return bytes;
  }
  async sanitizeAndModerate(bytes: Buffer) {
    const bypassModeration = this.developmentModerationBypass;
    if (!imageType(bytes))
      throw new UnsupportedMediaTypeException(
        'Only JPEG and WebP images are supported',
      );
    let clean: Buffer;
    try {
      const decoder = sharp(bytes, {
        limitInputPixels: 40_000_000,
        failOn: 'warning',
      });
      const metadata = await decoder.metadata();
      if ((metadata.pages || 1) > 1) throw new Error('Animated image');
      // Re-encode pixels without withMetadata/keepMetadata, removing EXIF/GPS.
      clean = await decoder
        .rotate()
        .resize({
          width: 1080,
          height: 1920,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      if (clean.length > PHOTO_MAX_BYTES)
        throw new Error('Processed image is too large');
    } catch {
      throw new UnsupportedMediaTypeException(
        'Image could not be decoded safely',
      );
    }
    if (bypassModeration) return clean;
    try {
      const result = await this.moderationResult(clean);
      if (
        !result.ModerationModelVersion ||
        !Array.isArray(result.ModerationLabels)
      )
        throw new Error('Incomplete moderation result');
      if (result.ModerationLabels.length)
        throw new UnsupportedMediaTypeException(
          'Image did not pass moderation',
        );
    } catch (error) {
      if (error instanceof UnsupportedMediaTypeException) throw error;
      throw new ServiceUnavailableException(
        'Image moderation is temporarily unavailable',
      );
    }
    return clean;
  }
  protected moderationResult(
    clean: Buffer,
  ): Promise<AWS.Rekognition.DetectModerationLabelsResponse> {
    const scanner = new AWS.Rekognition({
      ...this.options,
      region: process.env.AWS_REKOGNITION_REGION || this.options.region,
    });
    return scanner
      .detectModerationLabels({ Image: { Bytes: clean }, MinConfidence: 60 })
      .promise();
  }
  async putApproved(key: string, bytes: Buffer) {
    return this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: 'image/jpeg',
        ContentDisposition: 'inline',
        ServerSideEncryption: 'AES256',
        CacheControl: 'private, max-age=120',
      })
      .promise();
  }
  async getSignedURL(Key: string, Bucket?: string, expiresInSeconds = 120) {
    if (!Key) return null;
    this.assertBucket(Bucket);
    await this.ensurePrivate();
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key,
      Expires: Math.max(30, Math.min(300, Number(expiresInSeconds) || 120)),
    });
  }
  async deleteOne(Key: string, Bucket?: string) {
    if (!Key || Key.startsWith('/') || Key.includes('://'))
      throw new BadRequestException('Invalid storage key');
    this.assertBucket(Bucket);
    let KeyMarker: string;
    let VersionIdMarker: string;
    do {
      const page = await this.s3
        .listObjectVersions({
          Bucket: this.bucket,
          Prefix: Key,
          KeyMarker,
          VersionIdMarker,
        })
        .promise();
      const objects = [...(page.Versions || []), ...(page.DeleteMarkers || [])]
        .filter((item) => item.Key === Key)
        .map((item) => ({ Key, VersionId: item.VersionId }));
      if (objects.length) {
        const result = await this.s3
          .deleteObjects({ Bucket: this.bucket, Delete: { Objects: objects } })
          .promise();
        if (result.Errors?.length)
          throw new ServiceUnavailableException(
            'Photo deletion will be retried',
          );
      }
      KeyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
      VersionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
    } while (KeyMarker);
    return this.s3.deleteObject({ Bucket: this.bucket, Key }).promise();
  }
  async keysUnder(prefix: string) {
    const keys: string[] = [];
    let ContinuationToken: string;
    do {
      const page = await this.s3
        .listObjectsV2({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken,
        })
        .promise();
      keys.push(...(page.Contents || []).map((item) => item.Key));
      ContinuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (ContinuationToken);
    return keys;
  }
  keyFromReference(value?: string): string | undefined {
    if (!value) return undefined;
    if (
      /^(users|temp|posts|avatars|groupIcon|events|chat-media)\//.test(value) &&
      !value.includes('://')
    )
      return value;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password)
        return undefined;
      const bucket = this.bucket;
      if (
        url.hostname === `${bucket}.s3.amazonaws.com` ||
        url.hostname === `${bucket}.s3.${this.options.region}.amazonaws.com`
      ) {
        return decodeURIComponent(url.pathname.slice(1));
      }
    } catch {
      /* Foreign or invalid URLs are not storage keys. */
    }
    return undefined;
  }
  private assertBucket(bucket?: string) {
    if (bucket && bucket !== this.bucket)
      throw new BadRequestException('Invalid storage bucket');
  }
  async ensurePrivate(): Promise<void> {
    // Temporary operator override; object validation and moderation still run.
    if (process.env.PHOTO_VERIFY_BUCKET_SETTINGS === 'false') return;
    if (!this.configuration || this.configuration.until < Date.now()) {
      this.configuration = {
        until: Date.now() + 60000,
        check: this.verifyConfiguration(),
      };
    }
    try {
      await this.configuration.check;
    } catch {
      this.configuration = undefined;
      throw new ServiceUnavailableException(
        'Private photo storage settings could not be verified',
      );
    }
  }
  private async verifyConfiguration() {
    const Bucket = this.bucket;
    const [access, ownership, encryption, lifecycle, cors] = await Promise.all([
      this.s3.getPublicAccessBlock({ Bucket }).promise(),
      this.s3.getBucketOwnershipControls({ Bucket }).promise(),
      this.s3.getBucketEncryption({ Bucket }).promise(),
      this.s3.getBucketLifecycleConfiguration({ Bucket }).promise(),
      this.s3
        .getBucketCors({ Bucket })
        .promise()
        .catch((error) => {
          if (error.code === 'NoSuchCORSConfiguration')
            return { CORSRules: [] };
          throw error;
        }),
    ]);
    if (
      ![
        'BlockPublicAcls',
        'IgnorePublicAcls',
        'BlockPublicPolicy',
        'RestrictPublicBuckets',
      ].every((flag) => access.PublicAccessBlockConfiguration?.[flag] === true)
    )
      throw new Error('Public access is not blocked');
    if (
      !ownership.OwnershipControls?.Rules?.some(
        (rule) => rule.ObjectOwnership === 'BucketOwnerEnforced',
      )
    )
      throw new Error('ACLs must be disabled');
    if (
      !encryption.ServerSideEncryptionConfiguration?.Rules?.some((rule) =>
        ['AES256', 'aws:kms'].includes(
          rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm,
        ),
      )
    )
      throw new Error('Encryption is required');
    const rules = lifecycle.Rules || [];
    const prefix = (rule: AWS.S3.LifecycleRule) =>
      rule.Prefix ?? (rule.Filter as any)?.Prefix;
    if (
      !rules.some(
        (rule) =>
          rule.Status === 'Enabled' &&
          prefix(rule) === 'temp/' &&
          rule.Expiration?.Days === 1,
      )
    )
      throw new Error('Temporary image expiry is required');
    if (
      !rules.some(
        (rule) =>
          rule.Status === 'Enabled' &&
          !prefix(rule) &&
          rule.AbortIncompleteMultipartUpload?.DaysAfterInitiation === 1,
      )
    )
      throw new Error('Incomplete upload expiry is required');
    const origins = (process.env.PHOTO_WEB_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      cors.CORSRules?.some((rule) =>
        rule.AllowedOrigins.some(
          (origin) => !origins.includes(origin) || origin.includes('*'),
        ),
      )
    )
      throw new Error('Unexpected browser CORS origin');
  }
}
