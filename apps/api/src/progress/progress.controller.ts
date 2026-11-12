import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(RolesGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.progress.forStudent(user, user.id);
  }

  @Roles(Role.TEACHER)
  @Get(':studentId')
  forStudent(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    return this.progress.forStudent(user, studentId);
  }
}
