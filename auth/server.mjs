import http from 'node:http';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SESSION = '__Host-bete-refresh';
const FLOW = '__Host-bete-flow';
const YEAR = 365 * 86400;

export function createAuthServer(env = process.env, fetcher = fetch) {
  const origin = new URL(env.APP_ORIGIN).origin;
  const publicUrl = new URL(env.PUBLIC_URL);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || publicUrl.protocol !== 'https:' || !origin.startsWith('https:')) throw new Error('Invalid OAuth configuration');
  const key = Buffer.from(env.COOKIE_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('COOKIE_KEY must be 32 random bytes encoded as base64');
  const callback = publicUrl.origin + '/callback';
  function seal(value) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString('base64url');
  }
  function unseal(value, kind) {
    try {
      const b = Buffer.from(value || '', 'base64url');
      const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
      d.setAuthTag(b.subarray(-16));
      const obj = JSON.parse(Buffer.concat([d.update(b.subarray(12, -16)), d.final()]));
      return obj.kind === kind && obj.exp > Date.now() ? obj : null;
    } catch { return null; }
  }
  const cookie = (name, val, age) => `${name}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split(/=(.*)/s)).filter(x => x[0]));
  async function exchange(params) {
    const response = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params }),
    });
    const data = await response.json();
    if (!response.ok) {
      const e = new Error('OAuth exchange failed');
      e.status = data.error === 'invalid_grant' ? 401 : 502;
      throw e;
    }
    if (!data.access_token || !Number.isFinite(Number(data.expires_in))) throw new Error('Invalid OAuth response');
    if (data.scope && !data.scope.split(' ').includes(SCOPE)) throw new Error('Missing Drive scope');
    return data;
  }
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, publicUrl);
      const jar = cookies(req);
      if (req.headers.origin === origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'GET' && url.pathname === '/health') return json(200, { ok: true });
      if (['/token', '/logout'].includes(url.pathname)) {
        if (req.headers.origin !== origin) return json(403, { error: 'origin_denied' });
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Methods', 'POST');
          res.setHeader('Access-Control-Allow-Headers', 'X-Bete-Request');
          res.writeHead(204); return res.end();
        }
        if (req.method !== 'POST' || req.headers['x-bete-request'] !== '1') return json(403, { error: 'request_denied' });
        const session = unseal(jar[SESSION], 'refresh');
        if (url.pathname === '/logout') {
          res.setHeader('Set-Cookie', [cookie(SESSION, '', 0), cookie(FLOW, '', 0)]);
          if (session) {
            try {
              const revoked = await fetcher('https://oauth2.googleapis.com/revoke', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: session.token }) });
              if (!revoked.ok) return json(502, { error: 'revoke_failed' });
            } catch { return json(502, { error: 'revoke_failed' }); }
          }
          return json(200, { ok: true });
        }
        if (!session) return json(401, { error: 'auth_required' });
        const data = await exchange({ grant_type: 'refresh_token', refresh_token: session.token });
        if (data.refresh_token) res.setHeader('Set-Cookie', cookie(SESSION, seal({ kind: 'refresh', token: data.refresh_token, exp: session.exp }), Math.max(0, Math.floor((session.exp - Date.now()) / 1000))));
        return json(200, { access_token: data.access_token, expires_in: data.expires_in });
      }
      if (req.method === 'GET' && url.pathname === '/login') {
        const state = randomBytes(32).toString('base64url'), verifier = randomBytes(32).toString('base64url');
        res.setHeader('Set-Cookie', cookie(FLOW, seal({ kind: 'flow', state, verifier, exp: Date.now() + 600000 }), 600));
        const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        target.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callback, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
        res.writeHead(302, { Location: target.href }); return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/callback') {
        const flow = unseal(jar[FLOW], 'flow');
        res.setHeader('Set-Cookie', cookie(FLOW, '', 0));
        if (!flow || flow.state !== url.searchParams.get('state')) return json(400, { error: 'invalid_state' });
        let ok = false;
        if (!url.searchParams.has('error') && url.searchParams.get('code')) {
          const data = await exchange({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: callback, code_verifier: flow.verifier });
          if (!data.refresh_token) throw new Error('Missing refresh token');
          res.setHeader('Set-Cookie', [cookie(FLOW, '', 0), cookie(SESSION, seal({ kind: 'refresh', token: data.refresh_token, exp: Date.now() + YEAR * 1000 }), YEAR)]);
          ok = true;
        }
        const nonce = randomBytes(16).toString('base64');
        res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset="utf-8"><title>Bête — Google Drive</title><p>${ok ? 'Connexion réussie. Tu peux fermer cette fenêtre.' : 'Connexion annulée. Tu peux fermer cette fenêtre.'}</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage({type:'bete-oauth',ok:${ok}},${JSON.stringify(origin)});window.close()}</script>`);
      }
      json(404, { error: 'not_found' });
    } catch (e) {
      if (e.status === 401) res.setHeader('Set-Cookie', cookie(SESSION, '', 0));
      // Never log requests, cookies, Google responses or exception messages containing secrets.
      json(e.status || 502, { error: e.status === 401 ? 'auth_required' : 'oauth_unavailable' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createAuthServer().listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Bete OAuth listening'));
}
