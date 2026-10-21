#!/usr/bin/env bash
# Creates (or with --reset, recreates) the NexusDemo database using sqlcmd.
# Reads connection settings from the root .env file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing $ROOT/.env — copy .env.example to .env and fill in MSSQL_SA_PASSWORD." >&2
  exit 1
fi
set -a; source "$ROOT/.env"; set +a

SQLCMD="${SQLCMD:-$(command -v sqlcmd || echo /opt/mssql-tools18/bin/sqlcmd)}"
SERVER="${MSSQL_HOST:-localhost},${MSSQL_PORT:-1433}"
run() {
  echo "  -> $1"
  "$SQLCMD" -S "$SERVER" -U "$MSSQL_SA_USER" -P "$MSSQL_SA_PASSWORD" -C -b -I \
    -v NEXUS_APP_PASSWORD="$NEXUS_APP_PASSWORD" \
       NEXUS_AGENT_PASSWORD="$NEXUS_AGENT_PASSWORD" \
       NEXUS_ADMIN_PASSWORD="$NEXUS_ADMIN_PASSWORD" \
    -i "$ROOT/db/$1" > /dev/null
}

if [[ "${1:-}" == "--reset" ]] || "$SQLCMD" -S "$SERVER" -U "$MSSQL_SA_USER" -P "$MSSQL_SA_PASSWORD" -C -h -1 -W \
     -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID('NexusDemo') IS NULL THEN 0 ELSE 1 END" | grep -q '^1$'; then
  echo "Dropping existing NexusDemo database..."
  run 99_reset.sql
fi

echo "Creating NexusDemo..."
for f in 01_database.sql 02_schema.sql 03_seed.sql 04_rls.sql 05_logins.sql; do run "$f"; done
echo "Done. Database NexusDemo is ready (RLS policy security.TenantIsolation is ON)."
