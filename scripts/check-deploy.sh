#!/usr/bin/env bash
# check-deploy.sh — verify the deployed frontend matches the expected git SHA.
# Usage: ./scripts/check-deploy.sh [expected_sha]
# If no SHA given, uses current HEAD.
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://senso.fulgid.us}"
EXPECTED="${1:-$(git rev-parse --short HEAD)}"

echo "Checking ${FRONTEND_URL}/version.json ..."
RESPONSE=$(curl -sf --max-time 10 "${FRONTEND_URL}/version.json" 2>/dev/null) || {
  echo "FAIL: /version.json not reachable — build likely failed and Dokploy fell back to stale image."
  exit 1
}

DEPLOYED_SHA=$(echo "$RESPONSE" | grep -o '"sha":"[^"]*"' | cut -d'"' -f4)

if [ "$DEPLOYED_SHA" = "unknown" ] || [ -z "$DEPLOYED_SHA" ]; then
  echo "FAIL: version.json exists but SHA is 'unknown' — GIT_SHA build arg was not set."
  echo "  Response: $RESPONSE"
  exit 1
fi

if [ "$DEPLOYED_SHA" = "$EXPECTED" ]; then
  echo "OK: deployed SHA $DEPLOYED_SHA matches expected $EXPECTED"
  echo "  Full response: $RESPONSE"
  exit 0
fi

# Partial match (short SHA vs full)
if echo "$DEPLOYED_SHA" | grep -q "^${EXPECTED}" || echo "$EXPECTED" | grep -q "^${DEPLOYED_SHA}"; then
  echo "OK: deployed SHA $DEPLOYED_SHA matches expected $EXPECTED (prefix match)"
  echo "  Full response: $RESPONSE"
  exit 0
fi

echo "FAIL: deployed SHA '$DEPLOYED_SHA' does NOT match expected '$EXPECTED'"
echo "  The build likely failed and Dokploy fell back to a stale image."
echo "  Response: $RESPONSE"
exit 1
