import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types';
import { CatalogService } from './catalog.service';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/exercise.dto';
import { CreateTopicDto, UpdateTopicDto } from './dto/topic.dto';

@Controller('catalog')
@UseGuards(RolesGuard)
@Roles(Role.TEACHER)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('topics')
  listTopics(@CurrentUser() user: AuthUser) {
    return this.catalog.listTopics(user.id);
  }

  @Get('topics/:id')
  getTopic(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.getTopic(user.id, id);
  }

  @Post('topics')
  createTopic(@CurrentUser() user: AuthUser, @Body() dto: CreateTopicDto) {
    return this.catalog.createTopic(user.id, dto);
  }

  @Patch('topics/:id')
  updateTopic(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.catalog.updateTopic(user.id, id, dto);
  }

  @Delete('topics/:id')
  deleteTopic(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.deleteTopic(user.id, id);
  }

  @Get('exercises')
  listExercises(
    @CurrentUser() user: AuthUser,
    @Query('topicId') topicId?: string,
  ) {
    return this.catalog.listExercises(user.id, topicId);
  }

  @Get('exercises/:id')
  getExercise(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.getExercise(user.id, id);
  }

  @Post('exercises')
  createExercise(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExerciseDto,
  ) {
    return this.catalog.createExercise(user.id, dto);
  }

  @Patch('exercises/:id')
  updateExercise(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.catalog.updateExercise(user.id, id, dto);
  }

  @Delete('exercises/:id')
  deleteExercise(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.deleteExercise(user.id, id);
  }
}
