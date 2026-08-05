#!/bin/bash
# ============================================================================
# Default-deny egress firewall for the Claude sandbox devcontainer.
#
# After this runs, the container can ONLY reach the allowlisted domains below
# (Anthropic API, GitHub, npm, PyPI, and this stack's services). Everything
# else is blocked. This is what makes `claude --dangerously-skip-permissions` a
# reasonable mode inside the container: even a badly-prompted or
# prompt-injected agent cannot exfiltrate to, or fetch from, arbitrary hosts.
#
# Adapted from Anthropic's reference devcontainer via
# Sebixmc/Startup-Infrastructure-Template.
#
# Add per-project domains in the ALLOWED_DOMAINS list, then rebuild or re-run:
#   sudo /usr/local/bin/init-firewall.sh
# ============================================================================
set -euo pipefail
IFS=$'\n\t'

echo "[firewall] Flushing existing rules..."
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# --- Baseline: DNS, SSH, localhost -----------------------------------------
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT  -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
iptables -A INPUT  -p tcp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT  -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
iptables -A INPUT  -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

ipset create allowed-domains hash:net

# --- GitHub: fetch their published IP ranges --------------------------------
echo "[firewall] Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ] || ! echo "$gh_ranges" | jq -e '.web' >/dev/null 2>&1; then
    echo "[firewall] ERROR: failed to fetch GitHub IP ranges" >&2
    exit 1
fi
echo "$gh_ranges" | jq -r '(.web + .api + .git + .packages)[]' | aggregate -q \
  | while read -r cidr; do
      ipset add allowed-domains "$cidr" 2>/dev/null || true
    done

# --- Allowlisted domains ----------------------------------------------------
ALLOWED_DOMAINS=(
    # Claude / Anthropic
    "api.anthropic.com"
    "claude.ai"
    "statsig.anthropic.com"
    "statsig.com"
    "sentry.io"
    # npm (web/ uses npm, not pnpm)
    "registry.npmjs.org"
    # PyPI — the legacy Flask app's ruff/pytest install from here.
    # Without these, `pip install -r requirements-dev.txt` fails in-container.
    "pypi.org"
    "files.pythonhosted.org"
    # Vercel (deploy status, vercel CLI if used)
    "api.vercel.com"
    "vercel.com"
    # Supabase control plane (dashboard/API — NOT the data plane)
    "api.supabase.com"
    "supabase.com"

    # ---------------------------------------------------------------------
    # >>> REQUIRED: this project's Supabase DATA-PLANE domain. <<<
    #
    # The two entries above are the control plane only. The app talks to
    # https://<project-ref>.supabase.co, which is a DIFFERENT host and is NOT
    # covered above. Leaving it out is what blocks every authenticated page
    # and makes sign-in hang — the standing blocker in
    # handoff/rule-triage-flows-2026-08-04.md.
    #
    # Find the ref: Supabase dashboard → Project Settings → General →
    # "Reference ID", or read it out of the URL in web/.env.local's
    # NEXT_PUBLIC_SUPABASE_URL. Then uncomment and fill in:
    #
    # "<your-project-ref>.supabase.co"
    #
    # A wildcard will NOT work — the script resolves each entry with `dig`,
    # so it must be the literal hostname.
    # ---------------------------------------------------------------------
)

for domain in "${ALLOWED_DOMAINS[@]}"; do
    echo "[firewall] Resolving $domain..."
    ips=$(dig +short A "$domain" | grep -E '^[0-9]+\.' || true)
    if [ -z "$ips" ]; then
        echo "[firewall] WARN: could not resolve $domain (skipping)" >&2
        continue
    fi
    while read -r ip; do
        ipset add allowed-domains "$ip" 2>/dev/null || true
    done <<< "$ips"
done

# --- Host network (so the devcontainer can talk to Docker host services) ----
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -n "$HOST_IP" ]; then
    HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
    echo "[firewall] Allowing host network $HOST_NETWORK..."
    iptables -A INPUT  -s "$HOST_NETWORK" -j ACCEPT
    iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT
fi

# --- Default deny -----------------------------------------------------------
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

iptables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

echo "[firewall] Default-deny policy installed."

# --- Verify -----------------------------------------------------------------
echo "[firewall] Verifying..."
if curl --connect-timeout 5 -s https://example.com >/dev/null 2>&1; then
    echo "[firewall] ERROR: example.com is reachable — firewall NOT working" >&2
    exit 1
else
    echo "[firewall] OK: example.com blocked (as intended)"
fi

if ! curl --connect-timeout 10 -s https://api.github.com/zen >/dev/null 2>&1; then
    echo "[firewall] ERROR: api.github.com NOT reachable — allowlist broken" >&2
    exit 1
else
    echo "[firewall] OK: api.github.com reachable"
fi

echo "[firewall] Egress firewall is up. Only allowlisted endpoints are reachable."
