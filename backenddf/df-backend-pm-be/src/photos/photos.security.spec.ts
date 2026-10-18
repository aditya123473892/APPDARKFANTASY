import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  ValidationPipe,
} from '@nestjs/common';
import { PhotosService } from './photos.service';
import {
  S3BucketService,
  PHOTO_MAX_BYTES,
} from '../s3-bucket/s3-bucket.service';
import { PostsController } from '../posts/posts.controller';
import { SelfProfileDto } from '../users/dtos/self-profile.dto';
import { PhotoPostDto } from '../posts/dto/photo-post.dto';
import { Readable } from 'stream';
import sharp = require('sharp');

describe('Photo security boundaries', () => {
  it('skips AWS moderation only in explicit development mode while still sanitizing', async () => {
    const previousMode = process.env.PHOTO_MODERATION_MODE;
    const previousEnvironment = process.env.NODE_ENV;
    process.env.PHOTO_MODERATION_MODE = 'development-bypass';
    process.env.NODE_ENV = 'development';
    try {
      const storage = new S3BucketService();
      const scan = jest.spyOn(storage as any, 'moderationResult');
      const input = await sharp({
        create: { width: 1200, height: 800, channels: 3, background: 'blue' },
      })
        .withMetadata()
        .jpeg()
        .toBuffer();
      const clean = await storage.sanitizeAndModerate(input);
      const metadata = await sharp(clean).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.exif).toBeUndefined();
      expect(scan).not.toHaveBeenCalled();
      await expect(
        storage.sanitizeAndModerate(Buffer.from('not an image')),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      for (const environment of ['production', 'staging', '']) {
        process.env.NODE_ENV = environment;
        expect(() => storage.onModuleInit()).toThrow(ServiceUnavailableException);
        await expect(storage.sanitizeAndModerate(input)).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
      }
    } finally {
      restoreEnv('PHOTO_MODERATION_MODE', previousMode);
      restoreEnv('NODE_ENV', previousEnvironment);
    }
  });

  it('allows the explicit temporary bucket-check override without configuration reads', async () => {
    const previous = process.env.PHOTO_VERIFY_BUCKET_SETTINGS;
    process.env.PHOTO_VERIFY_BUCKET_SETTINGS = 'false';
    try {
      const storage = new S3BucketService();
      const check = jest.spyOn(storage as any, 'verifyConfiguration');
      await expect(storage.ensurePrivate()).resolves.toBeUndefined();
      expect(check).not.toHaveBeenCalled();
    } finally {
      restoreEnv('PHOTO_VERIFY_BUCKET_SETTINGS', previous);
    }
  });

  it('refuses to sign uploads when bucket privacy cannot be established', async () => {
    const storage = new S3BucketService();
    jest.spyOn(storage, 'bucket', 'get').mockReturnValue('test-photo-bucket');
    const result = (value: any) => () => ({ promise: async () => value });
    const createPresignedPost = jest.fn();
    storage.s3 = {
      getPublicAccessBlock: result({
        PublicAccessBlockConfiguration: { BlockPublicAcls: false },
      }),
      getBucketOwnershipControls: result({
        OwnershipControls: {
          Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }],
        },
      }),
      getBucketEncryption: result({
        ServerSideEncryptionConfiguration: {
          Rules: [
            { ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
          ],
        },
      }),
      getBucketLifecycleConfiguration: result({ Rules: [] }),
      getBucketCors: result({ CORSRules: [] }),
      createPresignedPost,
    } as any;
    await expect(
      storage.presign('temp/owner/photo.jpg', 'image/jpeg'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('does not queue or delete any S3 object when a caller does not own the post', async () => {
    const posts: any = {
      findByIdPrivate: jest.fn().mockResolvedValue(null),
      removePrivate: jest.fn(),
    };
    const photos: any = { enqueue: jest.fn(), release: jest.fn() };
    const storage: any = { deleteOne: jest.fn() };
    const controller = new PostsController(posts, photos, storage);
    await expect(
      controller.remove('507f1f77bcf86cd799439011', {
        id: '507f1f77bcf86cd799439012',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(photos.enqueue).not.toHaveBeenCalled();
    expect(storage.deleteOne).not.toHaveBeenCalled();
    expect(posts.removePrivate).not.toHaveBeenCalled();
  });

  it('preserves photo references during a text-only edit', async () => {
    const media = [{ filename: 'users/owner/photos/photo.jpg' }];
    const posts: any = {
      findByIdPrivate: jest.fn().mockResolvedValue({ media, __v: 3 }),
      updateOnePrivate: jest.fn().mockResolvedValue({ media }),
    };
    const photos: any = {
      bind: jest.fn(),
      retire: jest.fn(),
      enqueue: jest.fn(),
    };
    const controller = new PostsController(posts, photos, {} as any);
    await controller.update('507f1f77bcf86cd799439011', { caption: 'Edited' }, {
      id: 'owner',
    } as any);
    expect(posts.updateOnePrivate).toHaveBeenCalledWith(
      expect.any(String),
      { caption: 'Edited', media },
      { id: 'owner' },
      3,
    );
    expect(photos.retire).not.toHaveBeenCalled();
    expect(photos.enqueue).not.toHaveBeenCalled();
  });

  it('rejects client-written privilege, approval, key and path fields', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        {
          displayname: 'Name',
          roles: ['root'],
          avatar: 'users/victim/photos/a.jpg',
        },
        {
          type: 'body',
          metatype: SelfProfileDto,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        {
          clientId: 'request-123',
          photoIds: ['ed6942a6-b784-4d9d-8d44-97734ae67791'],
          status: 'approved',
          user: 'victim',
          key: 'arbitrary',
        },
        { type: 'body', metatype: PhotoPostDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signs a POST with exact type/key, 5MB range and <=300-second expiry', async () => {
    const storage = new S3BucketService();
    const old = {
      bucket: process.env.AWS_DEFAULT_S3_BUCKET,
      region: process.env.AWS_S3_REGION,
    };
    jest.spyOn(storage, 'ensurePrivate').mockResolvedValue(undefined);
    process.env.AWS_DEFAULT_S3_BUCKET = 'test-photo-bucket';
    process.env.AWS_S3_REGION = 'ap-south-1';
    const createPresignedPost = jest.fn((options, callback) =>
      callback(null, {
        url: 'https://test-photo-bucket.s3.amazonaws.com',
        fields: options.Fields,
      }),
    );
    storage.s3 = { createPresignedPost } as any;
    await storage.presign('temp/owner/server-uuid.jpg', 'image/jpeg', 999);
    expect(createPresignedPost.mock.calls[0][0]).toMatchObject({
      Expires: 300,
      Conditions: [
        ['eq', '$key', 'temp/owner/server-uuid.jpg'],
        ['eq', '$Content-Type', 'image/jpeg'],
        ['eq', '$success_action_status', '204'],
        ['content-length-range', 1, PHOTO_MAX_BYTES],
      ],
    });
    restoreEnv('AWS_DEFAULT_S3_BUCKET', old.bucket);
    restoreEnv('AWS_S3_REGION', old.region);
  });

  it('checks HEAD, constrains GET to the same ETag and rejects fake JPEG bytes', async () => {
    const storage = new S3BucketService();
    jest.spyOn(storage, 'bucket', 'get').mockReturnValue('test-photo-bucket');
    const getObject = jest.fn(() => ({
      createReadStream: () => Readable.from([Buffer.alloc(12)]),
    }));
    storage.s3 = {
      headObject: () => ({
        promise: async () => ({
          ContentLength: 12,
          ContentType: 'image/jpeg',
          ETag: 'immutable-etag',
        }),
      }),
      getObject,
    } as any;
    await expect(
      storage.readVerified('temp/owner/photo.jpg', 'image/jpeg'),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(getObject).toHaveBeenCalledWith({
      Bucket: 'test-photo-bucket',
      Key: 'temp/owner/photo.jpg',
      IfMatch: 'immutable-etag',
    });
  });

  it('strips metadata, limits dimensions and calls moderation on the sanitized pixels', async () => {
    const storage = new S3BucketService();
    const scan = jest
      .spyOn(storage as any, 'moderationResult')
      .mockResolvedValue({
        ModerationModelVersion: 'test',
        ModerationLabels: [],
      });
    const input = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: '#ff8800' },
    })
      .withMetadata({ exif: { IFD0: { Artist: 'Private metadata' } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const clean = await storage.sanitizeAndModerate(input);
    const metadata = await sharp(clean).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.exif).toBeUndefined();
    expect(scan).toHaveBeenCalledWith(clean);
  });

  it('fails closed for unavailable, incomplete or flagged moderation', async () => {
    const storage = new S3BucketService();
    const image = await sharp({
      create: { width: 10, height: 10, channels: 3, background: 'red' },
    })
      .jpeg()
      .toBuffer();
    const scan = jest
      .spyOn(storage as any, 'moderationResult')
      .mockRejectedValue(new Error('scanner offline'));
    await expect(storage.sanitizeAndModerate(image)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    scan.mockResolvedValue({});
    await expect(storage.sanitizeAndModerate(image)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    scan.mockResolvedValue({
      ModerationModelVersion: 'test',
      ModerationLabels: [{ Name: 'Explicit' }],
    });
    await expect(storage.sanitizeAndModerate(image)).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
  });
});

function restoreEnv(name: string, value?: string) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
