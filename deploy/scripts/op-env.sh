#!/usr/bin/env bash
# Reads a KEY=VALUE note from 1Password (op CLI, OP_SERVICE_ACCOUNT_TOKEN set)
# and hands its variables to the rest of a GitHub Actions job.
#
#   op-env.sh env      <op://vault/item/notesPlain>
#       every variable goes to $GITHUB_ENV for the next steps.
#   op-env.sh keyvault <op://vault/item/notesPlain> <environment> <key-vault>
#       every variable is written to that Key Vault as a secret (FOO_BAR -> FOO-BAR,
#       tags source=1password and original-key=FOO_BAR); deploy.sh turns each one
#       into a Key Vault reference in the app settings, under its original name.
#
# Values whose key looks secret are masked in the job log.
set -euo pipefail

mode="${1:?mode: env | keyvault}"
reference="${2:?1Password reference}"
environment="${3:-}"
key_vault="${4:-}"

looks_secret() {
  [[ "$1" =~ (SECRET|PASSWORD|TOKEN|KEY|CONNECTION|_URL$) ]]
}

note="$(mktemp)"
trap 'rm -f "$note"' EXIT
op read "$reference" > "$note"

# `|| [[ -n $key ]]` keeps a last line without a trailing newline.
while IFS='=' read -r key value || [[ -n "${key:-}" ]]; do
  key="$(echo "$key" | xargs)"
  [[ -z "$key" || "$key" == \#* ]] && continue
  value="$(echo "$value" | sed -e "s/^[\"']//" -e "s/[\"']\$//")"
  looks_secret "$key" && echo "::add-mask::$value"

  case "$mode" in
    env)
      echo "$key=$value" >> "$GITHUB_ENV"
      echo "Loaded $key"
      ;;
    keyvault)
      if [[ -z "$key_vault" ]]; then
        echo "::error::usage: op-env.sh keyvault <reference> <environment> <key-vault>"
        exit 1
      fi
      secret_name="${key//_/-}"
      az keyvault secret set \
        --vault-name "$key_vault" \
        --name "$secret_name" \
        --value "$value" \
        --tags "environment=$environment" "source=1password" "original-key=$key" \
        --output none
      echo "Synced $key -> $secret_name"
      ;;
    *)
      echo "::error::unknown mode $mode"
      exit 1
      ;;
  esac
done < "$note"
