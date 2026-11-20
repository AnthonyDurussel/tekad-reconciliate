#!/usr/bin/env bash
# Creates, once per environment, the Azure identities GitHub Actions signs in
# with through OIDC (federated credentials): no client secret is stored
# anywhere, GitHub's short-lived token is exchanged for an Azure one.
#
#   infra/scripts/github-oidc.sh <staging|production> <subscription-id> [location]
#
# Run by a person who is Owner (or User Access Administrator) of the
# subscription, logged in with `az login` to the environment's tenant.
# Idempotent: run it again to repair a missing piece.
#
# Two user-assigned managed identities, in the environment's resource group:
#
#   id-github-tekad-frais-<env>          deploy.yml / release.yml
#     GitHub environment <env>
#     Contributor on the resource group. Its Key Vault Secrets Officer role is
#     granted by main.bicep (AZURE_PRINCIPAL_ID), not here: a second, identical
#     assignment under another name makes `azd provision` fail with
#     RoleAssignmentExists. Run provision.yml once before the first deploy.
#
#   id-github-tekad-frais-<env>-infra    provision.yml (azd provision)
#     GitHub environment <env>-infra
#     Contributor on the resource group (main.bicep is a resource-group
#     deployment into the group created here), and Role Based Access
#     Control Administrator on it, limited to granting or removing the Key
#     Vault roles main.bicep assigns. With an existing PostgreSQL server
#     (POSTGRESQL_EXISTING_SERVER_ID in infra/env/<env>.env), Contributor on
#     the server's resource group too. Nothing at subscription scope: a
#     Contributor role there, left by an earlier version, is removed.
#
# The federated subject is the GitHub environment
# (repo:<org>/<repo>:environment:<env>): a job that declares `environment:`
# presents that subject, not its branch. With GitHub's immutable subjects
# (repo:<org>@<id>/<repo>@<id>:…), the prefix is read from the repository's
# OIDC settings through `gh`.
#
# At the end it creates the two GitHub environments and gives them the
# identifiers (not secrets) azure/login and azd need, with `gh` (logged in as
# an admin of the repository); without `gh`, it prints the commands instead.
set -euo pipefail

env="${1:?usage: github-oidc.sh <staging|production> <subscription-id> [location]}"
subscription="${2:?usage: github-oidc.sh <staging|production> <subscription-id> [location]}"
location="${3:-switzerlandnorth}"
repo="${GITHUB_REPOSITORY:-AnthonyDurussel/tekad-reconciliate}"
issuer="https://token.actions.githubusercontent.com"
audience="api://AzureADTokenExchange"
subject_prefix="repo:$repo"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  subject_prefix="$(gh api "repos/$repo/actions/oidc/customization/sub" --jq '.sub_claim_prefix // empty' 2>/dev/null || true)"
  subject_prefix="${subject_prefix:-repo:$repo}"
fi

root="$(cd "$(dirname "$0")/../.." && pwd)"
deploy_env="$root/deploy/env/$env/deploy.env"
[[ -f "$deploy_env" ]] || { echo "missing $deploy_env" >&2; exit 1; }
RG="$(grep -E '^RG=' "$deploy_env" | cut -d= -f2-)"
[[ -n "$RG" ]] || { echo "RG is not set in $deploy_env" >&2; exit 1; }

# Key Vault roles main.bicep assigns (app/keyvault.bicep, app/function.bicep):
# Secrets User to the Function App, Secrets Officer to the deploy identity.
KV_SECRETS_USER="4633458b-17de-408a-b874-0445c86b69e6"
KV_SECRETS_OFFICER="b86a8fe4-44ce-4948-aee5-eccb2c155cd7"

az account set --subscription "$subscription"
tenant="$(az account show --query tenantId -o tsv)"
# The environment's resource group: the identities live in it and Provision deploys into it.
az group create -n "$RG" -l "$location" --tags "azd-env-name=$env" "application=tekad-frais" -o none
rg_id="$(az group show -n "$RG" --query id -o tsv)"

# Fails before anything is written when the caller cannot create the
# identities nor grant the roles (Owner, or User Access Administrator +
# Contributor, on the subscription).
me="$(az ad signed-in-user show --query id -o tsv)"
my_roles="$(az role assignment list --assignee "$me" --all --include-inherited --include-groups \
  --query "[?scope=='/subscriptions/$subscription' || scope=='/'].roleDefinitionName" -o tsv)"
if ! grep -qx "Owner" <<<"$my_roles" &&
  ! { grep -qx "User Access Administrator" <<<"$my_roles" && grep -qx "Contributor" <<<"$my_roles"; }; then
  echo "$(az account show --query user.name -o tsv) needs Owner on subscription $subscription" >&2
  has="${my_roles//$'\n'/, }"
  echo "(has at subscription scope: ${has:-nothing})" >&2
  exit 1
fi

# identity <name> <github environment>: creates the identity and its
# federated credential. Not run in a command substitution, so `set -e` stops
# the script at the first failure.
identity() {
  local name="$1" github_env="$2"
  az identity create -g "$RG" -n "$name" -l "$location" \
    --tags "purpose=github-actions" "repository=$repo" -o none
  local subject="$subject_prefix:environment:$github_env"
  if az identity federated-credential show -g "$RG" --identity-name "$name" -n github >/dev/null 2>&1; then
    az identity federated-credential update -g "$RG" --identity-name "$name" -n github \
      --issuer "$issuer" --subject "$subject" --audiences "$audience" -o none
  else
    az identity federated-credential create -g "$RG" --identity-name "$name" -n github \
      --issuer "$issuer" --subject "$subject" --audiences "$audience" -o none
  fi
  echo "federated $name <- $subject" >&2
}

# ids <name> -> prints "clientId principalId"
ids() {
  az identity show -g "$RG" -n "$1" --query '[clientId, principalId]' -o tsv | tr '\n' ' '
}

# grant <principal> <role> <scope> [condition]
grant() {
  local principal="$1" role="$2" scope="$3" condition="${4:-}"
  local existing
  existing="$(az role assignment list --assignee "$principal" --role "$role" --scope "$scope" --query '[0].id' -o tsv)"
  if [[ -n "$existing" ]]; then
    echo "already: $role on ${scope##*/}" >&2
    return
  fi
  local args=(--assignee-object-id "$principal" --assignee-principal-type ServicePrincipal
    --role "$role" --scope "$scope" -o none)
  [[ -n "$condition" ]] && args+=(--condition "$condition" --condition-version 2.0)
  # A brand-new identity can take a few seconds to reach Entra's replicas.
  for _ in 1 2 3 4 5 6; do
    az role assignment create "${args[@]}" && { echo "granted: $role on ${scope##*/}" >&2; return; }
    sleep 10
  done
  echo "could not grant $role" >&2
  exit 1
}

identity "id-github-tekad-frais-$env" "$env"
identity "id-github-tekad-frais-$env-infra" "$env-infra"
read -r deploy_client deploy_principal <<<"$(ids "id-github-tekad-frais-$env")"
read -r infra_client infra_principal <<<"$(ids "id-github-tekad-frais-$env-infra")"
[[ -n "$deploy_principal" && -n "$infra_principal" ]] || { echo "could not read the identities' ids" >&2; exit 1; }

grant "$deploy_principal" "Contributor" "$rg_id"

grant "$infra_principal" "Contributor" "$rg_id"
# /subscriptions/<id>/resourceGroups/<rg>/providers/…: main.bicep deploys the database there.
postgres_server="$(grep -E '^POSTGRESQL_EXISTING_SERVER_ID=' "$root/infra/env/$env.env" | cut -d= -f2- || true)"
if [[ -n "$postgres_server" ]]; then
  grant "$infra_principal" "Contributor" "$(cut -d/ -f1-5 <<<"$postgres_server")"
fi
old="$(az role assignment list --assignee "$infra_principal" --role Contributor \
  --scope "/subscriptions/$subscription" --query "[?scope=='/subscriptions/$subscription'].id" -o tsv)"
if [[ -n "$old" ]]; then
  while IFS= read -r id; do
    az role assignment delete --ids "$id" -o none
  done <<<"$old"
  echo "removed: Contributor on the subscription" >&2
fi
kv_roles="$KV_SECRETS_USER, $KV_SECRETS_OFFICER"
condition="((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$kv_roles})) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$kv_roles}))"
grant "$infra_principal" "Role Based Access Control Administrator" "$rg_id" "$condition"

# github_env <github environment> <client id>: the environment and its variables.
# AZURE_PRINCIPAL_ID of <env>-infra is the *deploy* identity on purpose:
# provision.yml passes it to main.bicep, which grants it Key Vault Secrets Officer.
github_env() {
  gh api -X PUT "repos/$repo/environments/$1" --silent
  gh variable set AZURE_CLIENT_ID --repo "$repo" --env "$1" --body "$2"
  gh variable set AZURE_PRINCIPAL_ID --repo "$repo" --env "$1" --body "$deploy_principal"
  gh variable set AZURE_TENANT_ID --repo "$repo" --env "$1" --body "$tenant"
  gh variable set AZURE_SUBSCRIPTION_ID --repo "$repo" --env "$1" --body "$subscription"
  echo "github environment $1 ready" >&2
}

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  github_env "$env" "$deploy_client"
  github_env "$env-infra" "$infra_client"
  echo "Done." >&2
  exit 0
fi

cat <<EOF

Done. gh is not logged in: create the two GitHub environments, then give them
their identifiers (not secrets):

gh api -X PUT repos/$repo/environments/$env --silent
gh api -X PUT repos/$repo/environments/$env-infra --silent

gh variable set AZURE_CLIENT_ID       --repo $repo --env $env --body $deploy_client
gh variable set AZURE_PRINCIPAL_ID    --repo $repo --env $env --body $deploy_principal
gh variable set AZURE_TENANT_ID       --repo $repo --env $env --body $tenant
gh variable set AZURE_SUBSCRIPTION_ID --repo $repo --env $env --body $subscription

gh variable set AZURE_CLIENT_ID       --repo $repo --env $env-infra --body $infra_client
gh variable set AZURE_PRINCIPAL_ID    --repo $repo --env $env-infra --body $deploy_principal
gh variable set AZURE_TENANT_ID       --repo $repo --env $env-infra --body $tenant
gh variable set AZURE_SUBSCRIPTION_ID --repo $repo --env $env-infra --body $subscription

(AZURE_PRINCIPAL_ID of <env>-infra is the *deploy* identity on purpose:
provision.yml passes it to main.bicep, which grants it Key Vault Secrets Officer.)
EOF
