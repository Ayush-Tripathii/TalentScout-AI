"""Pytest Configuration and Fixtures.

Ensures that all automated tests run against an isolated test SQLite database
and never touch or mutate the production data/talentscout.db.
"""

import os
import pytest
from pathlib import Path

# Redirect DATABASE_URL to an isolated test database BEFORE any application imports
TEST_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "test_talentscout.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"

from app.db import init_db, engine
from sqlmodel import SQLModel


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create test tables before test session and clean up after."""
    TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    init_db()
    yield
    # Clean up test database file after all tests complete
    engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass
