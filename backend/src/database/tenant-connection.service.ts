import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { TenantContext } from '../common/tenant-context';

/** Which least-privilege database login a piece of work runs as. */
export type DbIdentity = 'app' | 'agent' | 'admin';

/**
 * A handle to ONE physical connection that has been reset and then
 * pinned to a tenant. Every query run through it is filtered by RLS.
 */
export interface PinnedDb {
  request(): sql.Request;
}

/**
 * Owns one connection pool per database identity and hands out
 * connections that are *pinned* to the caller's tenant.
 *
 * Why the extra ceremony?
 *   SESSION_CONTEXT lives on the physical connection. A pool re-uses
 *   connections across requests, so context set for tenant A would still
 *   be there when tenant B's request borrows the same connection.
 *   The node `mssql` driver does NOT reset pooled connections for you.
 *
 * So for every unit of work we:
 *   1. borrow a physical connection
 *   2. reset it (TDS resetConnection flag ≈ sp_reset_connection) — wipes
 *      any previous SESSION_CONTEXT, temp tables, SET options
 *   3. set tenant_id / user_id / role with @read_only = 1 so that nothing
 *      later on this connection (including SQL written by an AI agent)
 *      can change them
 *   4. run the work, then return the connection to the pool
 *
 * PostgreSQL equivalent: BEGIN; SET LOCAL app.tenant_id = '…'; …; COMMIT;
 * (SET LOCAL is scoped to the transaction, so it cannot leak.)
 */
@Injectable()
export class TenantConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly pools = new Map<DbIdentity, sql.ConnectionPool>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    for (const identity of ['app', 'agent', 'admin'] as DbIdentity[]) {
      const pool = new sql.ConnectionPool(this.poolConfig(identity));
      await pool.connect();
      this.pools.set(identity, pool);
      this.logger.log(`Connected pool "${identity}" as ${this.poolConfig(identity).user}`);
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map((p) => p.close()));
  }

  /**
   * Run `work` on a connection pinned to the caller's tenant.
   * This is the ONLY way application code talks to tenant data.
   */
  async withTenant<T>(
    ctx: TenantContext,
    identity: DbIdentity,
    work: (db: PinnedDb) => Promise<T>,
    opts: { requestTimeoutMs?: number } = {},
  ): Promise<T> {
    return this.withConnection(identity, async (db) => {
      await db
        .request()
        .input('tenant_id', sql.Int, ctx.tenantId)
        .input('user_id', sql.Int, ctx.userId)
        .input('role', sql.NVarChar(30), ctx.role).query(`
          EXEC sp_set_session_context @key = N'tenant_id', @value = @tenant_id, @read_only = 1;
          EXEC sp_set_session_context @key = N'user_id',   @value = @user_id,   @read_only = 1;
          EXEC sp_set_session_context @key = N'role',      @value = @role,      @read_only = 1;`);
      return work(db);
    }, opts);
  }

  /** Run work with NO tenant context (used for login lookup and admin ops). */
  async withoutTenant<T>(identity: DbIdentity, work: (db: PinnedDb) => Promise<T>): Promise<T> {
    return this.withConnection(identity, work);
  }

  private async withConnection<T>(
    identity: DbIdentity,
    work: (db: PinnedDb) => Promise<T>,
    opts: { requestTimeoutMs?: number } = {},
  ): Promise<T> {
    const pool = this.pools.get(identity);
    if (!pool) throw new Error(`Pool ${identity} not initialised`);

    // 1. borrow one physical (tedious) connection from the pool
    const conn: any = await (pool as any).acquire(null);
    try {
      // 2. reset it so no state from a previous request survives
      await new Promise<void>((resolve, reject) =>
        conn.reset((err: Error | undefined) => (err ? reject(err) : resolve())),
      );

      // A minimal "parent" so mssql.Request runs on THIS connection only.
      const pinnedParent: any = {
        config: (pool as any).config,
        connected: true,
        collation: (pool as any).collation,
        acquire: (_req: unknown, cb: (...args: any[]) => void) => setImmediate(cb, null, conn, (pool as any).config),
        release: () => undefined,
      };
      const db: PinnedDb = {
        request: () => {
          const r = new sql.Request(pinnedParent);
          if (opts.requestTimeoutMs) (r as any).requestTimeout = opts.requestTimeoutMs;
          return r;
        },
      };
      return await work(db);
    } finally {
      (pool as any).release(conn);
    }
  }

  private poolConfig(identity: DbIdentity): sql.config {
    const key = identity.toUpperCase();
    return {
      server: this.config.get<string>('DB_HOST')!,
      port: Number(this.config.get('DB_PORT')),
      database: this.config.get<string>('DB_NAME')!,
      user: this.config.get<string>(`DB_${key}_USER`)!,
      password: this.config.get<string>(`DB_${key}_PASSWORD`)!,
      options: {
        encrypt: true,
        trustServerCertificate: String(this.config.get('DB_TRUST_SERVER_CERT')) === 'true',
        appName: `nexus-${identity}`,
      },
      pool: { min: 1, max: 10, idleTimeoutMillis: 30000 },
    };
  }
}
