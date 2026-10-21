import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../database/tenant-connection.service';

/**
 * Reads / toggles the security policy. Only the nexus_admin login holds
 * ALTER ANY SECURITY POLICY — neither the app nor the agent can do this.
 */
@Injectable()
export class RlsStateService {
  /** Serialises "temporarily off" runs so two Attack Lab clicks can't interleave. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: TenantConnectionService) {}

  async isEnabled(): Promise<boolean> {
    return this.db.withoutTenant('admin', async (db) => {
      const r = await db
        .request()
        .query(`SELECT is_enabled FROM sys.security_policies WHERE name = N'TenantIsolation'`);
      return Boolean(r.recordset[0]?.is_enabled);
    });
  }

  async setEnabled(enabled: boolean): Promise<boolean> {
    await this.db.withoutTenant('admin', (db) =>
      db
        .request()
        .query(`ALTER SECURITY POLICY security.TenantIsolation WITH (STATE = ${enabled ? 'ON' : 'OFF'})`),
    );
    return this.isEnabled();
  }

  /**
   * Run `work` with the policy in a given state, then restore the previous
   * state — even if `work` throws. Used by the Attack Lab's ON/OFF comparison.
   */
  async runWithState<T>(enabled: boolean, work: () => Promise<T>): Promise<T> {
    const run = async () => {
      const before = await this.isEnabled();
      if (before !== enabled) await this.setEnabled(enabled);
      try {
        return await work();
      } finally {
        if (before !== enabled) await this.setEnabled(before);
      }
    };
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }
}
