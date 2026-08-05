# .devcontainer — the Claude bypass-permissions sandbox

A containerized environment for running Claude Code **autonomously** — `claude --dangerously-skip-permissions` — without the risk that normally implies. Copied from [`Sebixmc/Startup-Infrastructure-Template`](https://github.com/Sebixmc/Startup-Infrastructure-Template) (`template/.devcontainer/`) and adapted for this repo.

## Why this exists

Bypass-permissions mode lets the agent work without approval prompts, which is a huge productivity win for long unattended runs — but on your host machine it would mean an agent (or a prompt injection it ingested) could run anything and reach anywhere. The container closes that down two ways:

1. **Isolation** — the agent can only touch the workspace mount, not your host filesystem.
2. **Default-deny egress firewall** (`init-firewall.sh`) — outbound network is blocked except for an explicit allowlist: Anthropic API, GitHub, npm, PyPI, Supabase, and Vercel. Even a hijacked agent can't exfiltrate to or fetch from arbitrary hosts.

## ⚠️ Before first use: add the Supabase data-plane domain

The allowlist ships with `supabase.com` and `api.supabase.com` — those are the **control plane** (dashboard/management API). The app itself talks to `https://<project-ref>.supabase.co`, a **different host that is not covered**.

Leaving it out is exactly what has been blocking every authenticated page and making sign-in hang from agent sessions (see [`handoff/rule-triage-flows-2026-08-04.md`](../handoff/rule-triage-flows-2026-08-04.md)). Unit tests and CI pass; anything behind auth silently fails.

Fix it in [`init-firewall.sh`](init-firewall.sh) at the marked block:

```sh
"abcdefghijklmnop.supabase.co"   # your real project ref
```

Find the ref in the Supabase dashboard under **Project Settings → General → Reference ID**, or pull it out of `NEXT_PUBLIC_SUPABASE_URL` in `web/.env.local`. A wildcard won't work — the script resolves each entry with `dig`, so it must be the literal hostname.

## Usage

1. Install Docker Desktop and the VS Code **Dev Containers** extension (or the `devcontainer` CLI).
2. Open the repo → **"Reopen in Container"**. First build takes a few minutes; `postCreateCommand` brings up the firewall and runs `npm --prefix web install`.
3. Inside the container terminal:

   ```sh
   claude --dangerously-skip-permissions
   ```

   Credentials persist in a named volume, so you authenticate once per project, not per rebuild.

## Adding allowed domains

Per-project endpoints go in the `ALLOWED_DOMAINS` array in [`init-firewall.sh`](init-firewall.sh). Then rebuild the container, or re-run in place:

```sh
sudo /usr/local/bin/init-firewall.sh
```

The script self-verifies: it fails loudly if `example.com` is reachable (firewall broken) or `api.github.com` isn't (allowlist broken).

## How this differs from the template

This repo is dual-stack, so four things changed on copy:

- **Python added to the image** — the legacy Flask app at the repo root still needs `ruff` + `pytest`. The template is Node-only.
- **PyPI allowlisted** (`pypi.org`, `files.pythonhosted.org`) — without it, `pip install -r requirements-dev.txt` fails in-container. This is why an earlier session reported ruff/pytest uninstallable.
- **npm, not pnpm** — `web/` ships a `package-lock.json`, and there is no root `package.json`, so `postCreateCommand` runs `npm --prefix web install`.
- **Linear removed from the allowlist** — this project has no external tracker; the work queue is the "Open Work Queue" section of `spec.md` (see root `CLAUDE.md`).
- **Port 5001 forwarded** alongside 3000, for the legacy Flask app.

## Caveats

- **The firewall resolves domains to IPs at startup.** CDNs rotate IPs; if a service stops resolving mid-session, re-run the script.
- **Supabase local dev (`supabase start`) needs Docker-in-Docker**, which this container doesn't ship. Either run Supabase local on the host and reach it via the host-network allowance, or add the `docker-in-docker` devcontainer feature.
- **This reduces risk; it doesn't eliminate it.** The agent can still modify anything in the workspace and push to your repos with your credentials. Branch protection on `main` remains the real gate — an autonomous agent can open PRs but can't merge them.
- Windows note: run via Docker Desktop + WSL2. The container itself is Linux, so the firewall works identically.
