# Bete OAuth — VPS, Portainer and Cloudflare Tunnel

The static app stays on GitHub Pages. This service only exchanges Google OAuth tokens.
Boards travel directly between the browser and Drive. There is no user database or volume.
Refresh tokens are AES-256-GCM encrypted in host-only, HttpOnly, Secure, SameSite=Lax cookies.
The server decrypts them during renewal; this is not end-to-end encryption. Cloudflare terminates
HTTPS and also handles authentication traffic. Never enable request/cookie/body logging on this host.

## 1. Google Cloud

Use the EXISTING Google project and OAuth web client to preserve the app's Drive data access.
Enable Google Drive API. Under Google Auth Platform > Clients, select the web client:

- Authorized JavaScript origin: `https://bete.usini.eu`.
- Authorized redirect URI: `https://auth-bete.usini.eu/callback` (exactly).
- Keep only the Drive scope `https://www.googleapis.com/auth/drive.appdata`.
- Configure the consent screen, domain and privacy URL. Check publishing status: external
  Testing refresh tokens for this scope expire after seven days. Publish appropriately before
  relying on durable sessions; Google may require additional configuration or verification.

Copy the client ID and secret into Portainer, never into the static site or Git.
Existing users must connect once using the new flow. Existing Drive backups stay in place.

## 2. Host cloudflared service

cloudflared runs as a service directly on the VPS. No shared or external Docker network is needed.
Docker publishes the OAuth service on `127.0.0.1:3100` by default, reachable by cloudflared on
that host. The stack does not modify or restart the existing tunnel.

## 3. Create the Portainer stack

This file targets Docker Standalone in Portainer. It uses no `configs.content` mounts.
Create a stack, paste ALL of `compose.portainer.yml` into Web editor. It embeds the service code;
no repository checkout, Docker build, bind mount, config mount, or private image is required.
The source is embedded as a base64 data URL in the Node command (encoding, not encryption);
there are no secrets in this embedded source.

In the stack's Environment variables section set:

| Variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Existing OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | That client's secret |
| `COOKIE_KEY` | A fresh random 32-byte key, base64 encoded |
| `HOST_PORT` | Optional host port, default `3100` (e.g. `8187`) |
| `BIND_ADDRESS` | Optional host bind address, default `127.0.0.1` |

Generate COOKIE_KEY on the VPS with `openssl rand -base64 32`. Keep it private and retain it
across redeployments. Changing it invalidates all saved cookies. Portainer admins can access
container environment variables. Do not paste secrets into chat, source files or screenshots.

Deploy. The container should become healthy. Its internal service address is `http://bete-auth:3000`.
To change the published port, set only `HOST_PORT` in Portainer and redeploy. The internal port
stays `3000`, including the healthcheck. For example `HOST_PORT=8187` publishes `127.0.0.1:8187`.

In the existing cloudflared tunnel, use `http://127.0.0.1:3100` by default, or
`http://127.0.0.1:8187` if you set `HOST_PORT=8187`. Keep BIND_ADDRESS at `127.0.0.1`.
No Docker network configuration is required.

## 4. Cloudflare Tunnel

On the EXISTING tunnel, add a published application route:

- Public hostname: `auth-bete.usini.eu`.
- Service type: HTTP.
- Service URL: `127.0.0.1:3100` (or the value of HOST_PORT).

Let Cloudflare create the DNS record; resolve any conflicting record for that hostname first.
Do not add Cloudflare Access authentication or interactive challenges in front of this service:
the browser must reach `/token`, including OPTIONS preflight, with credentials.
Ensure no cache rule overrides `Cache-Control: no-store`. Add a cache bypass for the entire host.
Avoid recording query strings on `/callback` (they contain one-time authorization codes).
Use Cloudflare rate limiting for abuse if needed without challenging normal token requests.

Open `https://auth-bete.usini.eu/health`: expect `{"ok":true}`. This only checks the service,
not Google credentials, cookies or the full OAuth exchange.

## 5. Publish and validate Bete

Deploy the updated static files AFTER the auth service is reachable. `js/drive.js` uses
`https://auth-bete.usini.eu`. If forking, change this URL and both configured origins together.
The production site and auth service must remain HTTPS sites under usini.eu for SameSite=Lax.
Localhost and GitHub's github.io hostname are intentionally not authorized by this configuration.

Test in the production browser:

1. Connect Google Drive. Confirm the only requested Drive permission is the app data folder.
2. Save a board, reload and verify that no new Google prompt is needed.
3. Check storage: no `bete2:driveToken` in localStorage; refresh cookie is HttpOnly/Secure on auth host.
4. Leave the app for more than an hour; edit and save again without reconnecting.
5. Connect a second device and verify remote restore and conflict choices without losing local data.
6. Disconnect: cookie is deleted, Google revocation requested, Drive backup remains.
7. Revoke Bete manually from Google account permissions; the app should request reconnection.

Drive saves are manual. Closing or hiding the page only flushes local storage; unsaved Drive changes
trigger the browser's standard leave-page warning where supported, without starting an upload.
Reloading restores authorization but does not upload or replace the local board.
Google/browser policies, revoked access, cleared cookies
and cookie lifetime limits can still require reconnection. Cookie Max-Age is one year at most,
not a promise of a permanent Google session.

## Development

`node --test auth/server.test.mjs` exercises state validation, cookie tampering, refresh, CORS
and logout against a fake Google endpoint. It does not validate live Google or browser behavior.
After changing server.mjs run `node auth/generate-compose.mjs` and update the Portainer stack.
After changing client modules run `node cachebust.mjs` before deployment.

References: [Google web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[Cloudflare published applications](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/).
