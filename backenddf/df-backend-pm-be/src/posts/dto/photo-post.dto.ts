import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { EPostVisibility } from '../../common/enums/posts.enum';
export class PhotoPostDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{8,64}$/) clientId: string;
  @IsOptional() @IsString() @MaxLength(500) caption?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsEnum(EPostVisibility) visibility?: EPostVisibility;
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  photoIds: string[];
}
export class EditPhotoPostDto extends PartialType(
  OmitType(PhotoPostDto, ['clientId'] as const),
) {}
