# Proposed Tickets

Loose idea backlog surfaced during work but not yet shaped into a work-queue item. Agents and the developer append here throughout the week; in a periodic triage pass, promote entries into the "Open Work Queue" of [`/spec.md`](../spec.md) (as `[UNTOUCHED]`) or delete them as noise.

> The primary tracker is `spec.md`'s Open Work Queue. This file is the pre-queue: rough thoughts that aren't yet clear enough to be a queue item. When an idea is shaped enough to act on, move it to `spec.md`.

## How to append an entry

Add a single bullet under the right section, in this format:

- **<one-line description>** — <one or two sentences of rationale>. Surfaced by: <session context>. <YYYY-MM-DD>

Keep entries terse. When unsure whether to propose something, propose it — capture is cheap, lost observations are expensive.

## How to triage

Walk each section. For each entry:
- **Promote** — add it to `spec.md`'s Open Work Queue under the right priority; remove the entry here.
- **Defer** — leave it with a note like `(defer: revisit YYYY-MM-DD)`.
- **Discard** — delete it. Git history preserves the decision.

## Categories

### Feature ideas

_Things that add product capability. Usually need a spec before implementation._

<!-- example:
- **Weekly budget periods** — some bills are weekly; monthly-only budgeting is awkward for them. Surfaced by: budget-tab session. 2026-07-22
-->

### Bugs and follow-ups

_Things noticed in passing that are broken, fragile, or need fixing._

### Refactors and technical debt

_Code that works but should be improved for clarity, performance, or maintainability._

### Tooling and developer experience

_Test coverage, lint config, the start script, local-run ergonomics._

- **Normalize legacy modules to ruff-clean and widen CI lint to the whole repo** — `app.py`, `database.py`, `parser.py`, `categorizer.py` predate ruff; CI currently lints only `tests/`. Run `ruff check --fix .` + `ruff format .`, eyeball the diff (especially import reordering), then change `.github/workflows/ci.yml` to lint `.` instead of `tests/`. Surfaced by: infra-template application. 2026-07-22
- **Expand test coverage to `parser.py` and `database.py`** — only `categorizer.py` and a boot smoke test exist so far. Add parser tests per bank format (Capital One credit/bank, UCCU) using synthetic CSV bytes, and DB idempotency tests for `insert_transactions`. Surfaced by: infra-template application. 2026-07-22

### Documentation gaps

_Docs that are missing, stale, or misleading (including `spec.md` drift)._

### Open questions

_Things to discuss that aren't shaped enough to be work-queue items yet._
