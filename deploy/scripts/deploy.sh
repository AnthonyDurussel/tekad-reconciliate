#!/usr/bin/env bash
# Deploys a published release of Tekad · Réconciliation des frais (assets function-app.zip and frontend-dist.tar.gz of the GitHub
# release VERSION) to one environment. Run by .github/workflows/deploy.yml, or by hand:
#
#   az login && gh auth login
#   deploy/scripts/deploy.sh <staging|production> v1.2.3
#
# In this order (docs/DEPLOYMENT.md — zero downtime):
#   1. migrations (expand/contract: the running release keeps working on the new schema);
#   2. the administrator account (ADMIN_EMAIL in Key Vault, if any), then — SEED=true only — the
#      reference lists of the workbook — locations, grades, machines (idempotent);
#   3. app settings: deploy/env/<env>/appsettings.json — plain values, and the secrets it lists
#      (keyVaultSecret) as Key Vault references —, the release's version and commit;
#   4. the Function App package (rolling update);
#   5. the SPA, its Entra sign-in (tenant, client id and secret from Key Vault) and its
#      configuration (the previous SPA talks to the new API for a while, never the reverse);
#   6. a check that the public /api/health answers the new version.
set -euo pipefail

env="${1:?usage: deploy.sh <staging|production> <version>}"
version="${2:?usage: deploy.sh <staging|production> <version>}"
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]] || { echo "version must be a release tag (v1.2.3), got '$version'" >&2; exit 1; }

here="$(cd "$(dirname "$0")/.." && pwd)"
config="$here/env/$env"
[[ -f "$config/deploy.env" ]] || { echo "unknown environment $env" >&2; exit 1; }
# shellcheck disable=SC1091
source "$config/deploy.env"
: "${RG:?RG missing in deploy.env}" "${PUBLIC_URL:?PUBLIC_URL missing in deploy.env}"
repo="${GITHUB_REPOSITORY:-AnthonyDurussel/tekad-reconciliate}"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

log "Resources of $RG"
func="$(az functionapp list -g "$RG" --query "[?tags.\"azd-service-name\"=='api'].name | [0]" -o tsv)"
swa="$(az staticwebapp list -g "$RG" --query "[?tags.\"azd-service-name\"=='frontend'].name | [0]" -o tsv)"
vault="$(az keyvault list -g "$RG" --query '[0].name' -o tsv)"
[[ -n "$func" && -n "$swa" && -n "$vault" ]] || { echo "Function App, Static Web App or Key Vault missing in $RG: run Provision first" >&2; exit 1; }
echo "Function App $func, Static Web App $swa, Key Vault $vault"

work="$here/dist"
rm -rf "$work" && mkdir -p "$work/function-app" "$work/frontend-dist"
log "Release $version"
gh release download "$version" --repo "$repo" --dir "$work" --pattern function-app.zip --pattern frontend-dist.tar.gz
unzip -q "$work/function-app.zip" -d "$work/function-app"
tar -xzf "$work/frontend-dist.tar.gz" -C "$work/frontend-dist"
commit="$(git -C "$here" rev-list -n 1 "$version" 2>/dev/null || true)"

secret() { az keyvault secret show --vault-name "$vault" -n "$1" --query value -o tsv 2>/dev/null || true; }

log "Migrations"
DATABASE_URL="$(secret POSTGRES-CONNECTION-STRING)"
[[ -n "$DATABASE_URL" ]] || { echo "POSTGRES-CONNECTION-STRING missing in $vault" >&2; exit 1; }
[[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::add-mask::$DATABASE_URL"
export DATABASE_URL
(cd "$here" && pnpm exec prisma migrate deploy --schema "$work/function-app/prisma/schema.prisma")

admin="$(secret ADMIN-EMAIL)"
if [[ -n "$admin" ]]; then
  log "Administrator"
  (cd "$work/function-app" && ADMIN_EMAIL="$admin" node dist/ensure-admin.cjs)
fi
if [[ "${SEED:-false}" == "true" ]]; then
  # Journées de démonstration : jamais en production.
  demo=true
  [[ "$env" == "production" ]] && demo=false
  log "Seed (référentiels ; journées de démonstration : $demo)"
  (cd "$work/function-app" && SEED_DEMO="$demo" node dist/seed.cjs)
fi
unset DATABASE_URL

log "App settings"
settings="$work/appsettings.json"
# appsettings.json is the whole list: a plain value, or "keyVaultSecret" for a secret synced from
# 1Password (op-env.sh), which becomes a Key Vault reference. A secret of the note that the file
# does not list is not given to the Function App; a listed secret missing from the vault is left
# out (optional feature not configured) with a warning.
az keyvault secret list --vault-name "$vault" --query "[].name" -o json >"$work/secrets.json"
python3 -I - "$config/appsettings.json" "$work/secrets.json" "$vault" "${version#v}" "$commit" >"$settings" <<'PY'
import json, os, sys
settings_file, secrets_file, vault, version, commit = sys.argv[1:6]
in_vault = {name.lower() for name in json.load(open(secrets_file))}
annotate = "GITHUB_ACTIONS" in os.environ
settings = {}
for s in json.load(open(settings_file)):
    secret = s.get("keyVaultSecret")
    if secret is None:
        settings[s["name"]] = s["value"]
    elif secret.lower() in in_vault:
        settings[s["name"]] = f"@Microsoft.KeyVault(VaultName={vault};SecretName={secret})"
    else:
        message = f"{s['name']}: secret {secret} not in {vault}, setting left out"
        print(f"::warning::{message}" if annotate else f"warning: {message}", file=sys.stderr)
settings["APP_VERSION"] = version
if commit:
    settings["GIT_SHA"] = commit
print(json.dumps([{"name": k, "value": v, "slotSetting": False} for k, v in sorted(settings.items())]))
PY
az functionapp config appsettings set -g "$RG" -n "$func" --settings "@$settings" --output none
# A Key Vault reference no longer produced (removed from appsettings.json, or its secret from the
# vault) is removed; settings Provision writes (storage, Application Insights, DATABASE_ENTRA_URL…)
# are never Key Vault references and stay.
# No mapfile: deploy.sh also runs by hand on macOS (bash 3.2).
stale=()
while IFS= read -r name; do stale+=("$name"); done < <(az functionapp config appsettings list -g "$RG" -n "$func" -o json |
  python3 -I -c 'import json, sys
wanted = {s["name"] for s in json.load(open(sys.argv[1]))}
for s in json.load(sys.stdin):
    if s["value"] and s["value"].startswith("@Microsoft.KeyVault(") and s["name"] not in wanted:
        print(s["name"])' "$settings")
if [[ ${#stale[@]} -gt 0 ]]; then
  echo "Removing ${stale[*]}"
  az functionapp config appsettings delete -g "$RG" -n "$func" --setting-names "${stale[@]}" --output none
fi

log "Function App package"
az functionapp deployment source config-zip -g "$RG" -n "$func" --src "$work/function-app.zip" --output none

log "Static Web App"
# Entra sign-in of the Static Web App (custom provider, staticwebapp.config.json): the tenant goes
# into the config file, the app registration's id and secret into the Static Web App's settings
# (clientIdSettingName / clientSecretSettingName).
tenant="$(secret ENTRA-TENANT-ID)"
client_id="$(secret ENTRA-CLIENT-ID)"
client_secret="$(secret ENTRA-CLIENT-SECRET)"
[[ -n "$tenant" && -n "$client_id" && -n "$client_secret" ]] || {
  echo "ENTRA_TENANT_ID, ENTRA_CLIENT_ID or ENTRA_CLIENT_SECRET missing in $vault (1Password note …$env.deploy)" >&2
  exit 1
}
[[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::add-mask::$client_secret"
sed "s/__ENTRA_TENANT_ID__/$tenant/g" "$config/staticwebapp.config.json" >"$work/frontend-dist/staticwebapp.config.json"
az staticwebapp appsettings set -g "$RG" -n "$swa" \
  --setting-names "ENTRA_CLIENT_ID=$client_id" "ENTRA_CLIENT_SECRET=$client_secret" --output none
token="$(az staticwebapp secrets list -g "$RG" -n "$swa" --query properties.apiKey -o tsv)"
[[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::add-mask::$token"
(cd "$here" && pnpm exec swa deploy "$work/frontend-dist" --deployment-token "$token" --env production)

log "Health"
for attempt in $(seq 1 30); do
  # No -f: a 503 (status degraded, e.g. db error) keeps its body, so the log says why.
  body="$(curl -sS --max-time 20 "$PUBLIC_URL/api/health" 2>&1 || true)"
  if [[ "$body" == *"\"status\":\"ok\""* && "$body" == *"\"version\":\"${version#v}\""* ]]; then
    echo "$PUBLIC_URL answers $version: $body"
    exit 0
  fi
  echo "waiting for $version ($attempt/30): ${body:-no answer}"
  sleep 10
done
echo "$PUBLIC_URL does not answer $version after 5 minutes" >&2
exit 1
