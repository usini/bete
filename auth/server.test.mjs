import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAuthServer } from './server.mjs';

test('OAuth cookies, state validation, refresh, CORS and logout', async () => {
  const calls = [];
  const origin = 'https://bete.usini.eu';
  const server = createAuthServer({ APP_ORIGIN: origin, PUBLIC_URL: 'https://auth-bete.usini.eu', GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'secret', COOKIE_KEY: randomBytes(32).toString('base64') }, async (url, options) => {
    calls.push({ url, body: options.body });
    return Response.json(url.endsWith('/revoke') ? {} : { access_token: 'access-test', expires_in: 3600, ...(options.body.get('grant_type') === 'authorization_code' ? { refresh_token: 'refresh-secret' } : {}) });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, cookie, from = origin) => fetch(base + path, { method: 'POST', headers: { Origin: from, 'X-Bete-Request': '1', Cookie: cookie } });
  try {
    assert.equal((await post('/token', '', 'https://evil.example')).status, 403);
    assert.equal((await post('/token', '')).status, 401);
    const preflight = await fetch(base + '/token', { method: 'OPTIONS', headers: { Origin: origin } });
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
    const login = await fetch(base + '/login', { redirect: 'manual' });
    const target = new URL(login.headers.get('Location'));
    assert.equal(target.searchParams.get('access_type'), 'offline');
    assert.equal(target.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.appdata');
    const flow = login.headers.getSetCookie()[0].split(';')[0];
    assert.equal((await fetch(base + '/callback?state=bad&code=test', { headers: { Cookie: flow } })).status, 400);
    assert.equal(calls.length, 0);
    const callback = await fetch(base + '/callback?state=' + target.searchParams.get('state') + '&code=test', { headers: { Cookie: flow } });
    assert.equal(callback.status, 200);
    const html = await callback.text();
    assert.ok(!html.includes('access-test'));
    const session = callback.headers.getSetCookie().find(c => c.startsWith('__Host-bete-refresh='));
    assert.ok(session.includes('HttpOnly; Secure; SameSite=Lax'));
    assert.ok(!session.includes('refresh-secret'));
    const jar = session.split(';')[0];
    const refreshed = await post('/token', jar);
    assert.equal((await refreshed.json()).access_token, 'access-test');
    assert.equal(calls.at(-1).body.get('refresh_token'), 'refresh-secret');
    assert.equal((await post('/token', jar + 'tamper')).status, 401);
    const logout = await post('/logout', jar);
    assert.equal(logout.status, 200);
    assert.ok(logout.headers.getSetCookie()[0].includes('Max-Age=0'));
    assert.ok(calls.at(-1).url.endsWith('/revoke'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
