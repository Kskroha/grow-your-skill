import { ExerciseType } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsEnum(ExerciseType)
  type!: ExerciseType;

  @IsString()
  topicId!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsEnum(ExerciseType)
  type?: ExerciseType;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
