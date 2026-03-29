#!/usr/bin/env bash
# reset-demo.sh — Wipe demo user data between demo runs
# Usage: bash scripts/reset-demo.sh
#
# Strategy: connect directly to the Postgres container and run SQL to delete
# the demo user's rows. Deleting from `users` cascades to all child tables via
# PostgreSQL FK CASCADE rules (verified in api/app/db/models.py).
#
# Actual table names (from api/app/db/models.py __tablename__):
#   users, user_profiles, uploads, extracted_documents, transactions,
#   extraction_reports, chat_sessions, session_participants, chat_messages,
#   audio_cache, refresh_sessions, categorization_jobs, welcome_cache
#
# Cascade order: deleting `users` row cascades to all child tables automatically.
# welcome_cache is not user-keyed — cleared separately.
#
# The demo user account itself is also deleted so seed-demo.sh can re-create it.

set -euo pipefail

DEMO_EMAIL="${DEMO_EMAIL:-demo@senso.app}"
POSTGRES_USER="${POSTGRES_USER:-senso}"
POSTGRES_DB="${POSTGRES_DB:-senso}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   S.E.N.S.O. Demo Reset Script         ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Target demo email: $DEMO_EMAIL"
echo ""

# ── Confirm intent ────────────────────────────────────────────────────────────
read -rp "This will delete ALL data for $DEMO_EMAIL. Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ── Check docker compose postgres is running ──────────────────────────────────
if ! docker compose ps postgres 2>/dev/null | grep -qE "running|Up"; then
  fail "Postgres container is not running. Run: docker compose up -d postgres"
fi

# ── Run SQL delete via psql in the postgres container ────────────────────────
# Table names verified against api/app/db/models.py:
#   uploads (not ingestion_uploads), chat_sessions (not coaching_sessions),
#   chat_messages (not coaching_messages). Deleting from 'users' cascades
#   automatically to all child tables via FK ON DELETE CASCADE.
echo ""
echo "Deleting demo user data from database ..."

docker compose exec -T postgres psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -c "
DO \$\$
DECLARE
  uid TEXT;
BEGIN
  -- Find the user
  SELECT id INTO uid FROM users WHERE email = '${DEMO_EMAIL}';
  IF uid IS NULL THEN
    RAISE NOTICE 'Demo user ${DEMO_EMAIL} not found — nothing to delete.';
    RETURN;
  END IF;

  -- Deleting from users cascades to all child tables (FK ON DELETE CASCADE):
  --   refresh_sessions, uploads (-> extracted_documents, transactions,
  --   extraction_reports), user_profiles, categorization_jobs,
  --   chat_sessions (-> session_participants, chat_messages -> audio_cache)
  DELETE FROM users WHERE id = uid;
  RAISE NOTICE 'Deleted user and all cascaded data for ${DEMO_EMAIL} (id=%)', uid;

  -- welcome_cache is not user-keyed — clear it for a clean welcome experience
  DELETE FROM welcome_cache;
  RAISE NOTICE 'welcome_cache cleared';

END;
\$\$ LANGUAGE plpgsql;
"

ok "Database reset complete for $DEMO_EMAIL"

# ── Also clear MinIO upload objects for this user (best-effort) ───────────────
# The minio container uses the server image (no mc client built-in).
# Use a temporary minio/mc container to run the cleanup.
echo ""
echo "Clearing MinIO upload objects (best-effort) ..."

MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"

docker compose run --rm --no-deps \
  -e "MC_HOST_local=http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  --entrypoint sh \
  minio-init \
  -c "mc rm --recursive --force local/senso-uploads/ 2>/dev/null; mc rm --recursive --force local/senso-tts-audio/ 2>/dev/null; echo 'MinIO buckets cleared'" \
  2>/dev/null \
  && ok "MinIO buckets cleared" \
  || warn "MinIO clear failed or minio-init service unavailable (non-fatal — bucket may be empty or will be overwritten)"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔═════════════════════════════════════════════════════════╗"
echo "║  Reset complete. Run seed-demo.sh to re-seed the demo. ║"
echo "╚═════════════════════════════════════════════════════════╝"
echo ""
