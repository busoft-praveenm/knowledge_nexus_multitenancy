/* =====================================================================
   04_rls.sql — Row-Level Security (the heart of the demo)
   ---------------------------------------------------------------------
   PostgreSQL equivalent, for comparison:

     ALTER TABLE app.tickets ENABLE ROW LEVEL SECURITY;
     ALTER TABLE app.tickets FORCE  ROW LEVEL SECURITY;
     CREATE POLICY tenant_isolation ON app.tickets
         USING      (tenant_id = current_setting('app.tenant_id')::int)
         WITH CHECK (tenant_id = current_setting('app.tenant_id')::int);
     -- per request, inside a transaction:
     SET LOCAL app.tenant_id = '1';

   SQL Server splits this into:
     1. an inline table-valued PREDICATE FUNCTION (the "USING" expression)
     2. a SECURITY POLICY binding it to tables as
          FILTER predicates  -> silently hide rows on SELECT/UPDATE/DELETE  (≈ USING)
          BLOCK  predicates  -> reject writes that violate the rule       (≈ WITH CHECK)
     3. SESSION_CONTEXT    -> per-connection key/value set by the app, which
                              can be locked with @read_only = 1  (≈ SET LOCAL)
   ===================================================================== */
USE NexusDemo;
GO

IF OBJECT_ID(N'security.TenantIsolation', N'SP') IS NOT NULL
    DROP SECURITY POLICY security.TenantIsolation;
IF OBJECT_ID(N'security.fn_tenant_predicate', N'IF') IS NOT NULL
    DROP FUNCTION security.fn_tenant_predicate;
GO

/* A row is visible when its tenant_id equals the tenant pinned on this
   connection, or when the connection belongs to platform staff.
   If no context was set, SESSION_CONTEXT returns NULL and the comparison
   is never true: the default is DENY — "fail closed". */
CREATE FUNCTION security.fn_tenant_predicate (@tenant_id INT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS is_visible
    WHERE @tenant_id = CAST(SESSION_CONTEXT(N'tenant_id') AS INT)
       OR CAST(SESSION_CONTEXT(N'role') AS NVARCHAR(30)) = N'platform_admin';
GO

CREATE SECURITY POLICY security.TenantIsolation
    -- tenants: a tenant can only see its own tenant row
    ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON app.tenants,

    ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON app.customers,
    ADD BLOCK  PREDICATE security.fn_tenant_predicate(tenant_id) ON app.customers AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_tenant_predicate(tenant_id) ON app.customers AFTER UPDATE,

    ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON app.tickets,
    ADD BLOCK  PREDICATE security.fn_tenant_predicate(tenant_id) ON app.tickets AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_tenant_predicate(tenant_id) ON app.tickets AFTER UPDATE,

    ADD FILTER PREDICATE security.fn_tenant_predicate(tenant_id) ON app.invoices,
    ADD BLOCK  PREDICATE security.fn_tenant_predicate(tenant_id) ON app.invoices AFTER INSERT,
    ADD BLOCK  PREDICATE security.fn_tenant_predicate(tenant_id) ON app.invoices AFTER UPDATE
WITH (STATE = ON, SCHEMABINDING = ON);
GO
