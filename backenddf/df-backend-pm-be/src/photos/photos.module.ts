import { Global, Module } from '@nestjs/common';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';
import { S3BucketService } from '../s3-bucket/s3-bucket.service';
import { PhotoResponseInterceptor } from './response.interceptor';

@Global()
@Module({
  providers: [PhotosService, S3BucketService, PhotoResponseInterceptor],
  controllers: [PhotosController],
  exports: [PhotosService, PhotoResponseInterceptor],
})
export class PhotosModule {}
