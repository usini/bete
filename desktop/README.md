# Bete — Windows desktop wrapper (Tauri)

Packages the existing static web app (`index.html`, `css/`, `js/`, `assets/`) as
a native Windows app via [Tauri](https://tauri.app/) — no changes to the web
app itself, no bundler, same code running inside a WebView2 window instead of
a browser tab.

## Prerequisites

- Rust (`rustup`) + the MSVC C++ build tools (Visual Studio Build Tools,
  "Desktop development with C++" workload).
- Node.js (only used here, for the Tauri CLI — the web app itself still has
  no npm dependency).

## Commands (run from this `desktop/` folder)

```bash
npm install       # once, installs @tauri-apps/cli locally
npm run dev       # sync the static files + launch a dev window
npm run build     # sync the static files + produce the installer
```

`npm run build` outputs an NSIS installer at:
`src-tauri/target/release/bundle/nsis/Bete_<version>_x64-setup.exe`

## How it stays in sync with the web app

`scripts/sync.mjs` copies `index.html`, `css/`, `js/`, `assets/` from the repo
root into `desktop/dist/` (gitignored, regenerated on every `dev`/`build`).
`tauri.conf.json`'s `frontendDist` points at that folder — nothing here is a
fork of the app, it's the same files repackaged. There is no cache-busting
concern (no browser cache to bust in a packaged app), so `cachebust.mjs`
doesn't need to run before packaging.

## Releasing (GitHub Actions -> GitHub Release -> in-app auto-update)

`.github/workflows/desktop-release.yml` builds the app on `windows-latest`,
signs it, and publishes it to a GitHub Release whenever a tag matching
`desktop-v*` is pushed:

```bash
# 1. bump the version in both files (keep them in sync)
#    desktop/src-tauri/tauri.conf.json -> "version"
#    desktop/src-tauri/Cargo.toml      -> [package] version
git add desktop/src-tauri/tauri.conf.json desktop/src-tauri/Cargo.toml
git commit -m "Bump desktop version to 0.2.0"
git tag desktop-v0.2.0
git push origin main desktop-v0.2.0
```

The workflow needs two repo secrets to sign the update artifacts (set once,
via GitHub Settings > Secrets and variables > Actions, or `gh secret set`):
- `TAURI_SIGNING_PRIVATE_KEY` — contents of the `.key` file from
  `npx tauri signer generate` (run once, keep the `.key` file OUTSIDE the repo).
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password chosen for that key.

The corresponding **public** key lives in `src-tauri/tauri.conf.json` under
`plugins.updater.pubkey` — that one is safe to commit, it only verifies
signatures, it can't create them.

Each release publishes the NSIS installer + a `latest.json` manifest. Running
desktop apps poll `js/update.js` (via the `tauri-plugin-updater`, pointed at
`.../releases/latest/download/latest.json`) on every boot; if a newer signed
version is found, a popup offers to download, install, and relaunch.

## Notes

- P2P sync (PeerJS/WebRTC) works the same as in a browser — no native
  networking code was added.
- The window uses the system WebView2 runtime (preinstalled on Windows 11,
  auto-installed on Windows 10 by the NSIS installer) — this is why the
  installer is a few MB instead of the ~150 MB an Electron app would need.
- App icon: `src-tauri/icons/app-icon.png` is a simple placeholder (dark
  background, neon-green square outline) generated to match the pixel-art
  favicon; regenerate everything from a new source with
  `npm run icon` (wraps `tauri icon`).
