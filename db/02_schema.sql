/* =====================================================================
   02_schema.sql — shared-schema multi-tenant tables
   ---------------------------------------------------------------------
   Pool model: every tenant lives in the SAME tables, discriminated by
   tenant_id. Every index leads with tenant_id so the RLS predicate
   (tenant_id = @current_tenant) is a cheap seek, not a scan.
   ===================================================================== */
USE NexusDemo;
GO

/* ---------- tenant-owned data (schema: app) ---------- */
CREATE TABLE app.tenants (
    tenant_id   INT            NOT NULL PRIMARY KEY,
    name        NVARCHAR(100)  NOT NULL,
    slug        NVARCHAR(50)   NOT NULL UNIQUE,
    industry    NVARCHAR(50)   NOT NULL,
    [plan]      NVARCHAR(20)   NOT NULL,
    created_at  DATETIME2(0)   NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE app.customers (
    customer_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY NONCLUSTERED,
    tenant_id     INT            NOT NULL REFERENCES app.tenants(tenant_id),
    name          NVARCHAR(100)  NOT NULL,
    email         NVARCHAR(150)  NOT NULL,
    phone         NVARCHAR(30)   NULL,
    city          NVARCHAR(60)   NULL,
    tier          NVARCHAR(20)   NOT NULL DEFAULT N'Standard',
    created_at    DATETIME2(0)   NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE CLUSTERED INDEX cx_customers_tenant ON app.customers (tenant_id, customer_id);

CREATE TABLE app.tickets (
    ticket_id     INT IDENTITY(1000,1) NOT NULL PRIMARY KEY NONCLUSTERED,
    tenant_id     INT            NOT NULL REFERENCES app.tenants(tenant_id),
    customer_id   INT            NOT NULL REFERENCES app.customers(customer_id),
    subject       NVARCHAR(200)  NOT NULL,
    body          NVARCHAR(MAX)  NOT NULL,
    status        NVARCHAR(20)   NOT NULL DEFAULT N'Open',      -- Open | In Progress | Resolved | Closed
    priority      NVARCHAR(10)   NOT NULL DEFAULT N'Medium',    -- Low | Medium | High | Urgent
    created_at    DATETIME2(0)   NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE CLUSTERED INDEX cx_tickets_tenant ON app.tickets (tenant_id, ticket_id);
CREATE INDEX ix_tickets_tenant_status ON app.tickets (tenant_id, status);

CREATE TABLE app.invoices (
    invoice_id    INT IDENTITY(1,1) NOT NULL PRIMARY KEY NONCLUSTERED,
    tenant_id     INT            NOT NULL REFERENCES app.tenants(tenant_id),
    customer_id   INT            NOT NULL REFERENCES app.customers(customer_id),
    invoice_no    NVARCHAR(30)   NOT NULL,
    amount        DECIMAL(12,2)  NOT NULL,
    currency      CHAR(3)        NOT NULL DEFAULT 'USD',
    status        NVARCHAR(20)   NOT NULL,                      -- Paid | Unpaid | Overdue
    issued_on     DATE           NOT NULL,
    due_on        DATE           NOT NULL
);
CREATE CLUSTERED INDEX cx_invoices_tenant ON app.invoices (tenant_id, invoice_id);
CREATE INDEX ix_invoices_tenant_status ON app.invoices (tenant_id, status);
GO

/* ---------- platform data (schema: platform) — never exposed to the agent ---------- */
CREATE TABLE platform.app_users (
    user_id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    tenant_id     INT            NULL REFERENCES app.tenants(tenant_id),  -- NULL = platform staff
    email         NVARCHAR(150)  NOT NULL UNIQUE,
    display_name  NVARCHAR(100)  NOT NULL,
    role          NVARCHAR(30)   NOT NULL,   -- tenant_admin | agent_user | platform_admin
    avatar_color  CHAR(7)        NOT NULL DEFAULT '#6366F1'
);

CREATE TABLE platform.agent_audit_log (
    audit_id      BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    at_utc        DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    tenant_id     INT            NULL,
    user_id       INT            NULL,
    source        NVARCHAR(20)   NOT NULL,   -- agent-llm | agent-scripted | attack-lab | data-api
    prompt        NVARCHAR(MAX)  NULL,
    sql_text      NVARCHAR(MAX)  NOT NULL,
    row_count     INT            NULL,
    outcome       NVARCHAR(20)   NOT NULL,   -- ok | blocked-guard | blocked-database | error
    error_message NVARCHAR(MAX)  NULL,
    rls_enabled   BIT            NOT NULL,
    duration_ms   INT            NULL
);
CREATE INDEX ix_audit_tenant_time ON platform.agent_audit_log (tenant_id, at_utc DESC);
GO
