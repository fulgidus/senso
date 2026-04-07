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

## Database Conventions

### No mixed ORM + raw connections

**Never mix SQLAlchemy ORM sessions (`SessionLocal()`) and raw `engine.connect()` calls targeting the same table in the same logical operation.** This causes deadlocks - the ORM session holds row/table locks that block DDL statements from the raw connection, and vice versa.

- Migrations and backfills: use **raw SQL only** (`engine.connect()` + `sa.text()`).
- Application CRUD: use **ORM sessions only** (`SessionLocal()` / `get_db()`).
- If a startup routine needs both data manipulation and DDL (e.g., backfill rows then add a constraint), do them in **separate `with engine.connect()` blocks** - never hold one connection open while opening another against the same table.
