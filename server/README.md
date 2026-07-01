# Bete — headless host (Raspberry Pi)

Small Node server that acts as a **permanent host** for Bete, with no
modification to the web app. Your devices connect to it like any other host,
via `?peer=<id>`. It holds the reference board and saves it to disk, so sync
stays available even when all your browsers are closed.

The protocol is identical to the app's: only the **content** is synced
(text, image, color, description, links, positions on drop, creations/deletions),
never the camera. On conflict, the host (= this server) wins.

## Prerequisites

- **Node.js 18, 20 or 22 LTS** (avoid the very latest non-LTS release: pre-built
  binaries for `@roamhq/wrtc` may be missing).
- **Raspberry Pi OS 64-bit** recommended (pre-built arm64 `wrtc` binaries). On
  32-bit, `npm install` will attempt a long compile (not recommended).

## Express install (Raspberry Pi)

In one command (clone + dependencies + systemd service):

```bash
curl -fsSL https://raw.githubusercontent.com/usini/bete/main/server/install-pi.sh | bash
```

A **private peer id** is generated automatically on first launch and stored
in `server/data/peer-id` (never committed). The script then shows your link
`…?peer=<id>` — keep it to yourself. (Prerequisites: `node` and `git`
installed; see below. To force an id: `BETE_ID=… curl … | bash`.)

If you forked the project to host it elsewhere, also pass `BETE_REPO=<your-fork>`
and `BETE_APP_URL=<your-domain>` — see [Configuration](#configuration-environment-variables).

## Manual install

```bash
cd server
npm install
```

## Launch

```bash
npm start
```

On startup, it prints the id and the link to share, for example:

```
[bete] HOST ONLINE
  id    : p-ab12cd34ef
  link  : <your-instance-url>/?peer=p-ab12cd34ef
```

(The full link is only shown if `BETE_APP_URL` is set — see below.)

Open this link (or its QR) on your devices: they sync with the Pi.

The id is **stable**: it's remembered in `data/peer-id` and reused on every
restart, so the link never changes. (You can also force it with the
`BETE_ID` environment variable.)

## Multi-board

A single server hosts **several boards**. The target board is chosen
client-side via the URL: `?peer=<id>&id=<board>` (without `id`, the link's
default board). Each board is persisted in `server/data/boards/<board>.json`.

- Connecting to an **empty** board server-side: your local board **seeds** it
  (instead of being overwritten). Connecting to an **already-filled** board:
  you adopt the server's.

## Bootstrapping with an existing board

To start from an existing board instead of an empty one:

1. In the app, radial menu → **Export** (downloads a `.json`).
2. Copy it to `server/data/boards/<board>.json` (e.g. `home.json`). Create the folder if needed.
3. Start/restart the server: it detects the export format and loads it.

(The legacy single-board `data/board.json` is automatically migrated to the `home` board.)

## Configuration (environment variables)

| Variable          | Role                                 | Default                     |
|-------------------|---------------------------------------|-----------------------------|
| `BETE_ID`         | Forces the peer id                    | remembered in `data/peer-id`|
| `BETE_DATA`       | Data folder                           | `./data`                    |
| `BETE_APP_URL`    | Base of the displayed URL (optional)  | (none — generic relative link) |
| `BETE_MAX_BOARDS` | Limit of boards kept in memory        | `300`                       |

## Running as a service (systemd)

`/etc/systemd/system/bete.service`:

```ini
[Unit]
Description=Bete host
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/home/pi/bete/server
Environment=BETE_APP_URL=https://your-domain.example/
ExecStart=/usr/bin/node bete-host.js
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bete
journalctl -u bete -f   # view logs / the id
```

## Notes

- **Encrypted P2P connection** (WebRTC) via the public PeerJS broker for
  connection setup; PeerJS TURN relay if a direct connection fails. No board
  data ever passes through the broker.
- Only one host per id at a time. If the id is already taken (another
  instance, or the broker hasn't released it yet), the server retries automatically.
- Simple JSON file storage; for versioned backups, add the `data/` folder to
  a regular backup routine (cron, git, rsync…).
