import { Injectable, Logger } from '@nestjs/common';
import * as sql from 'mssql';
import { TenantContext } from '../common/tenant-context';
import { TenantConnectionService } from '../database/tenant-connection.service';

export type AuditSource = 'agent-llm' | 'agent-scripted' | 'attack-lab' | 'data-api';
export type AuditOutcome = 'ok' | 'blocked-guard' | 'blocked-database' | 'error';

/** Map a tool result to an audit outcome. */
export function outcomeOf(r: { ok: boolean; blockedBy: 'guard' | 'database' | null }): AuditOutcome {
  return r.ok ? 'ok' : r.blockedBy ? `blocked-${r.blockedBy}` : 'error';
}

export interface AuditEntry {
  source: AuditSource;
  prompt?: string;
  sqlText: string;
  rowCount?: number;
  outcome: AuditOutcome;
  errorMessage?: string;
  rlsEnabled: boolean;
  durationMs?: number;
}

/** Every statement an agent runs is recorded: who, which tenant, what SQL, what happened. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: TenantConnectionService) {}

  async record(ctx: TenantContext, e: AuditEntry) {
    try {
      await this.db.withoutTenant('app', (db) =>
        db
          .request()
          .input('tenant_id', sql.Int, ctx.tenantId)
          .input('user_id', sql.Int, ctx.userId)
          .input('source', sql.NVarChar(20), e.source)
          .input('prompt', sql.NVarChar(sql.MAX), e.prompt ?? null)
          .input('sql_text', sql.NVarChar(sql.MAX), e.sqlText)
          .input('row_count', sql.Int, e.rowCount ?? null)
          .input('outcome', sql.NVarChar(20), e.outcome)
          .input('error_message', sql.NVarChar(sql.MAX), e.errorMessage ?? null)
          .input('rls_enabled', sql.Bit, e.rlsEnabled)
          .input('duration_ms', sql.Int, e.durationMs ?? null)
          .query(`INSERT INTO platform.agent_audit_log
                    (tenant_id, user_id, source, prompt, sql_text, row_count, outcome, error_message, rls_enabled, duration_ms)
                  VALUES (@tenant_id, @user_id, @source, @prompt, @sql_text, @row_count, @outcome, @error_message, @rls_enabled, @duration_ms)`),
      );
    } catch (err) {
      this.logger.warn(`Audit write failed: ${(err as Error).message}`);
    }
  }
}
