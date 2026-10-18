import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class UploadUrlDto {
  @IsIn(['image/jpeg', 'image/webp']) contentType: 'image/jpeg' | 'image/webp';
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) requestId: string;
}
export class ConfirmPhotoDto {
  @IsUUID('4') uploadId: string;
}
export class PhotoReferenceDto {
  @IsUUID('4') uploadId: string;
}
export class PhotoListDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  photoIds?: string[];
  @IsOptional() @IsString() clientId?: string;
}
