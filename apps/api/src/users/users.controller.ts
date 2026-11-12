import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types';
import { CreateStudentDto } from './dto/create-student.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(Role.STUDENT)
  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  setAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile()
    file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.users.setAvatar(user.id, file);
  }

  @Roles(Role.TEACHER)
  @Post('students')
  createStudent(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStudentDto,
  ) {
    return this.users.createStudent(user.id, dto);
  }

  @Roles(Role.TEACHER)
  @Get('students')
  listStudents(@CurrentUser() user: AuthUser) {
    return this.users.listStudents(user.id);
  }

  @Roles(Role.TEACHER)
  @Get('students/:id')
  getStudent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.getStudent(user.id, id);
  }
}
