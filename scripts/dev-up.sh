#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/dev-up.sh [--help]

Starts the Phase 1 local runtime stack with Docker Compose.

Examples:
  bash scripts/dev-up.sh
  bash scripts/dev-up.sh --help
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker CLI is required." >&2
  echo "Install Docker Desktop or Docker Engine, then re-run." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy .env.example to .env first." >&2
  exit 1
fi

docker compose up --build
