#!/usr/bin/env bash
# Creates or updates the Entra app registration the Static Web App signs users in with
# (docs/DEPLOYMENT.md, step 2), and prints the lines of the 1Password note
# tekad-frais-infra.<env>.deploy (ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET).
#
#   infra/scripts/entra-app.sh <staging|production> [--subscription <id>] [--new-secret] [--assignment-required]
#
#   --subscription <id>    also adds the Static Web App's default host name to the redirect URIs
#                          (looked up in the environment's resource group; needs Provision done
#                          and that subscription visible from the signed-in tenant).
#   --new-secret           adds a client secret even when the application already exists (the
#                          previous ones stay valid until they expire or are removed).
#   --assignment-required  only accounts or groups assigned to the enterprise application may sign
#                          in (« Affectation requise »).
#
# Run logged in with `az login` to the tenant whose accounts will sign in (Neuralis for staging,
# Tekad for production), as someone allowed to register applications (Application
# Developer or above). Idempotent: the application is found by its name, tekad-frais-<env>.
set -euo pipefail

usage="usage: entra-app.sh <staging|production> [--subscription <id>] [--new-secret] [--assignment-required]"
env="${1:?$usage}"
shift
subscription=""
new_secret=false
assignment_required=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --subscription) subscription="${2:?$usage}"; shift 2 ;;
    --new-secret) new_secret=true; shift ;;
    --assignment-required) assignment_required=true; shift ;;
    *) echo "$usage" >&2; exit 1 ;;
  esac
done

root="$(cd "$(dirname "$0")/../.." && pwd)"
deploy_env="$root/deploy/env/$env/deploy.env"
[[ -f "$deploy_env" ]] || { echo "missing $deploy_env" >&2; exit 1; }
RG="$(grep -E '^RG=' "$deploy_env" | cut -d= -f2-)"
PUBLIC_URL="$(grep -E '^PUBLIC_URL=' "$deploy_env" | cut -d= -f2-)"

name="tekad-frais-$env"
tenant="$(az account show --query tenantId -o tsv)"

# Redirect URIs: the public URL, plus the Static Web App's own host name when it can be found.
hosts=()
[[ -n "$PUBLIC_URL" ]] && hosts+=("${PUBLIC_URL#https://}")
if [[ -n "$subscription" ]]; then
  swa_host="$(az staticwebapp list --subscription "$subscription" -g "$RG" \
    --query '[0].defaultHostname' -o tsv 2>/dev/null || true)"
  if [[ -n "$swa_host" ]]; then
    hosts+=("$swa_host")
  else
    echo "warning: no Static Web App found in $RG (run Provision, or check the tenant): its host name is not added" >&2
  fi
fi
[[ ${#hosts[@]} -gt 0 ]] || { echo "no host name: set PUBLIC_URL in $deploy_env or pass --subscription" >&2; exit 1; }
redirects=()
# The sign-in callback, and the login page the Entra sign-out returns to (useAuth.signOut): a
# post_logout_redirect_uri must be one of the application's redirect URIs.
for host in "${hosts[@]}"; do
  redirects+=("https://${host%/}/.auth/login/aad/callback" "https://${host%/}/public/log-in")
done

# Optional claim login_hint in the ID token: /.auth/me hands it to the SPA, which passes it as
# logout_hint so the Entra sign-out closes that account's session without asking which one.
optional_claims='{"idToken":[{"name":"login_hint","essential":false}],"accessToken":[],"saml2Token":[]}'

# Microsoft Graph, delegated User.Read (the default of an app registered in the portal).
graph_user_read='[{"resourceAppId":"00000003-0000-0000-c000-000000000000","resourceAccess":[{"id":"e1fd296f-fa3b-4c03-8f60-6c4d1d7a4a5c","type":"Scope"}]}]'

app_id="$(az ad app list --display-name "$name" --query '[0].appId' -o tsv)"
created=false
if [[ -z "$app_id" ]]; then
  echo "Creating the application $name in tenant $tenant"
  app_id="$(az ad app create --display-name "$name" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
  created=true
else
  echo "Updating the application $name ($app_id) in tenant $tenant"
fi

# Keeps the redirect URIs already there (another domain added by hand), adds ours.
existing="$(az ad app show --id "$app_id" --query 'web.redirectUris' -o tsv)"
# No mapfile: macOS ships bash 3.2.
all_redirects=()
while IFS= read -r uri; do
  [[ -n "$uri" ]] && all_redirects+=("$uri")
done < <(printf '%s\n' "$existing" "${redirects[@]}" | sort -u)
az ad app update --id "$app_id" \
  --web-redirect-uris "${all_redirects[@]}" \
  --enable-id-token-issuance true \
  --required-resource-accesses "$graph_user_read" \
  --optional-claims "$optional_claims" \
  -o none
printf '  redirect URI: %s\n' "${all_redirects[@]}"

# Enterprise application (service principal): created with the app in the portal, not by the CLI.
sp_id="$(az ad sp list --filter "appId eq '$app_id'" --query '[0].id' -o tsv)"
if [[ -z "$sp_id" ]]; then
  # A new application can take a few seconds to be visible.
  for attempt in $(seq 1 12); do
    sp_id="$(az ad sp create --id "$app_id" --query id -o tsv 2>/dev/null)" && break
    [[ $attempt -lt 12 ]] || { echo "could not create the enterprise application of $app_id" >&2; exit 1; }
    sleep 5
  done
fi
if $assignment_required; then
  az ad sp update --id "$sp_id" --set appRoleAssignmentRequired=true -o none
  echo "  assignment required: assign the people or groups in Entra > Enterprise applications > $name"
fi

secret=""
# A secret at creation, with --new-secret, or when the application has none (a first run
# stopped before this point).
credentials="$(az ad app credential list --id "$app_id" --query 'length(@)' -o tsv)"
if $created || $new_secret || [[ "$credentials" == "0" ]]; then
  secret="$(az ad app credential reset --id "$app_id" --append \
    --display-name "static-web-app $(date +%Y-%m-%d)" --years 2 --query password -o tsv)"
fi

echo
echo "Lines of the 1Password note tekad-frais-infra.$env.deploy:"
echo
echo "ENTRA_TENANT_ID=$tenant"
echo "ENTRA_CLIENT_ID=$app_id"
if [[ -n "$secret" ]]; then
  echo "ENTRA_CLIENT_SECRET=$secret"
  echo
  echo "The secret is shown only now; it expires in 2 years (--new-secret to add another)."
else
  echo "ENTRA_CLIENT_SECRET=<unchanged: the one already in the note; --new-secret for a new one>"
fi
