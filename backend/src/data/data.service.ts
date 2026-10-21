import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { TenantContext } from '../common/tenant-context';
import { RlsStateService } from '../admin/rls-state.service';
import { TenantConnectionService } from '../database/tenant-connection.service';

/**
 * NOTICE: none of these queries contains `WHERE tenant_id = …`.
 * Isolation is enforced by the database (security.TenantIsolation),
 * so a forgotten filter in application code can no longer leak data.
 */
export const DATA_QUERIES = {
  customers: `SELECT c.customer_id, c.tenant_id, c.name, c.email, c.phone, c.city, c.tier, c.created_at
              FROM app.customers c ORDER BY c.tenant_id, c.customer_id`,
  tickets: `SELECT t.ticket_id, t.tenant_id, c.name AS customer, t.subject, t.status, t.priority, t.created_at, t.body
            FROM app.tickets t JOIN app.customers c ON c.customer_id = t.customer_id
            ORDER BY t.tenant_id, t.created_at DESC`,
  invoices: `SELECT i.invoice_id, i.tenant_id, i.invoice_no, c.name AS customer, i.amount, i.currency, i.status, i.issued_on, i.due_on
             FROM app.invoices i JOIN app.customers c ON c.customer_id = i.customer_id
             ORDER BY i.tenant_id, i.issued_on DESC`,
} as const;

export type DataSet = keyof typeof DATA_QUERIES;

const SUMMARY_SQL = `
  SELECT
    (SELECT COUNT(*) FROM app.customers)                              AS customers,
    (SELECT COUNT(*) FROM app.tickets)                                AS tickets,
    (SELECT COUNT(*) FROM app.tickets WHERE status IN (N'Open', N'In Progress')) AS open_tickets,
    (SELECT COUNT(*) FROM app.invoices)                               AS invoices,
    (SELECT ISNULL(SUM(amount), 0) FROM app.invoices WHERE status <> N'Paid') AS outstanding,
    (SELECT COUNT(DISTINCT tenant_id) FROM app.tickets)               AS tenants_visible`;

@Injectable()
export class DataService {
  constructor(
    private readonly db: TenantConnectionService,
    private readonly rls: RlsStateService,
  ) {}

  async list(ctx: TenantContext, set: DataSet) {
    const sqlText = DATA_QUERIES[set];
    const rows = await this.db.withTenant(ctx, 'app', async (db) => (await db.request().query(sqlText)).recordset);
    return { sql: sqlText, rows, rlsEnabled: await this.rls.isEnabled() };
  }

  async summary(ctx: TenantContext) {
    const row = await this.db.withTenant(ctx, 'app', async (db) => (await db.request().query(SUMMARY_SQL)).recordset[0]);
    return { ...row, rlsEnabled: await this.rls.isEnabled() };
  }

  /**
   * Create a ticket. `targetTenantId` lets the demo deliberately try to write
   * into ANOTHER tenant — the BLOCK predicate rejects it inside the database.
   */
  async createTicket(
    ctx: TenantContext,
    input: { subject: string; body: string; priority: string; targetTenantId?: number },
  ) {
    const tenantId = input.targetTenantId ?? ctx.tenantId;
    const sqlText = `INSERT INTO app.tickets (tenant_id, customer_id, subject, body, priority)
OUTPUT inserted.ticket_id, inserted.tenant_id
SELECT @tenant_id, MIN(customer_id), @subject, @body, @priority
FROM app.customers`;
    try {
      const row = await this.db.withTenant(ctx, 'app', async (db) => {
        const r = await db
          .request()
          .input('tenant_id', sql.Int, tenantId)
          .input('subject', sql.NVarChar(200), input.subject)
          .input('body', sql.NVarChar(sql.MAX), input.body)
          .input('priority', sql.NVarChar(10), input.priority)
          .query(sqlText);
        return r.recordset[0];
      });
      return { ok: true, sql: sqlText, ticket: row };
    } catch (err: any) {
      return { ok: false, sql: sqlText, error: { number: err.number, message: err.message } };
    }
  }
}
