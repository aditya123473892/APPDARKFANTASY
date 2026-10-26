import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const MAX_GROUP_MEMBERS = Number(process.env.GROUP_MAX_MEMBERS || 256);
export const MAX_GROUP_NAME_LENGTH = 100;
export const MAX_GROUP_DESCRIPTION_LENGTH = 500;

export class CreateGroupDto {
  @ApiProperty({ maxLength: MAX_GROUP_NAME_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'Group name is required' })
  @MaxLength(MAX_GROUP_NAME_LENGTH)
  name: string;

  @ApiProperty({ required: false, maxLength: MAX_GROUP_DESCRIPTION_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_DESCRIPTION_LENGTH)
  description?: string;

  // Ignored: the owner is always the authenticated user. Kept so existing
  // clients that send it are not rejected.
  @ApiProperty({ required: false, deprecated: true })
  @IsOptional()
  @IsMongoId()
  admin?: string;

  @ApiProperty({
    type: [String],
    description: 'User ids to add; the caller is always added as owner',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one member' })
  @ArrayMaxSize(MAX_GROUP_MEMBERS - 1)
  @IsMongoId({ each: true })
  members: string[];

  // Idempotency key generated once per create attempt and reused on retries.
  @ApiProperty({ required: false, pattern: '^[A-Za-z0-9_-]{8,64}$' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  clientId?: string;
}
