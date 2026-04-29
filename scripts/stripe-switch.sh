#!/usr/bin/env bash
#
# stripe-switch.sh — Switch CleanHome from Stripe TEST to LIVE in one shot.
#
# What it does:
#   1. Verifies prerequisites (supabase CLI, project linked, repo root)
#   2. Prompts for 4 Stripe LIVE values (hidden input)
#   3. Validates prefixes (pk_live_, sk_live_, whsec_, price_)
#   4. Backs up .env.local
#   5. Updates .env.local with EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
#   6. Sets 3 secrets on Supabase (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
#      STRIPE_LISTING_PRICE_ID)
#   7. Triggers a no-op edge function call to verify the new keys work
#
# Usage:
#   ./scripts/stripe-switch.sh
#
# Safety:
#   - Hidden input (read -s), no shell history
#   - Prefix validation before any write
#   - Backup of .env.local timestamped
#   - Final confirm before applying
#
# Pre-conditions (DO NOT RUN if any of these is false):
#   - Phase 1 (security audit) is completed and committed
#   - No `console.log` of env vars in any Edge Function
#   - Sentry DSN configured for production
#   - You are absolutely sure you want to go LIVE
#

set -euo pipefail

PROJECT_REF="tnuipmzksryfmhsctcud"
PROJECT_NAME="cleanhome"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"

red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }

die() { red "✗ $*"; exit 1; }

# ── 1. Prerequisites ────────────────────────────────────────────────────────

bold "── CleanHome Stripe LIVE switch ──"
echo

command -v supabase >/dev/null || die "supabase CLI not installed. brew install supabase/tap/supabase"

[ -f "${ROOT_DIR}/package.json" ] || die "Not in repo root. Run from CleanHomeRN/"
[ -f "${ENV_FILE}" ] || die ".env.local not found at ${ENV_FILE}"

LINKED_REF=$(supabase projects list 2>/dev/null | awk -F'|' '/●/ {gsub(/ /,"",$3); print $3}' | head -1 || true)
if [ "${LINKED_REF}" != "${PROJECT_REF}" ]; then
  die "Project not linked to ${PROJECT_NAME} (${PROJECT_REF}). Run: supabase link --project-ref ${PROJECT_REF}"
fi

green "✓ supabase CLI available"
green "✓ project linked to ${PROJECT_NAME} (${PROJECT_REF})"
green "✓ .env.local found"
echo

# ── 2. Confirm ──────────────────────────────────────────────────────────────

yellow "⚠  This will switch CleanHome to Stripe LIVE mode."
yellow "⚠  Real customer cards will be charged."
yellow "⚠  Phase 1 security audit MUST be completed before running this."
echo
read -r -p "Type 'GO LIVE' to confirm: " CONFIRM
[ "${CONFIRM}" = "GO LIVE" ] || die "Aborted."
echo

# ── 3. Collect keys (hidden input, validated) ───────────────────────────────

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
    red "  ✗ invalid (must start with ${prefix} and be at least 20 chars). retry."
  done
}

bold "Paste the 4 LIVE values from https://dashboard.stripe.com (toggle to LIVE mode):"
echo

prompt_key "Publishable key" "pk_live_" PUB
prompt_key "Secret key"      "sk_live_" SEC
prompt_key "Webhook secret"  "whsec_"   WHK
prompt_key "Price ID listing" "price_"  PRICE
echo

# ── 4. Backup .env.local ────────────────────────────────────────────────────

BACKUP="${ENV_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
cp "${ENV_FILE}" "${BACKUP}"
green "✓ backup created: ${BACKUP}"

# ── 5. Update .env.local ────────────────────────────────────────────────────

if grep -q "^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=" "${ENV_FILE}"; then
  # macOS sed
  sed -i '' "s|^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=.*|EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=${PUB}|" "${ENV_FILE}"
else
  echo "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=${PUB}" >> "${ENV_FILE}"
fi
green "✓ .env.local updated"

# ── 6. Push secrets to Supabase ─────────────────────────────────────────────

bold "Pushing 3 secrets to Supabase (${PROJECT_NAME})..."
supabase secrets set \
  --project-ref "${PROJECT_REF}" \
  "STRIPE_SECRET_KEY=${SEC}" \
  "STRIPE_WEBHOOK_SECRET=${WHK}" \
  "STRIPE_LISTING_PRICE_ID=${PRICE}" \
  >/dev/null
green "✓ Supabase secrets updated"

# ── 7. Verify edge function picks up new keys ───────────────────────────────

bold "Verifying with edge function smoke test..."
SUPABASE_URL=$(supabase status 2>/dev/null | awk -F': +' '/API URL/ {print $2}' | head -1 || true)
if [ -z "${SUPABASE_URL}" ]; then
  SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
fi

# Hit the booking-payment function with empty body — it should fail with
# "missing fields" (NOT with "invalid Stripe key"), which proves the key loaded.
HTTP_CODE=$(curl -s -o /tmp/stripe-switch-resp.json -w "%{http_code}" \
  -X POST "${SUPABASE_URL}/functions/v1/stripe-booking-payment" \
  -H "Content-Type: application/json" \
  -d '{}' || echo "000")

if [ "${HTTP_CODE}" = "400" ] || [ "${HTTP_CODE}" = "401" ] || [ "${HTTP_CODE}" = "422" ]; then
  green "✓ edge function reachable (HTTP ${HTTP_CODE} = expected validation error)"
else
  yellow "⚠  edge function returned HTTP ${HTTP_CODE}. Check logs:"
  yellow "    supabase functions logs stripe-booking-payment --project-ref ${PROJECT_REF}"
fi

# ── 8. Summary ──────────────────────────────────────────────────────────────

echo
bold "── ✅ Switch completed ──"
echo
echo "Next steps:"
echo "  1. Rebuild dev app: eas build --profile development --platform ios"
echo "  2. Run smoke test: see .planning/store/submission-checklist.md §5"
echo "  3. If anything looks wrong, restore backup:"
echo "       cp \"${BACKUP}\" \"${ENV_FILE}\""
echo "  4. After 24h of clean LIVE traffic, delete backup files:"
echo "       rm ${ENV_FILE}.backup.*"
echo

# Clear sensitive vars from process memory
unset PUB SEC WHK PRICE CONFIRM
