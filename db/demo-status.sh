#!/bin/bash
set -eu

DB_NAME="${DB_NAME:-CentralAutomacao}"
SQLCMD=/opt/mssql-tools18/bin/sqlcmd
if [ ! -x "$SQLCMD" ]; then
  SQLCMD=/opt/mssql-tools/bin/sqlcmd
fi
if [ ! -x "$SQLCMD" ]; then
  echo "sqlcmd não foi encontrado na imagem do SQL Server." >&2
  exit 1
fi

attempt=0
until "$SQLCMD" -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -d "$DB_NAME" -Q "SELECT 1" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "O banco $DB_NAME não ficou disponível após 120 segundos." >&2
    exit 1
  fi
  echo "Aguardando o banco $DB_NAME ficar disponível..."
  sleep 2
done

"$SQLCMD" -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -d "$DB_NAME" -i /scripts/03_demo_status.sql
echo "Status demonstrativos e históricos inicializados em $DB_NAME."
