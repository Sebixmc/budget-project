# Handoff — rule triage flows implemented (2026-08-04)

## Summary

Implemented [`specs/rule-triage-flows.md`](../specs/rule-triage-flows.md) end to end in `web/`: the post-upload triage panel (uncategorized transactions grouped by merchant; one category pick per group upserts a rule and fixes every matching auto row) and the save-as-rule prompt on the Transactions page (after an inline single/bulk category edit, an editable-pattern prompt with a live "fixes N more" count). Shipped as three stacked PRs: pure merchant lib → triage panel → rule prompt.

## Files modified

- `web/lib/merchant.ts` (new) — pure `cleanMerchantPattern()` + `groupByMerchant()`; `web/lib/merchant.test.ts` (new) — 13 Vitest cases.
- `web/app/(app)/rules/actions.ts` — added `createRuleAndApply()` (upsert rule + recategorize matching **auto** rows, returns updated count) and `countRuleMatches()`; both escape LIKE wildcards so patterns match as literal substrings.
- `web/app/(app)/upload/actions.ts` — `getUncategorizedGroups()`; `UploadResult` now carries `batch` + `triage` groups.
- `web/components/app/triage-panel.tsx` (new), `web/components/app/rule-prompt.tsx` (new).
- `web/app/(app)/upload/upload-form.tsx` — renders the triage panel (keyed by batch) after a successful import.
- `web/app/(app)/transactions/transactions-table.tsx` — prompt under the edited row; bulk path shows it only when all selected rows share one cleaned pattern; a new edit replaces the open prompt; a stale save-confirmation timer can't dismiss a newer prompt.
- `web/eslint.config.mjs` + `web/.gitignore` — ignore `.next*` so the stray `web/.next.corrupted-2026-08-03/` (352 MB, untracked) stops breaking lint. It can be deleted (proposed ticket filed).
- `spec.md`, `specs/rule-triage-flows.md` (Amendment 2026-08-04), `specs/proposed-tickets.md` (2 new tickets).

## Decisions

- Grouping logic lives in the pure layer (`groupByMerchant`) instead of the server action, so it's unit-testable — recorded in the spec Amendment.
- "Categorize without saving a rule" reuses `bulkCategory()` (sets `category_source='manual'`), no new action.
- Hard rule #7 honored everywhere: every recategorization filters `category_source = 'auto'`.

## What works / verification

`npm run lint`, `npm run typecheck`, `npm test` (31 green), `npm run build` all pass; `npm run dev` boots and `/login` serves 200. Legacy Python CI runs on GitHub Actions (no Python touched; ruff/pytest can't install locally — PyPI is firewalled).

## Blockers / half-done

**The in-browser Test plan was not run.** The devcontainer firewall (`.devcontainer/init-firewall.sh`) blocks `*.supabase.co`, so authenticated pages hang against the real project and no local Supabase is possible (no Docker/CLI). The work-queue item stays `[IN PROGRESS]`.

## Next steps

1. Walk the spec's Test plan (import CSV → triage groups → rule + fix counts; inline edit → prompt; bulk same/mixed merchants; re-import idempotency) on Vercel or a network-open machine, then flip the queue item to `[COMPLETED]`.
2. Consider allowlisting Supabase + PyPI in the devcontainer firewall (proposed ticket, 2026-08-04).
