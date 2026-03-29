#!/usr/bin/env bash
# seed-demo.sh — Create demo user + upload sample financial files via API
# Usage: bash scripts/seed-demo.sh
# Requirements: curl, python3, Docker Compose stack running (docker compose up -d)
#
# Auth response shape: flat — response.access_token (not response.tokens.access_token)
# Source: api/app/schemas/auth.py AuthResponseDTO

set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
DEMO_EMAIL="${DEMO_EMAIL:-demo@sen.so}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demodemo!}"
SAMPLES_DIR="$(dirname "$0")/../api/app/ingestion/samples"

# ── Colors ───────────────────────────────────────────────────────────────────
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

# AuthResponseDTO shape (api/app/schemas/auth.py):
#   { "user": {...}, "access_token": "...", "refresh_token": "...", "expires_in": N }
# Tokens are FLAT on the response — NOT nested under "tokens".

SIGNUP_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$DEMO_EMAIL\", \"password\": \"$DEMO_PASSWORD\"}" 2>&1) || true

if [ "$SIGNUP_RESP" = "201" ]; then
  # Successful signup — re-run to get the body this time
  SIGNUP_BODY=$(curl -sf -X POST "$API_URL/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$DEMO_EMAIL\", \"password\": \"$DEMO_PASSWORD\"}" 2>/dev/null) || true

  # Check if we got a body (user may have just been created by the status check above)
  # Fall through to login if body is empty
  if [ -n "$SIGNUP_BODY" ] && echo "$SIGNUP_BODY" | grep -q "access_token"; then
    ok "Demo user created"
    ACCESS_TOKEN=$(echo "$SIGNUP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
  else
    warn "User created but token not retrieved — falling back to login..."
    LOGIN_RESP=$(curl -sf -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$DEMO_EMAIL\", \"password\": \"$DEMO_PASSWORD\"}" 2>&1) \
      || fail "Login failed. Run reset-demo.sh first if the account state is inconsistent."
    ACCESS_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
    ok "Logged in as demo user"
  fi
else
  warn "Signup returned HTTP $SIGNUP_RESP (user may already exist) — trying login..."
  LOGIN_RESP=$(curl -sf -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$DEMO_EMAIL\", \"password\": \"$DEMO_PASSWORD\"}" 2>&1) \
    || fail "Login failed. Run reset-demo.sh first if the account state is inconsistent."
  ACCESS_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
  ok "Logged in as existing demo user"
fi

AUTH_HEADER="Authorization: Bearer $ACCESS_TOKEN"

# ── Step 3: Upload sample files ────────────────────────────────────────────
echo ""
echo "Uploading sample files from $SAMPLES_DIR ..."

UPLOAD_IDS=()

upload_file() {
  local filepath="$1"
  local filename
  filename=$(basename "$filepath")
  if [ ! -f "$filepath" ]; then
    warn "Sample file not found, skipping: $filepath"
    return
  fi
  echo -n "  Uploading $filename ... "
  RESP=$(curl -sf -X POST "$API_URL/ingestion/upload" \
    -H "$AUTH_HEADER" \
    -F "file=@${filepath}" 2>&1) || { echo "FAILED"; warn "Upload failed for $filename"; return; }
  UPLOAD_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('upload_id',''))" 2>/dev/null || echo "")
  if [ -n "$UPLOAD_ID" ]; then
    UPLOAD_IDS+=("$UPLOAD_ID")
    echo "OK (id: $UPLOAD_ID)"
  else
    echo "FAILED"
    warn "No upload_id in response: $RESP"
  fi
}

# Upload the core demo files — Revolut CSV is the primary data source
upload_file "$SAMPLES_DIR/revolut_it/RevolutIT_account-statement_2026-02-01_2026-03-24_en-us_4700b8.csv"
upload_file "$SAMPLES_DIR/fineco_it/FinecoIT_movements_20260324.xlsx"
upload_file "$SAMPLES_DIR/satispay_it/SatispayIT_Export_Report.xlsx"

if [ ${#UPLOAD_IDS[@]} -eq 0 ]; then
  fail "No files were uploaded. Check that sample files exist at $SAMPLES_DIR"
fi

ok "Uploaded ${#UPLOAD_IDS[@]} file(s)"

# ── Step 4: Wait for extraction to complete ───────────────────────────────────
echo ""
echo "Waiting for extraction to complete (up to 60s per file) ..."
for UPLOAD_ID in "${UPLOAD_IDS[@]}"; do
  echo -n "  Waiting for upload $UPLOAD_ID ... "
  for i in $(seq 1 30); do
    STATUS_RESP=$(curl -sf "$API_URL/ingestion/uploads/$UPLOAD_ID" \
      -H "$AUTH_HEADER" 2>&1) || { echo "POLL_ERROR"; break; }
    STATUS=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "done" ] || [ "$STATUS" = "confirmed" ]; then
      echo "done"
      break
    elif [ "$STATUS" = "error" ]; then
      echo "error (continuing)"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "timeout (status=$STATUS, continuing)"
    else
      sleep 2
    fi
  done
done

# ── Step 5: Confirm all + trigger categorization ──────────────────────────────
echo ""
echo "Confirming all uploads and triggering profile categorization ..."
CONFIRM_RESP=$(curl -sf -X POST "$API_URL/ingestion/confirm-all" \
  -H "$AUTH_HEADER" 2>&1) \
  || fail "confirm-all failed. Check API logs: docker compose logs api"
ok "Uploads confirmed. Categorization queued."
echo "  Response: $CONFIRM_RESP"

# ── Step 6: Wait for categorization ──────────────────────────────────────────
echo ""
echo "Waiting for profile categorization (up to 90s) ..."
for i in $(seq 1 45); do
  PROF_RESP=$(curl -sf "$API_URL/profile/status" \
    -H "$AUTH_HEADER" 2>&1) || { warn "Profile status poll failed"; break; }
  PROF_STATUS=$(echo "$PROF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
  if [ "$PROF_STATUS" = "done" ]; then
    ok "Profile categorization complete"
    break
  fi
  if [ "$i" -eq 45 ]; then
    warn "Profile categorization timed out — demo may still work if partial profile is available"
  else
    sleep 2
  fi
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Demo seed complete!                                   ║"
echo "╠════════════════════════════════════════════════════════╣"
printf "║  Email:    %-44s ║\n" "$DEMO_EMAIL"
printf "║  Password: %-44s ║\n" "$DEMO_PASSWORD"
echo "║  URL:      http://localhost:3000                       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
