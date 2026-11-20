#!/usr/bin/env bash
# Lets the Function App sign in to PostgreSQL with its managed identity (DATABASE_ENTRA_URL,
# set by infra/main.bicep), once per environment, after the first `Provision` and before the
# first deployment.
#
#   infra/scripts/postgres-entra-roles.sh <staging|production> <subscription-id>
#
# Prerequisites:
#   - you are the server's Entra administrator (POSTGRESQL_ENTRA_ADMIN_* of the provision
#     note), logged in with `az login`; when the administrator is a group, set PGUSER to the
#     group's name;
#   - you can read the environment's Key Vault (POSTGRES-CONNECTION-STRING) or, failing that,
#     assign roles on it (Owner / User Access Administrator): the script then grants you
#     « Key Vault Secrets User » on the vault for the time of the run and removes it on exit;
#   - psql and python3.
#
# Step 1, as the Entra administrator on the `postgres` database: the Postgres role of the
#   Function App's identity, named after the Function App (pgaadauth_create_principal_with_oid).
# Step 2, as the database owner (connection string from Key Vault): data access only on schema
#   public — SELECT/INSERT/UPDATE/DELETE, sequences, functions — on what exists and, through
#   default privileges, on what future migrations create (they run as that owner). No DDL: the
#   API never changes the schema.
#
# Idempotent.
set -euo pipefail

env="${1:?usage: postgres-entra-roles.sh <staging|production> <subscription-id>}"
subscription="${2:?usage: postgres-entra-roles.sh <staging|production> <subscription-id>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
RG="$(grep -E '^RG=' "$root/deploy/env/$env/deploy.env" | cut -d= -f2-)"

az account set --subscription "$subscription"
func="$(az functionapp list -g "$RG" --query "[?tags.\"azd-service-name\"=='api'].name | [0]" -o tsv)"
[[ -n "$func" ]] || { echo "No Function App in $RG: run Provision first" >&2; exit 1; }
entra_url="$(az functionapp config appsettings list -g "$RG" -n "$func" \
  --query "[?name=='DATABASE_ENTRA_URL'].value | [0]" -o tsv)"
read -r role host database <<<"$(python3 -I -c 'import sys
from urllib.parse import urlsplit, unquote
u = urlsplit(sys.argv[1])
print(unquote(u.username), u.hostname, unquote(u.path.lstrip("/")))' "$entra_url")"
object_id="$(az functionapp identity show -g "$RG" -n "$func" --query principalId -o tsv)"

echo "Step 1: Postgres role \"$role\" for $func's identity ($object_id) on $host"
admin="${PGUSER:-$(az ad signed-in-user show --query userPrincipalName -o tsv)}"
PGPASSWORD="$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)" \
  psql "host=$host port=5432 dbname=postgres user=$admin sslmode=require" \
  -v ON_ERROR_STOP=1 -q -v role="$role" -v oid="$object_id" <<'SQL'
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') AS role_exists \gset
\if :role_exists
  \echo role already exists
\else
  SELECT pgaadauth_create_principal_with_oid(:'role', :'oid', 'service', false, false);
\endif
SQL

echo "Step 2: data access on $database, granted by the owner"
vault="$(az keyvault list -g "$RG" --query '[0].name' -o tsv)"
read_owner_url() {
  az keyvault secret show --vault-name "$vault" -n POSTGRES-CONNECTION-STRING --query value -o tsv 2>/dev/null
}
if ! owner_url="$(read_owner_url)"; then
  # No read access on the vault (RBAC): a temporary role for the signed-in user, removed on exit.
  me="$(az ad signed-in-user show --query id -o tsv)"
  vault_id="$(az keyvault show -n "$vault" --query id -o tsv)"
  echo "  temporary « Key Vault Secrets User » on $vault for $me"
  assignment="$(az role assignment create --assignee-object-id "$me" --assignee-principal-type User \
    --role "Key Vault Secrets User" --scope "$vault_id" --query id -o tsv)"
  trap 'echo "  removing the temporary Key Vault role"; az role assignment delete --ids "$assignment" -o none' EXIT
  # RBAC propagation: up to a few minutes.
  for attempt in $(seq 1 30); do
    owner_url="$(read_owner_url)" && break
    [[ $attempt -lt 30 ]] || { echo "Still no access to $vault after 5 minutes" >&2; exit 1; }
    sleep 10
  done
fi
psql "$owner_url" -v ON_ERROR_STOP=1 -q -v role="$role" -v db="$database" <<'SQL'
GRANT CONNECT ON DATABASE :"db" TO :"role";
GRANT USAGE ON SCHEMA public TO :"role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"role";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO :"role";
SELECT count(*) AS tables_granted
  FROM information_schema.role_table_grants
 WHERE grantee = :'role' AND table_schema = 'public' AND privilege_type = 'SELECT';
SQL

echo "Done: $func signs in to $host with its identity."
