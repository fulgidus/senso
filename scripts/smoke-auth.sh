#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required for smoke checks." >&2
  exit 1
fi

health_status=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/health" || true)
if [[ "${health_status}" != "200" ]]; then
  echo "Health check failed: expected 200, got ${health_status}" >&2
  exit 1
fi

signup_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -X POST "${API_BASE}/auth/signup" \
  -d "{\"email\":\"smoke-$(date +%s)@example.com\",\"password\":\"password123\"}" || true)

if [[ "${signup_status}" != "201" ]]; then
  echo "Auth signup smoke check failed: expected 201, got ${signup_status}" >&2
  exit 1
fi

echo "Smoke checks passed: /health and /auth/signup are reachable."
