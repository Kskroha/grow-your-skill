import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types';
import { AchievementsService } from './achievements.service';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  catalog() {
    return this.achievements.listCatalog();
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.achievements.listForUser(user.id);
  }
}
