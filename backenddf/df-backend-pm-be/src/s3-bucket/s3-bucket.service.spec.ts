import { Test, TestingModule } from '@nestjs/testing';
import { S3BucketService } from './s3-bucket.service';
import sharp = require('sharp');

describe('S3BucketService', () => {
  let service: S3BucketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [S3BucketService],
    }).compile();

    service = module.get<S3BucketService>(S3BucketService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('compresses photos to JPEG within 1080x1920 and strips EXIF/GPS', async () => {
    const scanner = jest.spyOn(service as any, 'moderationResult').mockResolvedValue({
      ModerationModelVersion: 'test', ModerationLabels: [],
    });
    const previous = process.env.PHOTO_MODERATION_MODE;
    process.env.PHOTO_MODERATION_MODE = 'rekognition';
    try {
      const source = await sharp({ create: { width: 2160, height: 3840, channels: 3, background: '#b08060' } })
        .jpeg({ quality: 100 }).withExif({ IFD0: { Artist: 'Private metadata' } }).toBuffer();
      expect((await sharp(source).metadata()).exif).toBeDefined();
      const clean = await service.sanitizeAndModerate(source);
      const meta = await sharp(clean).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.width).toBe(1080); expect(meta.height).toBe(1920);
      expect(meta.exif).toBeUndefined(); expect(meta.xmp).toBeUndefined();
      expect(clean.length).toBeLessThan(source.length);
      expect(scanner).toHaveBeenCalledWith(clean);
    } finally {
      if (previous === undefined) delete process.env.PHOTO_MODERATION_MODE;
      else process.env.PHOTO_MODERATION_MODE = previous;
    }
  });
});
