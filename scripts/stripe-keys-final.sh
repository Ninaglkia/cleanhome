#!/usr/bin/env bash
#
# stripe-keys-final.sh — Apply the 2 remaining LIVE keys (pk + sk).
#
# Webhook secret + price ID are already configured. This only handles:
#   - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (.env.local)
#   - STRIPE_SECRET_KEY (Supabase secrets)
#

set -euo pipefail

PROJECT_REF="tnuipmzksryfmhsctcud"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
die()   { red "✗ $*"; exit 1; }

bold "── Final 2 keys: pk_live_ + sk_live_ ──"
echo

[ -f "${ENV_FILE}" ] || die ".env.local not found"
command -v supabase >/dev/null || die "supabase CLI not installed"

prompt_key() {
  local label="$1" prefix="$2" var_name="$3"
  local value=""
  while true; do
    read -s -p "${label} (starts with ${prefix}): " value
    echo
    if [[ "${value}" == ${prefix}* ]] && [ ${#value} -ge 20 ]; then
      printf -v "${var_name}" '%s' "${value}"
      green "  ✓ accepted"
      return 0
    fi
    red "  ✗ invalid — must start with ${prefix} and be at least 20 chars"
  done
}

prompt_key "Publishable key" "pk_live_" PUB
prompt_key "Secret key"      "sk_live_" SEC

BACKUP="${ENV_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
cp "${ENV_FILE}" "${BACKUP}"
green "✓ backup: ${BACKUP}"

if grep -q "^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=" "${ENV_FILE}"; then
  sed -i '' "s|^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=.*|EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=${PUB}|" "${ENV_FILE}"
else
  echo "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=${PUB}" >> "${ENV_FILE}"
fi
green "✓ .env.local updated"

supabase secrets set --project-ref "${PROJECT_REF}" "STRIPE_SECRET_KEY=${SEC}" >/dev/null
green "✓ Supabase STRIPE_SECRET_KEY updated"

unset PUB SEC

echo
bold "── ✅ Done. CleanHome is now Stripe LIVE ──"
echo "Next: rebuild dev app — eas build --profile development --platform ios"
echo "Backup at: ${BACKUP}"
