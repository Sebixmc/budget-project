# Sandbox image for running Claude Code with --dangerously-skip-permissions.
# Adapted from Anthropic's reference devcontainer via Startup-Infrastructure-Template.
#
# Budget-project deviation from the template: this repo is dual-stack — the
# hosted Next.js app in web/ (Node 20 + npm) plus the legacy Flask app at the
# root (Python 3 + ruff + pytest), which stays as the parity reference until
# cutover. So python3/pip/venv are installed alongside Node.

FROM node:20-bookworm

ARG TZ
ENV TZ="$TZ"

# Tools: git + gh for the PR workflow, iptables/ipset/dnsutils/aggregate for the
# egress firewall, zsh/fzf/less for a livable shell, jq for scripts,
# python3 toolchain for the legacy Flask app.
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  ca-certificates \
  python3 \
  python3-pip \
  python3-venv \
  && rm -rf /var/lib/apt/lists/*

# Persist shell history in a mounted volume.
ARG USERNAME=node
RUN mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory \
  && echo "export PROMPT_COMMAND='history -a'" >> "/home/$USERNAME/.bashrc" \
  && echo "export HISTFILE=/commandhistory/.bash_history" >> "/home/$USERNAME/.bashrc"

ENV DEVCONTAINER=true

RUN mkdir -p /workspace /home/node/.claude \
  && chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

# Claude Code CLI.
RUN npm install -g @anthropic-ai/claude-code

# zsh as the default interactive shell, with history in the mounted volume.
USER node
RUN echo "export HISTFILE=/commandhistory/.zsh_history" >> "/home/node/.zshrc" \
  && echo "setopt APPEND_HISTORY INC_APPEND_HISTORY" >> "/home/node/.zshrc"

# The firewall script needs root for iptables; grant the node user exactly that
# one command via sudo, nothing else.
USER root
COPY init-firewall.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall

USER node
