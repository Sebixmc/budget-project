#!/bin/bash
# Family Budget App — start script
# Run this once to set up, then again any time to launch the app.

set -e
cd "$(dirname "$0")"

# ── Check Python ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "Python 3 is required. Download it from https://python.org and try again."
  exit 1
fi

# ── Create virtual environment if it doesn't exist ───────────────────────────
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

# ── Activate and install dependencies ────────────────────────────────────────
source .venv/bin/activate
echo "Checking dependencies..."
pip install -q -r requirements.txt

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo "  Starting Family Budget App..."
echo "  Open your browser to:  http://127.0.0.1:5001"
echo "  Press Ctrl+C to stop."
echo ""

python3 app.py
