<!-- Title format: <type>: short description  (feat / fix / chore / docs) -->

## What & why

<!-- One or two sentences. Link the spec if there is one: /specs/<name>.md.
     Reference the work-queue item in /spec.md this addresses. -->

## How

<!-- Key implementation notes a reviewer needs. Keep it short. -->

## Checklist

- [ ] Branch named `<type>/<short-desc>`
- [ ] `ruff check .` and `ruff format --check .` pass locally
- [ ] `pytest` passes; tests added/updated in this PR (not a follow-up)
- [ ] Verified on a running server — app boots on `http://127.0.0.1:5001`, all nav tabs 200, the touched feature works in the browser
- [ ] No financial data committed (`*.db`, `*.csv`, real bank exports) — fixtures are synthetic
- [ ] Money aggregates still exclude `category = 'Transfer'`
- [ ] Any schema change is an additive `_migrate_*` (no rewrite of the user's `budget.db`)
- [ ] `spec.md` work-queue item status updated; docs/ADR updated if a convention or durable decision changed
