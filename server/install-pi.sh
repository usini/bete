#!/usr/bin/env bash
# Installs (or updates) the Bete host as a systemd service on a Raspberry Pi.
#
# Quick usage (on the Pi):
#   curl -fsSL https://raw.githubusercontent.com/usini/bete/main/server/install-pi.sh | bash
#
# A PRIVATE peer id is generated automatically on first launch and stored
# in server/data/peer-id (never committed). It's reused afterwards.
#
# Optional environment variables:
#   BETE_ID       forces a specific id (otherwise generated randomly)
#   BETE_DIR      clone directory (default: $HOME/bete)
#   BETE_REPO     repo to clone, if you forked the project (default: this repo)
#   BETE_APP_URL  URL of the static app, to display a full link at the end
#                 of the install (default: none — shows a generic relative link)
set -euo pipefail

REPO="${BETE_REPO:-https://github.com/usini/bete.git}"
DEST="${BETE_DIR:-$HOME/bete}"
SERVICE="bete"
APP_URL="${BETE_APP_URL:-}"

say() { printf '\n\033[32m[install]\033[0m %s\n' "$*"; }
die() { printf '\n\033[31m[install] %s\033[0m\n' "$*" >&2; exit 1; }

# --- 1. Prerequisites ---
command -v node >/dev/null 2>&1 || die "Node.js missing. Install Node 20 LTS then rerun:
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs git"
command -v git >/dev/null 2>&1 || die "git missing: sudo apt-get install -y git"
say "Node $(node --version) · $(uname -m)"
case "$(uname -m)" in
  aarch64|arm64|x86_64) : ;;
  *) say "WARNING: arch $(uname -m) — pre-built wrtc binaries may be missing (long compile)." ;;
esac

# --- 2. Clone or update ---
if [ -d "$DEST/.git" ]; then
  say "Updating the repo in $DEST"
  git -C "$DEST" pull --ff-only
else
  say "Cloning into $DEST"
  git clone --depth 1 "$REPO" "$DEST"
fi

# --- 3. Private peer id (generated once, never committed) ---
DATA="$DEST/server/data"
mkdir -p "$DATA"
ID_FILE="$DATA/peer-id"
if [ -n "${BETE_ID:-}" ]; then
  PEER_ID="$BETE_ID"; echo "$PEER_ID" > "$ID_FILE"
elif [ -s "$ID_FILE" ]; then
  PEER_ID="$(cat "$ID_FILE")"
else
  PEER_ID="$(node -e "console.log('p-'+require('crypto').randomBytes(16).toString('hex'))")"
  echo "$PEER_ID" > "$ID_FILE"
  say "New private id generated (stored in $ID_FILE)"
fi
chmod 600 "$ID_FILE" 2>/dev/null || true

# --- 4. Dependencies ---
say "Installing dependencies (can take 1-2 min)…"
cd "$DEST/server"
npm install --omit=dev --no-audit --no-fund

# --- 5. systemd service (the id is NOT in the service: read from data/peer-id) ---
SVC_PATH="/etc/systemd/system/$SERVICE.service"
say "Writing the service $SVC_PATH"
sudo tee "$SVC_PATH" >/dev/null <<EOF
[Unit]
Description=Bete host (PeerJS headless)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DEST/server
Environment=BETE_APP_URL=$APP_URL
ExecStart=$(command -v node) bete-host.js
Restart=always
RestartSec=5
User=$(id -un)

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE" >/dev/null 2>&1 || true
sudo systemctl restart "$SERVICE"

sleep 2
say "Status:"
sudo systemctl --no-pager --lines=6 status "$SERVICE" || true
say "Done ✅"
say "Your PRIVATE link (only share it with your own devices):"
if [ -n "$APP_URL" ]; then
  say "  ${APP_URL}?peer=${PEER_ID}"
else
  say "  <your-instance-url>/?peer=${PEER_ID}"
  say "  (rerun with BETE_APP_URL=https://... to show the full link next time)"
fi
say "Live logs: journalctl -u $SERVICE -f"
