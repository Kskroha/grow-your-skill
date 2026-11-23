import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAssignmentsDto {
  @IsString()
  studentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  exerciseIds!: string[];

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class SubmitAttemptDto {
  @IsObject()
  answers!: Record<string, unknown>;
}

export class SaveProgressDto {
  @IsObject()
  progress!: Record<string, unknown>;
}

export class CheckItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;

  @IsOptional()
  @IsString()
  selected?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  tool?: string;

  @IsOptional()
  @IsString()
  heard?: string;

  @IsOptional()
  @IsBoolean()
  yes?: boolean;
}

export class CreatePackAssignmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  topicId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tools!: string[];
}

export class ListAssignmentsQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  status?: string;
}
