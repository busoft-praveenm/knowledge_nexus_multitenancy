import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { TenantContext } from '../common/tenant-context';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class LoginDto {
  @IsEmail({ allow_ip_domain: false, require_tld: false })
  email: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('personas')
  personas() {
    return this.auth.personas();
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: TenantContext) {
    return user;
  }
}
