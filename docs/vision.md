# Vision

**Last reviewed:** 2026-07-22

> The durable "why" behind the Family Budget App. Agents read this to make scope decisions that align with where the product is going. Keep it short; update it when the direction genuinely shifts.

## What we're building

A local-only web app for a household (Sebi & Olivia) to track and understand spending across their Capital One and UCCU accounts. The wedge: import your bank CSV exports, get them auto-categorized, and see where the money actually goes — spending by category, by month, and by merchant — without handing your financial data to anyone.

## Where it's going

A calm, private personal-finance surface the household actually uses: budget *planning* (what should we spend), budget-vs-reality feedback (how did we do), savings goals, a rainy-day fund, and light net-worth tracking — all still fully local. The app grows by making the existing data more useful (comparisons, year-over-year, budget feedback), not by adding accounts, logins, or cloud features.

## What's explicitly out of scope (for now)

- **Any cloud, account system, or shared server.** Each person runs their own copy. Exposing it beyond `127.0.0.1` is a deliberate, ADR-worthy future decision, not a casual change.
- **Automatic bank connections (Plaid etc.).** Data comes in via manual CSV upload on purpose — no third party ever sees the transactions.
- **Multi-user data sharing.** There is no "see each other's data" — isolation between people is total by design.
- **Mobile apps / native packaging.** It's a local web app opened in a browser.

## Principles

- **Privacy is the product.** Financial data never leaves the user's machine. This is promoted to a hard rule in the root `CLAUDE.md` and to [`adr/001-local-only-no-cloud.md`](../adr/001-local-only-no-cloud.md).
- **The data model is honest.** Amounts are stored positive with a `flow` direction; transfers never pollute spending totals; re-imports are idempotent.
- **Planning and reality are separate surfaces.** The Budget tab plans; the Dashboard and Monthly tabs show what actually happened. Don't blur them.
