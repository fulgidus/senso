#!/usr/bin/env bash
# seed-demo.sh - Create demo user + seed profile via questionnaire (fast path)
# Optional: also upload the Revolut CSV for transaction-based tests.
#
# Usage:
#   bash scripts/seed-demo.sh           # questionnaire only (fast, no LLM)
#   bash scripts/seed-demo.sh --with-csv # questionnaire + Revolut CSV upload

set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
DEMO_EMAIL="${DEMO_EMAIL:-demo@sen.so}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demodemo!}"
SAMPLES_DIR="$(dirname "$0")/../api/app/ingestion/samples"
WITH_CSV=false

for arg in "$@"; do
  [[ "$arg" == "--with-csv" ]] && WITH_CSV=true
done

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   S.E.N.S.O. Demo Seed Script          ║"
echo "╚════════════════════════════════════════╝"
echo ""

# ── Step 1: Wait for API ──────────────────────────────────────────────────────
echo "Waiting for API at $API_URL ..."
for i in $(seq 1 20); do
  if curl -sf "$API_URL/health" > /dev/null 2>&1; then
    ok "API is up"
    break
  fi
  if [ "$i" -eq 20 ]; then
    fail "API did not respond after 20 attempts. Run: docker compose up -d"
  fi
  sleep 2
done

# ── Step 2: Create or login demo user ────────────────────────────────────────
echo ""
echo "Creating demo user: $DEMO_EMAIL ..."

SIGNUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$DEMO_EMAIL\", \"password\": \"$DEMO_PASSWORD\"}") || true

if [ "$SIGNUP_STATUS" = "201" ]; then
  ok "Demo user created - logging in..."
fi

LOGIN_RESP=$(curl -sf -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$DEMO_EMAIL\", \"password\": \"$DEMO_PASSWORD\"}") \
  || fail "Login failed. Run reset-demo.sh first if the account is in a bad state."

ACCESS_TOKEN=$(echo "$LOGIN_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken') or d.get('access_token'))")

[ -z "$ACCESS_TOKEN" ] && fail "No access token in login response: $LOGIN_RESP"
ok "Logged in as demo user"

AUTH_HEADER="Authorization: Bearer $ACCESS_TOKEN"

# ── Step 2b: Set firstName so the app skips /setup ───────────────────────────
echo ""
echo "Setting demo user name ..."
curl -sf -X PATCH "$API_URL/auth/me" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"first_name": "Demo", "last_name": "User"}' > /dev/null \
  && ok "Name set: Demo User" \
  || warn "Could not set name (non-fatal)"

# ── Step 3: Submit questionnaire (fast path - no LLM, sets confirmed=true) ──
echo ""
echo "Submitting financial questionnaire ..."

QUIZ_PAYLOAD='{
  "mode": "quick",
  "answers": {
    "employmentType": "employed",
    "monthlyNetIncome": 1800,
    "currency": "EUR",
    "incomeSources": [
      {
        "id": "src-1",
        "label": "Stipendio",
        "type": "employment_net",
        "valueMin": 1800,
        "valueMax": 1800,
        "currency": "EUR",
        "hideFromAssistant": false
      }
    ],
    "expenseCategories": {
      "Affitto": 600,
      "Cibo": 350,
      "Trasporti": 120,
      "Svago": 150,
      "Utilities": 80
    },
    "fixedMonthlyCosts": 1300,
    "householdSize": 1,
    "savingsBehavior": "occasional",
    "financialGoal": "save_more"
  }
}'

QUIZ_RESP=$(curl -sf -X POST "$API_URL/profile/questionnaire" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$QUIZ_PAYLOAD") \
  || fail "Questionnaire submission failed. Check API logs: docker compose logs api"

QUIZ_STATUS=$(echo "$QUIZ_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
ok "Questionnaire submitted (status: $QUIZ_STATUS) - profile is now confirmed"

# ── Step 4 (optional): Upload Revolut CSV ────────────────────────────────────
if [ "$WITH_CSV" = true ]; then
  echo ""
  echo "Uploading Revolut CSV (--with-csv flag set) ..."

  REVOLUT_CSV="$SAMPLES_DIR/revolut_it/RevolutIT_account-statement_2026-02-01_2026-03-24_en-us_4700b8.csv"

  if [ ! -f "$REVOLUT_CSV" ]; then
    warn "Revolut CSV not found at $REVOLUT_CSV - skipping"
  else
    echo -n "  Uploading $(basename "$REVOLUT_CSV") ... "
    UPLOAD_RESP=$(curl -sf -X POST "$API_URL/ingestion/upload" \
      -H "$AUTH_HEADER" \
      -F "file=@${REVOLUT_CSV}" 2>&1) || { echo "FAILED"; warn "Upload failed"; UPLOAD_RESP=""; }

    if [ -n "$UPLOAD_RESP" ]; then
      UPLOAD_ID=$(echo "$UPLOAD_RESP" | python3 -c \
        "import sys,json; print(json.load(sys.stdin).get('upload_id',''))" 2>/dev/null || echo "")
      [ -n "$UPLOAD_ID" ] && echo "OK (id: $UPLOAD_ID)" || echo "FAILED (no id)"
    fi

    # Confirm uploads (triggers profile enrichment in background - non-blocking)
    echo "  Confirming uploads ..."
    curl -sf -X POST "$API_URL/ingestion/confirm-all" \
      -H "$AUTH_HEADER" > /dev/null \
      && ok "CSV confirmed - transaction data enrichment queued (background)" \
      || warn "confirm-all failed (non-fatal for quiz-seeded profile)"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Demo seed complete!                                   ║"
echo "╠════════════════════════════════════════════════════════╣"
printf "║  Email:    %-44s ║\n" "$DEMO_EMAIL"
printf "║  Password: %-44s ║\n" "$DEMO_PASSWORD"
echo "║  URL:      http://localhost:3000                       ║"
echo "║  Profile:  confirmed via questionnaire (goes to /chat) ║"
if [ "$WITH_CSV" = true ]; then
  echo "║  CSV:      Revolut uploaded + confirmed                ║"
fi
echo "╚════════════════════════════════════════════════════════╝"
echo ""
