#!/usr/bin/env bash
set -e
docker compose run --rm api /app/.venv/bin/python -c "import app; print('ok')"
