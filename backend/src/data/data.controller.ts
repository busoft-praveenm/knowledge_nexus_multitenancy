import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContext } from '../common/tenant-context';
import { DATA_QUERIES, DataService, DataSet } from './data.service';

class CreateTicketDto {
  @IsString() @MinLength(3) @MaxLength(200)
  subject: string;

  @IsString() @MinLength(1) @MaxLength(4000)
  body: string;

  @IsIn(['Low', 'Medium', 'High', 'Urgent'])
  priority: string;

  /** Demo only: try to write into a different tenant. */
  @IsOptional() @IsInt()
  targetTenantId?: number;
}

@Controller('data')
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get('summary')
  summary(@CurrentUser() user: TenantContext) {
    return this.data.summary(user);
  }

  @Get(':set')
  list(@CurrentUser() user: TenantContext, @Param('set') set: string) {
    if (!(set in DATA_QUERIES)) throw new BadRequestException(`Unknown data set "${set}"`);
    return this.data.list(user, set as DataSet);
  }

  @Post('tickets')
  createTicket(@CurrentUser() user: TenantContext, @Body() dto: CreateTicketDto) {
    return this.data.createTicket(user, dto);
  }
}
