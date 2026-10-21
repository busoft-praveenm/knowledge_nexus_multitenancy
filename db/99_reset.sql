/* 99_reset.sql — drop everything so setup can start clean */
USE master;
GO
IF DB_ID(N'NexusDemo') IS NOT NULL
BEGIN
    ALTER DATABASE NexusDemo SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE NexusDemo;
END
GO
IF SUSER_ID(N'nexus_app')   IS NOT NULL DROP LOGIN nexus_app;
IF SUSER_ID(N'nexus_agent') IS NOT NULL DROP LOGIN nexus_agent;
IF SUSER_ID(N'nexus_admin') IS NOT NULL DROP LOGIN nexus_admin;
GO
