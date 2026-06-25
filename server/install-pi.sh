#!/usr/bin/env bash
# Installe (ou met à jour) l'hôte TODOMAPPA en service systemd sur un Raspberry Pi.
#
# Usage rapide (sur le Pi) :
#   curl -fsSL https://raw.githubusercontent.com/remisarrailh/pensebete/main/server/install-pi.sh | bash
#
# Variables d'environnement optionnelles :
#   TODOMAPPA_ID   id de peer fixe        (def: tm-ee69hfhp)
#   TODOMAPPA_DIR  dossier de clonage     (def: $HOME/pensebete)
set -euo pipefail

REPO="https://github.com/remisarrailh/pensebete.git"
DEST="${TODOMAPPA_DIR:-$HOME/pensebete}"
PEER_ID="${TODOMAPPA_ID:-tm-ee69hfhp}"
SERVICE="todomappa"
APP_URL="https://remisarrailh.github.io/pensebete/"

say() { printf '\n\033[32m[install]\033[0m %s\n' "$*"; }
die() { printf '\n\033[31m[install] %s\033[0m\n' "$*" >&2; exit 1; }

# --- 1. Node.js ---
if ! command -v node >/dev/null 2>&1; then
  die "Node.js manquant. Installe Node 20 LTS puis relance :
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs git"
fi
command -v git >/dev/null 2>&1 || die "git manquant : sudo apt-get install -y git"
say "Node $(node --version) · $(uname -m)"
case "$(uname -m)" in
  aarch64|arm64|x86_64) : ;;
  *) say "ATTENTION: archi $(uname -m) — les binaires wrtc pré-compilés peuvent manquer (compilation longue)." ;;
esac

# --- 2. Clone ou mise à jour ---
if [ -d "$DEST/.git" ]; then
  say "Mise à jour du dépôt dans $DEST"
  git -C "$DEST" pull --ff-only
else
  say "Clonage dans $DEST"
  git clone --depth 1 "$REPO" "$DEST"
fi

# --- 3. Dépendances ---
say "Installation des dépendances (peut prendre 1-2 min)…"
cd "$DEST/server"
npm install --omit=dev --no-audit --no-fund

# --- 4. Service systemd ---
SVC_PATH="/etc/systemd/system/$SERVICE.service"
say "Écriture du service $SVC_PATH"
sudo tee "$SVC_PATH" >/dev/null <<EOF
[Unit]
Description=TODOMAPPA host (PeerJS headless)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DEST/server
ExecStart=$(command -v node) todomappa-host.js
Environment=TODOMAPPA_ID=$PEER_ID
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
say "Statut :"
sudo systemctl --no-pager --lines=8 status "$SERVICE" || true
say "Terminé ✅"
say "Lien à ouvrir sur tes appareils : ${APP_URL}?peer=${PEER_ID}"
say "Logs en direct : journalctl -u $SERVICE -f"
