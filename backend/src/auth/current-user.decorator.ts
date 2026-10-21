import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../common/tenant-context';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext => ctx.switchToHttp().getRequest().user,
);
