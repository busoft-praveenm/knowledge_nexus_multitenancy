import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantContext } from '../../common/tenant-context';
import { DbIdentity, TenantConnectionService } from '../../database/tenant-connection.service';
import { checkSql, GuardVerdict } from './sql-guard';

export interface SqlRunResult {
  sql: string;
  identity: DbIdentity;
  guard: GuardVerdict;
  ok: boolean;
  blockedBy: 'guard' | 'database' | null;
  rowCount: number;
  rows: Record<string, unknown>[];
  truncated: boolean;
  tenantsInResult: number[];
  ms: number;
  error?: { number?: number; message: string };
  /** Bound parameter values, for curated tools that run parameterised SQL. */
  params?: Record<string, unknown>;
}

/** SQL Server error numbers that mean "the database refused" (vs. a typo). */
export const DB_SECURITY_ERRORS: Record<number, string> = {
  229: 'Permission denied (least-privilege login)',
  230: 'Permission denied (least-privilege login)',
  262: 'Permission denied (least-privilege login)',
  15664: 'Session context is read-only (tenant pinned)',
  33504: 'RLS block predicate rejected the write',
  15247: 'Permission denied (least-privilege login)',
  1088: 'Permission denied (least-privilege login)',
};

/**
 * The agent's ONLY window into data. It always runs as the read-only
 * `nexus_agent` login on a connection pinned to the caller's tenant.
 * The tenant comes from the JWT — never from the model.
 */
@Injectable()
export class RunSqlTool {
  static readonly definition = {
    type: 'function',
    function: {
      name: 'run_sql',
      description:
        'Run ONE read-only T-SQL (Microsoft SQL Server) SELECT query against the helpdesk database and get rows back as JSON. ' +
        'Use TOP instead of LIMIT. Tables: app.customers, app.tickets, app.invoices, app.tenants.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'A single T-SQL SELECT statement' } },
        required: ['query'],
      },
    },
  };

  constructor(
    private readonly db: TenantConnectionService,
    private readonly config: ConfigService,
  ) {}

  get maxRows() {
    return Number(this.config.get('AGENT_MAX_ROWS') ?? 100);
  }

  /**
   * @param bypassGuard  Attack Lab only — skip layer 1 to prove that layer 2
   *                     (the database) still holds on its own.
   */
  async run(
    ctx: TenantContext,
    sqlText: string,
    opts: { bypassGuard?: boolean; identity?: DbIdentity } = {},
  ): Promise<SqlRunResult> {
    const identity = opts.identity ?? 'agent';
    const guard = checkSql(sqlText);
    const base = { sql: sqlText, identity, guard, rows: [], rowCount: 0, truncated: false, tenantsInResult: [] };

    if (!guard.allowed && !opts.bypassGuard) {
      return { ...base, ok: false, blockedBy: 'guard', ms: 0, error: { message: `Blocked by SQL guard: ${guard.reason}` } };
    }

    const started = Date.now();
    try {
      const recordset = await this.db.withTenant(
        ctx,
        identity,
        async (db) => (await db.request().query(sqlText)).recordset ?? [],
        { requestTimeoutMs: Number(this.config.get('AGENT_QUERY_TIMEOUT_MS') ?? 5000) },
      );
      const rows = recordset.slice(0, this.maxRows);
      return {
        ...base,
        ok: true,
        blockedBy: null,
        rowCount: recordset.length,
        rows,
        truncated: recordset.length > rows.length,
        tenantsInResult: distinctTenants(recordset),
        ms: Date.now() - started,
      };
    } catch (err: any) {
      const number = err?.number ?? err?.originalError?.info?.number;
      return {
        ...base,
        ok: false,
        blockedBy: number && DB_SECURITY_ERRORS[number] ? 'database' : null,
        ms: Date.now() - started,
        error: { number, message: err?.message ?? String(err) },
      };
    }
  }
}

function distinctTenants(rows: Record<string, unknown>[]): number[] {
  const set = new Set<number>();
  for (const r of rows) if (typeof r.tenant_id === 'number') set.add(r.tenant_id);
  return [...set].sort();
}
