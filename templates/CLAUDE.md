# /templates rules

Jinja2 templates — one file per page, plus `base.html` (layout, nav, Tailwind config, global styles). Rendered by routes in `app.py`.

Rules:

1. **`base.html` owns the shell.** Nav, `<head>`, Tailwind CDN config, ECharts/Chart.js CDN scripts, and shared styles live there. Page templates `{% extends "base.html" %}` and fill blocks — don't re-import Tailwind or a chart library per page.

2. **No build step.** Tailwind, Chart.js, and ECharts load from CDNs. There is no bundler, no `node_modules`, no compiled CSS. Don't introduce one — a user just opens the app in a browser.

3. **Templates render; they don't compute.** Money math, aggregation, and filtering happen in `database.py` / `app.py`, not in Jinja. A template displays what the route hands it. Chart data comes from the `/api/*` endpoints via `fetch`, not inlined query logic.

4. **Respect the domain invariants in the data you show:**
   - Amounts are positive; use the `flow` field (`debit`/`credit`) to decide sign/label/color — never assume a stored negative.
   - Anything that totals or charts spending/income already excludes `Transfer` upstream; don't re-add transfers in a template loop.

5. **Escape by default.** Jinja auto-escapes — don't reach for `|safe` on anything derived from a transaction description, merchant name, notes, or any imported CSV value. That data is untrusted user input.

6. **Keep pages in sync with the nav.** The nav in `base.html` and the routes in `app.py` must agree. `breakdown.html` exists but is intentionally unlinked (folded into the dashboard sunburst) — don't relink it without a work-queue item.

7. When you add or meaningfully change a page's behavior, update its description in [`/spec.md`](../spec.md) (the "Pages" section) in the same change — that's the master record of what each tab does.
