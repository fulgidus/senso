#!/usr/bin/env bash
# check-deploy.sh - verify the deployed frontend was actually rebuilt.
#
# Computes the same src_hash locally and compares to what's in /version.json.
# If they mismatch → build failed and Dokploy silently fell back to stale image.
#
# Usage: ./scripts/check-deploy.sh
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://senso.fulgid.us}"
SENSO_DIR="$(cd "$(dirname "$0")/../senso" && pwd)"

# Compute local src_hash (same algorithm as Dockerfile)
LOCAL_HASH=$(find "$SENSO_DIR/src" -type f | sort | xargs cat | sha256sum | cut -c1-12)

echo "Local src_hash: $LOCAL_HASH"
echo "Checking ${FRONTEND_URL}/version.json ..."

RESPONSE=$(curl -sf --max-time 10 "${FRONTEND_URL}/version.json" 2>/dev/null) || {
  echo "FAIL: /version.json not reachable - build failed, Dokploy is serving a stale image."
  exit 1
}

DEPLOYED_HASH=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('src_hash',''))" 2>/dev/null || echo "")

echo "Deployed src_hash: $DEPLOYED_HASH"
echo "Full response: $RESPONSE"

if [ -z "$DEPLOYED_HASH" ]; then
  echo "FAIL: version.json exists but has no src_hash field."
  exit 1
fi

if [ "$LOCAL_HASH" = "$DEPLOYED_HASH" ]; then
  echo "OK: deployed build matches local source."
  exit 0
fi

echo "FAIL: src_hash mismatch - build failed and Dokploy fell back to a stale image."
echo "  Local:    $LOCAL_HASH"
echo "  Deployed: $DEPLOYED_HASH"
exit 1
