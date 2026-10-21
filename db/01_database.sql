/* =====================================================================
   01_database.sql — create the demo database and its schemas
   ---------------------------------------------------------------------
   Schemas:
     app       tenant-owned business data  (protected by RLS)
     platform  platform-level data: users, audit log (NOT tenant data)
     security  RLS predicate functions + security policy
   ===================================================================== */
IF DB_ID(N'NexusDemo') IS NULL
    CREATE DATABASE NexusDemo;
GO

USE NexusDemo;
GO

IF SCHEMA_ID(N'app') IS NULL      EXEC (N'CREATE SCHEMA app');
IF SCHEMA_ID(N'platform') IS NULL EXEC (N'CREATE SCHEMA platform');
IF SCHEMA_ID(N'security') IS NULL EXEC (N'CREATE SCHEMA security');
GO
