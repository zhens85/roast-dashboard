#!/bin/bash
# deploy.sh — Good Folks Roast Dashboard
#
# BEFORE running this script, log in to Vercel:
#
#   PATH="/usr/local/bin:$PATH" \
#   /usr/local/bin/node /Users/zachhensley/.npm-global/lib/node_modules/vercel/dist/index.js login
#
# Then from this project directory:
#   bash deploy.sh

set -e

NODE="/usr/local/bin/node"
VERCEL="$NODE /Users/zachhensley/.npm-global/lib/node_modules/vercel/dist/index.js"
PROJECT_DIR="/Users/zachhensley/Claude Projects/CoffeeOrders/roast-dashboard"

# The subdomain we'll deploy to.
# goodfolks.coffee already has a live site, so we use portal.goodfolks.coffee.
# The Vercel DNS is already managing goodfolks.coffee, so no registrar changes needed.
SUBDOMAIN="portal.goodfolks.coffee"

export PATH="/usr/local/bin:$PATH"

echo ""
echo "═══════════════════════════════════════════════"
echo "  Good Folks Roast Dashboard — Deploy Script"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. Verify logged in ──────────────────────────────────────────────────────
echo "▶ Checking Vercel auth..."
WHOAMI=$($VERCEL whoami --no-color 2>&1)
if echo "$WHOAMI" | grep -q "Error\|not logged\|invalid"; then
  echo ""
  echo "  ✗ Not logged in to Vercel. Run this first, then re-run deploy.sh:"
  echo ""
  echo '      PATH="/usr/local/bin:$PATH" \'
  echo "      $VERCEL login"
  echo ""
  exit 1
fi
echo "  ✓ Logged in as: $WHOAMI"
echo ""

# ── 2. Set environment variables ─────────────────────────────────────────────
echo "▶ Pushing environment variables to Vercel..."
echo ""

cd "$PROJECT_DIR"

push_env() {
  local KEY="$1"
  local VALUE="$2"
  # Add to all three targets (--force overwrites if already exists)
  for TARGET in production preview development; do
    printf '%s' "$VALUE" | $VERCEL env add "$KEY" "$TARGET" --force --yes --no-color 2>&1 \
      | grep -v "^>" | grep -v "^Vercel" | grep -v "^\s*$" || true
  done
  echo "  ✓ $KEY"
}

# Read from .env.local
while IFS='=' read -r KEY REST; do
  [[ "$KEY" =~ ^#.*$ || -z "$KEY" ]] && continue
  VALUE="${REST%%#*}"
  VALUE="$(echo "$VALUE" | xargs)"
  [[ -z "$VALUE" ]] && continue
  push_env "$KEY" "$VALUE"
done < "$PROJECT_DIR/.env.local"

# Site URL (not in .env.local — derived from subdomain)
push_env "NEXT_PUBLIC_SITE_URL" "https://$SUBDOMAIN"

echo ""

# ── 3. Deploy to production ──────────────────────────────────────────────────
echo "▶ Deploying to Vercel (production)..."
echo "  Uploading local files directly — git not required."
echo ""

DEPLOY_OUTPUT=$($VERCEL deploy --prod --yes --no-color 2>&1)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -E "^https://" | tail -1)

if [ -z "$DEPLOY_URL" ]; then
  # Try alternate grep
  DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -E "https://roast-dashboard" | tail -1 | xargs)
fi

echo "$DEPLOY_OUTPUT" | tail -5
echo ""
echo "  ✓ Deployed to Vercel. URL: ${DEPLOY_URL:-see output above}"
echo ""

# ── 4. Add custom subdomain ───────────────────────────────────────────────────
echo "▶ Adding $SUBDOMAIN to this project..."
echo ""

$VERCEL alias set "$DEPLOY_URL" "$SUBDOMAIN" --no-color 2>&1 || \
  $VERCEL domains add "$SUBDOMAIN" --no-color 2>&1 || true

echo ""

# ── 5. Summary ────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════"
echo "  Deploy complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Your roast dashboard:"
echo "    https://$SUBDOMAIN/admin"
echo ""
echo "  Partner ordering portal:"
echo "    https://$SUBDOMAIN"
echo ""
echo "  DNS note:"
echo "    goodfolks.coffee already uses Vercel nameservers."
echo "    The $SUBDOMAIN record will be auto-created by Vercel."
echo "    No registrar changes needed."
echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚠  BEFORE sharing the admin URL:"
echo "     Change DASHBOARD_PASSWORD from 'testtest' to something strong."
echo "     vercel.com → roast-dashboard → Settings → Environment Variables"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 6. Remind about SQL migration ─────────────────────────────────────────────
echo "  SQL reminder:"
echo "    If you haven't run the product aliases migration yet:"
echo "    Supabase Dashboard → SQL Editor → run SQL/06_product_aliases.sql"
echo ""
