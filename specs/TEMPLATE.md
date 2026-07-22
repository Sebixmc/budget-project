# <Feature title>

**Work-queue item:** <the bullet text from /spec.md's Open Work Queue this expands>
**Status:** Draft | In review | Approved | Shipped

## Purpose

One paragraph: what this feature does and why it matters.

## User-facing behavior

1. What the user sees / does, step by step — which nav tab, which controls, what changes on screen.
2. …

## Data flow

Step-by-step of how data moves through the system for this feature, naming the modules/files involved:

1. Request enters at `app.py` route `…`, reading args `…`.
2. Calls `database.py` helper `…` (parameterized query; excludes `Transfer` if it aggregates money).
3. Renders `templates/….html` / returns JSON to the page's chart JS.

## Acceptance criteria (EARS)

- WHEN <trigger/condition>, the system SHALL <observable response>.
- WHEN <invalid input X>, the system SHALL <reject/skip with Y>.
- WHILE <state>, WHEN <event>, the system SHALL <response>.

## Files to touch

- `app.py` — <route/endpoint changes>
- `database.py` — <new helper / migration>
- `templates/….html` — <UI changes>
- `tests/test_….py` — <tests added>

## Out of scope

- <thing a reader might assume is included but isn't>

## Open questions

- <anything the human still needs to decide>

## Test plan

- Unit (pytest): `tests/test_….py` — <what it checks>
- Manual browser verification: <steps on http://127.0.0.1:5001 to confirm before marking [COMPLETED]>
