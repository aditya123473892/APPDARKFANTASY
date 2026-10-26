import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH } from './create-group.dto';

// Validators are required: the global pipe rejects undecorated properties.
export class UpdateGroupDto {
  @ApiProperty({ required: false, maxLength: MAX_GROUP_NAME_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_NAME_LENGTH)
  name?: string;

  @ApiProperty({ required: false, maxLength: MAX_GROUP_DESCRIPTION_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_GROUP_DESCRIPTION_LENGTH)
  description?: string;
}
