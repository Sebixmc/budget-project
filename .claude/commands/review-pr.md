Review a diff or pull request.

Usage:
- `/review-pr` — review the current working diff (`git diff` and staged changes).
- `/review-pr 142` — if the repo is on GitHub, review that PR: fetch it with `gh pr diff 142`.

Dispatch to the `code-reviewer` subagent with the diff as input. The result is a structured review posted in chat for the human to act on. If reviewing a GitHub PR, the human can optionally ask you to post it as a comment via `gh pr comment <N> --body-file -`.

Note: this project is often worked on locally without pushing to GitHub, so the no-argument working-diff form is the common case.
