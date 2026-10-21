import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { RlsStateService } from './rls-state.service';

class SetRlsDto {
  @IsBoolean()
  enabled: boolean;
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly rls: RlsStateService,
    private readonly db: TenantConnectionService,
  ) {}

  /** Any signed-in user may see whether the policy is on (shown in the nav bar). */
  @Get('rls')
  async getRls() {
    return { enabled: await this.rls.isEnabled() };
  }

  @Post('rls')
  @UseGuards(PlatformAdminGuard)
  async setRls(@Body() dto: SetRlsDto) {
    return { enabled: await this.rls.setEnabled(dto.enabled) };
  }

  @Get('audit')
  @UseGuards(PlatformAdminGuard)
  async audit(@Query('limit') limit = '100') {
    const top = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    return this.db.withoutTenant('admin', async (db) => {
      const r = await db.request().query(`
        SELECT TOP (${top}) a.audit_id, a.at_utc, a.tenant_id, a.user_id, u.email, a.source,
               a.prompt, a.sql_text, a.row_count, a.outcome, a.error_message, a.rls_enabled, a.duration_ms
        FROM platform.agent_audit_log a
        LEFT JOIN platform.app_users u ON u.user_id = a.user_id
        ORDER BY a.audit_id DESC`);
      return r.recordset;
    });
  }

  /** Policy metadata straight from the catalog — handy to show on stage. */
  @Get('policy')
  @UseGuards(PlatformAdminGuard)
  async policy() {
    return this.db.withoutTenant('admin', async (db) => {
      const r = await db.request().query(`
        SELECT p.name AS policy, p.is_enabled, OBJECT_SCHEMA_NAME(pr.target_object_id) + '.' + OBJECT_NAME(pr.target_object_id) AS target_table,
               pr.predicate_type_desc, pr.operation_desc, pr.predicate_definition
        FROM sys.security_policies p
        JOIN sys.security_predicates pr ON pr.object_id = p.object_id
        ORDER BY target_table, pr.predicate_type_desc, pr.operation_desc`);
      return r.recordset;
    });
  }
}
