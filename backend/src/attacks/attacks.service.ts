import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RlsStateService } from '../admin/rls-state.service';
import { RunSqlTool, SqlRunResult } from '../agent/tools/run-sql.tool';
import { AuditService, outcomeOf } from '../audit/audit.service';
import { TenantContext } from '../common/tenant-context';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { ATTACK_SCENARIOS, AttackScenario } from './attack-scenarios';

export interface ModeOutcome {
  rlsEnabled: boolean;
  steps: (SqlRunResult & { title: string; note?: string })[];
  leakedRows: number;
  leakedTenants: number[];
  verdict: 'defended' | 'breached';
}

const PLATFORM_CTX: TenantContext = {
  userId: 0, tenantId: null, role: 'platform_admin', email: 'system@nexus.test', displayName: 'system', tenantName: null,
};

@Injectable()
export class AttacksService {
  constructor(
    private readonly runSql: RunSqlTool,
    private readonly rls: RlsStateService,
    private readonly audit: AuditService,
    private readonly db: TenantConnectionService,
  ) {}

  catalog(ctx: TenantContext) {
    return ATTACK_SCENARIOS.map((s) => this.render(s, ctx));
  }

  async run(ctx: TenantContext, id: string, modes: ('on' | 'off')[]) {
    if (!ctx.tenantId) throw new BadRequestException('Sign in as a tenant user to run attacks.');
    const scenario = ATTACK_SCENARIOS.find((s) => s.id === id);
    if (!scenario) throw new NotFoundException(`Unknown scenario ${id}`);
    const rendered = this.render(scenario, ctx);

    const results: Partial<Record<'on' | 'off', ModeOutcome>> = {};
    for (const mode of modes) {
      results[mode] = await this.rls.runWithState(mode === 'on', () => this.execute(ctx, rendered, mode === 'on'));
    }
    return { scenario: rendered, results };
  }

  private async execute(ctx: TenantContext, s: AttackScenario, rlsEnabled: boolean): Promise<ModeOutcome> {
    const steps: ModeOutcome['steps'] = [];
    try {
      for (const step of s.steps) {
        const result = await this.runSql.run(ctx, step.sql, { bypassGuard: true, identity: step.identity });
        steps.push({ ...result, title: step.title, note: step.note });
        await this.audit.record(ctx, {
          source: 'attack-lab',
          prompt: `${s.title}: ${s.attackerInput}`,
          sqlText: step.sql,
          rowCount: result.rowCount,
          outcome: outcomeOf(result),
          errorMessage: result.error?.message,
          rlsEnabled,
          durationMs: result.ms,
        });
      }
    } finally {
      for (const q of s.cleanup ?? []) {
        await this.db.withTenant(PLATFORM_CTX, 'admin', (db) => db.request().query(q));
      }
    }

    // A breach = any foreign tenant's rows were read, or a write succeeded / context changed.
    const foreign = steps.flatMap((st) => st.rows.filter((r) => typeof r.tenant_id === 'number' && r.tenant_id !== ctx.tenantId));
    const sideEffect = steps.some((st) => st.ok && /^\s*(insert|update|delete|exec)/i.test(st.sql));
    return {
      rlsEnabled,
      steps,
      leakedRows: foreign.length,
      leakedTenants: [...new Set(foreign.map((r) => r.tenant_id as number))].sort(),
      verdict: foreign.length || sideEffect ? 'breached' : 'defended',
    };
  }

  private render(s: AttackScenario, ctx: TenantContext): AttackScenario {
    const me = ctx.tenantId ?? 1;
    const victim = (me % 3) + 1;
    const victimInvoice = `${['ACM', 'GLO', 'INI'][victim - 1]}-2026-0001`;
    const sub = (t: string) =>
      t.replace(/\{me\}/g, String(me)).replace(/\{victim\}/g, String(victim)).replace(/\{victimInvoice\}/g, victimInvoice);
    return {
      ...s,
      title: sub(s.title),
      attackerInput: sub(s.attackerInput),
      steps: s.steps.map((st) => ({ ...st, title: sub(st.title), sql: sub(st.sql) })),
    };
  }
}
