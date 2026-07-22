# /.github rules

This folder holds GitHub configuration: the CI workflow, CODEOWNERS, and templates.

Note: this app is often developed locally and may not always be pushed to GitHub. When it is, these rules apply.

Rules:

1. Workflow changes require the same review as code changes. CI is part of the product.

2. Never store secrets in workflow files. This app has no cloud secrets by design; if that ever changes, use GitHub Actions secrets/variables (`${{ secrets.NAME }}` / `${{ vars.NAME }}`), never inline.

3. Pin action versions to tags or SHAs, never `@main` or `@latest`, to prevent supply-chain surprises (`actions/checkout@v4`, not `@main`).

4. CI must stay fast and green. The suite is `ruff check` + `ruff format --check` + `pytest` (unit tests plus the Flask boot smoke test). Keep it under a couple of minutes.

5. Tests must never require or touch a real `budget.db` or a real bank CSV. The smoke test points `database.DB_PATH` at a temp DB (see `tests/conftest.py`); keep it that way. No financial data in CI, ever.

6. CODEOWNERS uses a placeholder handle until the repo has a real GitHub owner — replace `@YOUR_GITHUB_HANDLE` before relying on required reviews.
