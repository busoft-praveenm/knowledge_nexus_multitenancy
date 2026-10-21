/* =====================================================================
   05_logins.sql — least-privilege database identities
   ---------------------------------------------------------------------
   Run via sqlcmd with -v NEXUS_APP_PASSWORD=... etc.

   nexus_app    used by the NestJS API for normal CRUD (RLS applies)
   nexus_agent  used ONLY by the AI agent's run_sql tool:
                SELECT on schema app, nothing else (RLS applies)
   nexus_admin  platform ops: can toggle the security policy and read
                the audit log. Used by the Admin page / Attack Lab.

   None of these is db_owner or sysadmin. In PostgreSQL the equivalent
   advice is: the app role must NOT own the tables and must NOT have
   BYPASSRLS (or use FORCE ROW LEVEL SECURITY).
   ===================================================================== */
USE master;
GO
IF SUSER_ID(N'nexus_app') IS NULL
    CREATE LOGIN nexus_app   WITH PASSWORD = N'$(NEXUS_APP_PASSWORD)',   CHECK_POLICY = ON, DEFAULT_DATABASE = NexusDemo;
ELSE
    ALTER  LOGIN nexus_app   WITH PASSWORD = N'$(NEXUS_APP_PASSWORD)';
IF SUSER_ID(N'nexus_agent') IS NULL
    CREATE LOGIN nexus_agent WITH PASSWORD = N'$(NEXUS_AGENT_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = NexusDemo;
ELSE
    ALTER  LOGIN nexus_agent WITH PASSWORD = N'$(NEXUS_AGENT_PASSWORD)';
IF SUSER_ID(N'nexus_admin') IS NULL
    CREATE LOGIN nexus_admin WITH PASSWORD = N'$(NEXUS_ADMIN_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = NexusDemo;
ELSE
    ALTER  LOGIN nexus_admin WITH PASSWORD = N'$(NEXUS_ADMIN_PASSWORD)';
GO

USE NexusDemo;
GO
IF USER_ID(N'nexus_app')   IS NULL CREATE USER nexus_app   FOR LOGIN nexus_app;
IF USER_ID(N'nexus_agent') IS NULL CREATE USER nexus_agent FOR LOGIN nexus_agent;
IF USER_ID(N'nexus_admin') IS NULL CREATE USER nexus_admin FOR LOGIN nexus_admin;
GO

/* ---- nexus_app: CRUD on tenant data, read users, write audit ---- */
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::app TO nexus_app;
GRANT SELECT ON platform.app_users        TO nexus_app;
GRANT INSERT ON platform.agent_audit_log  TO nexus_app;

/* ---- nexus_agent: read-only, tenant data only ---- */
GRANT SELECT ON SCHEMA::app      TO nexus_agent;
DENY  SELECT ON SCHEMA::platform TO nexus_agent;   -- no users, no audit log
DENY  INSERT, UPDATE, DELETE, ALTER, EXECUTE ON SCHEMA::app TO nexus_agent;
DENY  VIEW DEFINITION ON SCHEMA::security TO nexus_agent;

/* ---- nexus_admin: platform ops ---- */
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::app TO nexus_admin;
GRANT SELECT ON SCHEMA::platform        TO nexus_admin;
GRANT ALTER ANY SECURITY POLICY         TO nexus_admin;
GRANT ALTER  ON SCHEMA::security        TO nexus_admin;
GRANT ALTER  ON SCHEMA::app             TO nexus_admin;   -- required to alter a policy bound to app tables
GRANT REFERENCES ON SCHEMA::security    TO nexus_admin;
GRANT VIEW DATABASE STATE               TO nexus_admin;   -- read sys.security_policies
GO
