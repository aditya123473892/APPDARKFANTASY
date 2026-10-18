import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { mergeMap } from 'rxjs/operators';
import { PhotosService } from './photos.service';

/** Sign only while producing an already-authorized response; never persist URLs. */
@Injectable()
export class PhotoResponseInterceptor implements NestInterceptor {
  constructor(private readonly photos: PhotosService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(mergeMap((value) => this.photos.present(value, context.switchToHttp().getRequest().user?.id)));
  }
}
