# Conventions

## Running Services / Tests

**Always use Docker Compose to run the stack.** Never invoke `uv run`, `python`, or `pnpm` directly on the host for server startup, test execution, or build verification. Use the Docker Compose constellation instead.

```bash
# Start the full stack
docker compose up --build

# Run backend tests
docker compose run --rm api uv run pytest

# Run frontend build check
docker compose run --rm frontend pnpm build
```

This ensures consistent environment, shared networking between services, and reproducible results for all teammates and CI.
