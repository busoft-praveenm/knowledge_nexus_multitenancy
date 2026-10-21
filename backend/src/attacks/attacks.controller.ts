import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsIn } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContext } from '../common/tenant-context';
import { AttacksService } from './attacks.service';

class RunAttackDto {
  @IsArray() @ArrayNotEmpty() @IsIn(['on', 'off'], { each: true })
  modes: ('on' | 'off')[];
}

@Controller('attacks')
@UseGuards(JwtAuthGuard)
export class AttacksController {
  constructor(private readonly attacks: AttacksService) {}

  @Get()
  catalog(@CurrentUser() user: TenantContext) {
    return this.attacks.catalog(user);
  }

  @Post(':id/run')
  run(@CurrentUser() user: TenantContext, @Param('id') id: string, @Body() dto: RunAttackDto) {
    return this.attacks.run(user, id, dto.modes);
  }
}
