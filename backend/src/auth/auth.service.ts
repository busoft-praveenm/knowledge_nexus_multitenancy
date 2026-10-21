import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as sql from 'mssql';
import { TenantContext } from '../common/tenant-context';
import { TenantConnectionService } from '../database/tenant-connection.service';

/** Context used for platform-level reads (the persona picker on the login page). */
const PLATFORM_CTX: TenantContext = {
  userId: 0,
  tenantId: null,
  role: 'platform_admin',
  email: 'system@nexus.test',
  displayName: 'system',
  tenantName: null,
};

const USER_SQL = `
  SELECT u.user_id, u.tenant_id, u.email, u.display_name, u.role, u.avatar_color,
         t.name AS tenant_name, t.industry, t.[plan]
  FROM platform.app_users u
  LEFT JOIN app.tenants t ON t.tenant_id = u.tenant_id   -- RLS applies to app.tenants`;

/**
 * DEMO authentication: pick a persona, get a JWT.
 * In production this is your IdP (Entra ID, Auth0, Keycloak…); the
 * important part is the same — tenant_id comes from a verified claim.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly db: TenantConnectionService,
    private readonly jwt: JwtService,
  ) {}

  /** Persona picker: a platform-level read, so it runs with the platform role. */
  async personas() {
    return this.db.withTenant(PLATFORM_CTX, 'app', async (db) => {
      const r = await db
        .request()
        .query(`${USER_SQL} ORDER BY CASE WHEN u.tenant_id IS NULL THEN 99 ELSE u.tenant_id END, u.user_id`);
      return r.recordset.map(this.toPersona);
    });
  }

  async login(email: string) {
    // Step 1 — identify the user. platform.app_users is not tenant data.
    const user = await this.db.withoutTenant('app', async (db) => {
      const r = await db
        .request()
        .input('email', sql.NVarChar(150), email)
        .query(`SELECT user_id, tenant_id, email, display_name, role, avatar_color
                FROM platform.app_users WHERE email = @email`);
      return r.recordset[0];
    });
    if (!user) throw new UnauthorizedException('Unknown user');

    const ctx: TenantContext = {
      userId: user.user_id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
      displayName: user.display_name,
      tenantName: null,
    };

    // Step 2 — read the tenant row *as that tenant*: RLS returns only their row.
    const tenant = await this.db.withTenant(ctx, 'app', async (db) => {
      const r = await db.request().query(`SELECT name, industry, [plan] FROM app.tenants`);
      return user.tenant_id ? r.recordset[0] : undefined;
    });
    ctx.tenantName = tenant?.name ?? null;

    return {
      accessToken: this.jwt.sign(ctx),
      user: this.toPersona({ ...user, tenant_name: tenant?.name, industry: tenant?.industry, plan: tenant?.plan }),
    };
  }

  private toPersona = (row: any) => ({
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    avatarColor: row.avatar_color,
    tenantName: row.tenant_name ?? 'Nexus Platform',
    industry: row.industry ?? 'Platform operations',
    plan: row.plan ?? '—',
  });
}
