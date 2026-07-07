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

## Read-only boards (owner token)

A board can be locked ("Read-only for guests" in the app's Settings > Liaisons)
so only its **owner** can edit; everyone else can only watch (see cursors,
hear voice chat, still get audio/image assets on demand).

Since every connection to this server is symmetric (no built-in notion of
"the host" the way a browser hosting its own liaison has), ownership is
tracked per board via a random **owner token**: the first browser that ever
connects to a fresh board is automatically adopted as its owner (the token is
generated client-side, stored in that browser's `localStorage`, and sent on
every connection). Later connections are only recognized as owner if they
present the same token. This is stored in the board's file
(`server/data/boards/<board>.json`, fields `ownerToken` / `readOnly`).

**Lost the owner token** (cleared browser storage, different device, etc.)?
Edit the board's JSON file directly on the server and remove the `ownerToken`
field (or delete it and restart the server), then reconnect from the browser
you want to be the new owner — it will be re-adopted as the fresh board's owner.

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
| `BETE_ICS_PORT`   | ICS proxy port (`0` disables it)      | `9741`                      |

### ICS proxy

The app's calendar blocks (a rectangle whose link points to a `.ics` file)
usually can't fetch the feed directly from the browser: most calendar hosts
(Google, iCloud...) don't send CORS headers. The host exposes a tiny relay for
that: `GET http://<pi>:9741/ics?url=<https://...ics>` fetches the feed
server-side and re-serves it with permissive CORS (only `.ics` URLs, 2 MB
cap, nothing else is proxied). Point the app at it via Settings > ICS proxy
(e.g. `http://raspberrypi.local:9741`).

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
