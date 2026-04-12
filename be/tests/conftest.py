import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Set DATABASE_URL before any app imports so SQLAlchemy uses SQLite for tests
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal, create_tables, engine  # noqa: E402
from app.main import app  # noqa: E402


def pytest_configure(config):
    """Create tables once when pytest starts."""
    create_tables()


@pytest.fixture(autouse=True)
def reset_db():
    """Reset the database between tests so each test is isolated."""
    from app.db.models import Base

    # Drop and recreate all tables for isolation
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(reset_db) -> TestClient:
    return TestClient(app)
