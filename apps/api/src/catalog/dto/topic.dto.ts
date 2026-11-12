import { TopicKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class VocabWordDto {
  @IsString()
  ko!: string;

  @IsString()
  ru!: string;

  @IsOptional()
  @IsString()
  roman?: string;
}

export class CreateTopicDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TopicKind)
  kind!: TopicKind;
}

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TopicKind)
  kind?: TopicKind;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VocabWordDto)
  words?: VocabWordDto[];
}
