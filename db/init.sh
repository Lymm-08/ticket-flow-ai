#!/bin/bash
set -eu

DB_NAME="${DB_NAME:-CentralAutomacao}"
case "$DB_NAME" in
  ""|*[!A-Za-z0-9_]*)
    echo "DB_NAME deve conter somente letras, números e sublinhados." >&2
    exit 1
    ;;
esac

if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then
  SQLCMD=/opt/mssql-tools18/bin/sqlcmd
elif [ -x /opt/mssql-tools/bin/sqlcmd ]; then
  SQLCMD=/opt/mssql-tools/bin/sqlcmd
else
  echo "sqlcmd não foi encontrado na imagem do SQL Server." >&2
  exit 1
fi

until "$SQLCMD" -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -Q "SELECT 1" >/dev/null 2>&1; do
  echo "Aguardando SQL Server ficar disponível..."
  sleep 3
done

"$SQLCMD" -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b \
  -Q "IF DB_ID(N'$DB_NAME') IS NULL CREATE DATABASE [$DB_NAME]"

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

"$SQLCMD" -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -d "$DB_NAME" -i /scripts/01_schema.sql
"$SQLCMD" -S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -d "$DB_NAME" -i /scripts/02_seed.sql
echo "Schema e categorias inicializados em $DB_NAME."
