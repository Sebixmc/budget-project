Orient yourself in this repo before doing any work. This is the first thing to run in a fresh session on this project.

Workflow:
1. Read `/CLAUDE.md` fully.
2. Read [`/spec.md`](../../spec.md) — the master source of truth for what the app does, its data model, and the Open Work Queue.
3. List the folders that have their own `CLAUDE.md` (`templates/`, `docs/`, `specs/`, `adr/`, `handoff/`, `.github/`) and note you'll read each before writing there.
4. Read `/docs/architecture.md` and `/docs/conventions.md`.
5. Read the most recent file in `/handoff/` (if any) to see where the last session left off.
6. Confirm the toolchain: `bash start.sh` (or `python3 app.py`) boots the app on `http://127.0.0.1:5001`; `ruff check .` + `ruff format --check .` lint; `pytest -q` tests.
7. Summarize back to the human, in under 10 lines: the product in one sentence, the stack, the load-bearing rule (local-only / no cloud), and what the top `[UNTOUCHED]` items in `spec.md`'s Open Work Queue are. Then ask what to work on (or suggest running `/todo`).

Do not write code during `/orient`. It is read-only orientation.
