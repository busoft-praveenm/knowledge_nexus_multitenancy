import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { TenantContext } from '../../common/tenant-context';
import { TenantConnectionService } from '../../database/tenant-connection.service';
import { SqlRunResult } from './run-sql.tool';

interface Param {
  name: string;
  type: sql.ISqlType | (() => sql.ISqlType);
  value: unknown;
}

interface CuratedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  build(args: Record<string, unknown>): { sql: string; params: Param[] };
}

const clamp = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), min), max) : dflt;
};
const oneOf = (v: unknown, allowed: string[]) => (typeof v === 'string' && allowed.includes(v) ? v : null);

/**
 * The "production-style" alternative to run_sql: typed service methods
 * exposed as tools. The SQL is written and reviewed by us; the model can
 * only choose a tool and fill in its arguments.
 *
 * Note what is missing on purpose:
 *   - no tool takes a tenant parameter (the tenant comes from the JWT), and
 *   - none of these queries filters by tenant_id — exactly like a real
 *     service layer where someone forgot, or relied on a shared base class.
 * RLS is what keeps them correct.
 */
const TOOLS: CuratedTool[] = [
  {
    name: 'get_ticket_stats',
    description: 'Count support tickets grouped by status.',
    parameters: { type: 'object', properties: {} },
    build: () => ({
      sql: `SELECT t.tenant_id, t.status, COUNT(*) AS tickets
FROM app.tickets t
GROUP BY t.tenant_id, t.status
ORDER BY tickets DESC`,
      params: [],
    }),
  },
  {
    name: 'list_tickets',
    description: 'List the most recent support tickets, optionally filtered by status and/or priority.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['Open', 'In Progress', 'Resolved', 'Closed'] },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
        limit: { type: 'integer', minimum: 1, maximum: 20 },
      },
    },
    build: (a) => ({
      sql: `SELECT TOP (@limit) t.ticket_id, t.tenant_id, t.subject, t.status, t.priority, t.created_at, t.body
FROM app.tickets t
WHERE (@status IS NULL OR t.status = @status)
  AND (@priority IS NULL OR t.priority = @priority)
ORDER BY t.created_at DESC`,
      params: [
        { name: 'limit', type: sql.Int, value: clamp(a.limit, 1, 20, 5) },
        { name: 'status', type: sql.NVarChar(20), value: oneOf(a.status, ['Open', 'In Progress', 'Resolved', 'Closed']) },
        { name: 'priority', type: sql.NVarChar(10), value: oneOf(a.priority, ['Low', 'Medium', 'High', 'Urgent']) },
      ],
    }),
  },
  {
    name: 'list_overdue_invoices',
    description: 'List overdue invoices, oldest first.',
    parameters: { type: 'object', properties: {} },
    build: () => ({
      sql: `SELECT TOP 20 i.invoice_no, i.tenant_id, c.name AS customer, i.amount, i.currency, i.due_on
FROM app.invoices i
JOIN app.customers c ON c.customer_id = i.customer_id
WHERE i.status = N'Overdue'
ORDER BY i.due_on`,
      params: [],
    }),
  },
  {
    name: 'top_customers',
    description: 'Rank customers by total invoiced amount.',
    parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } } },
    build: (a) => ({
      sql: `SELECT TOP (@limit) c.name, c.tenant_id, c.tier, SUM(i.amount) AS revenue, COUNT(*) AS invoices
FROM app.invoices i
JOIN app.customers c ON c.customer_id = i.customer_id
GROUP BY c.name, c.tenant_id, c.tier
ORDER BY revenue DESC`,
      params: [{ name: 'limit', type: sql.Int, value: clamp(a.limit, 1, 10, 5) }],
    }),
  },
  {
    name: 'get_invoice',
    description: 'Fetch one invoice with its customer details by invoice number, e.g. ACM-2026-0001.',
    parameters: {
      type: 'object',
      properties: { invoice_no: { type: 'string', description: 'Invoice number such as ACM-2026-0001' } },
      required: ['invoice_no'],
    },
    build: (a) => ({
      // DEMO BUG (intentional): looks the invoice up by number only — no
      // ownership check. A textbook IDOR / BOLA in a "safe", curated tool.
      // The model fills invoice_no, so anyone who can steer the model can
      // ask for another tenant's invoice. Only RLS stops it.
      sql: `SELECT i.invoice_id, i.tenant_id, i.invoice_no, c.name AS customer, c.email,
       i.amount, i.currency, i.status, i.issued_on, i.due_on
FROM app.invoices i
JOIN app.customers c ON c.customer_id = i.customer_id
WHERE i.invoice_no = @invoice_no`,
      params: [{ name: 'invoice_no', type: sql.NVarChar(30), value: String(a.invoice_no ?? '').trim().toUpperCase() }],
    }),
  },
];

@Injectable()
export class CuratedTools {
  constructor(
    private readonly db: TenantConnectionService,
    private readonly config: ConfigService,
  ) {}

  /** OpenAI-style tool definitions handed to the model. */
  static readonly definitions = TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  static readonly names = TOOLS.map((t) => t.name);

  /** Render the SQL a tool would run (used by the Attack Lab). */
  static sqlFor(name: string, args: Record<string, unknown> = {}): string {
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) throw new Error(`Unknown curated tool ${name}`);
    return tool.build(args).sql;
  }

  async call(ctx: TenantContext, name: string, args: Record<string, unknown> = {}): Promise<SqlRunResult> {
    const tool = TOOLS.find((t) => t.name === name);
    const base = { identity: 'app' as const, guard: { allowed: true }, rows: [], rowCount: 0, truncated: false, tenantsInResult: [] };
    if (!tool) {
      return { ...base, sql: '', ok: false, blockedBy: null, ms: 0, error: { message: `Unknown tool "${name}". Available: ${CuratedTools.names.join(', ')}` } };
    }

    const { sql: sqlText, params } = tool.build(args ?? {});
    const paramValues = Object.fromEntries(params.map((p) => [p.name, p.value]));
    const started = Date.now();
    try {
      const recordset = await this.db.withTenant(
        ctx,
        'app',
        async (db) => {
          const req = db.request();
          for (const p of params) req.input(p.name, p.type as any, p.value);
          return (await req.query(sqlText)).recordset ?? [];
        },
        { requestTimeoutMs: Number(this.config.get('AGENT_QUERY_TIMEOUT_MS') ?? 5000) },
      );
      const tenants = [...new Set(recordset.map((r: any) => r.tenant_id).filter((t: unknown) => typeof t === 'number'))].sort() as number[];
      return { ...base, sql: sqlText, params: paramValues, ok: true, blockedBy: null, rowCount: recordset.length, rows: recordset, tenantsInResult: tenants, ms: Date.now() - started };
    } catch (err: any) {
      return { ...base, sql: sqlText, params: paramValues, ok: false, blockedBy: null, ms: Date.now() - started, error: { number: err?.number, message: err?.message ?? String(err) } };
    }
  }
}
