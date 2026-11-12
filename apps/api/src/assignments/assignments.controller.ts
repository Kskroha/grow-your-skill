import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types';
import { AssignmentsService } from './assignments.service';
import {
  CheckItemDto,
  CreateAssignmentsDto,
  CreatePackAssignmentDto,
  SaveProgressDto,
  SubmitAttemptDto,
} from './dto/assignment.dto';

@Controller('assignments')
@UseGuards(RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Roles(Role.TEACHER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssignmentsDto) {
    return this.assignments.create(user.id, dto);
  }

  @Roles(Role.TEACHER)
  @Post('pack')
  createPack(@CurrentUser() user: AuthUser, @Body() dto: CreatePackAssignmentDto) {
    return this.assignments.createPack(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.assignments.list(user, studentId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assignments.get(user, id);
  }

  @Roles(Role.TEACHER)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assignments.remove(user.id, id);
  }

  @Roles(Role.STUDENT)
  @Post(':id/check')
  check(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CheckItemDto,
  ) {
    return this.assignments.checkItem(user, id, dto);
  }

  @Roles(Role.STUDENT)
  @Post(':id/restart')
  restart(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assignments.restart(user, id);
  }

  @Roles(Role.STUDENT)
  @Post(':id/progress')
  saveProgress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveProgressDto,
  ) {
    return this.assignments.saveProgress(user, id, dto);
  }

  @Roles(Role.STUDENT)
  @Post(':id/attempts')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.assignments.submit(user, id, dto);
  }
}
