"""Shared test fixtures.

The app is local-only and stores everything in a SQLite ``budget.db`` next to
``database.py``. Tests must never touch a real user database, so we point
``database.DB_PATH`` at a throwaway temp file *before* importing ``app`` —
``app.py`` calls ``db.init_db()`` at import time, and ``get_db()`` reads
``DB_PATH`` at call time, so overriding the module global here is enough.

Only synthetic data is ever written. No real bank export is used anywhere in
the test suite (see the hard rules in the root CLAUDE.md).
"""

import os
import tempfile

import pytest

import database

_TMP_DIR = tempfile.mkdtemp(prefix="budget-test-")
database.DB_PATH = os.path.join(_TMP_DIR, "test_budget.db")

import app as flask_app  # noqa: E402  (must import after DB_PATH override)


@pytest.fixture
def client():
    flask_app.app.config.update(TESTING=True)
    return flask_app.app.test_client()
