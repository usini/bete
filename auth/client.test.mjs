import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('browser restores and renews tokens without storing them or proxying Drive data', async () => {
  let now = Date.now(), renewals = 0, driveCalls = 0;
  const removed = [];
  const source = readFileSync(new URL('../js/drive.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
  const context = vm.createContext({
    localStorage: { getItem: () => null, removeItem: k => removed.push(k) },
    document: {}, state: { nodes: [] }, AbortSignal,
    Date: class extends Date { static now() { return now; } },
    fetch: async (url, opts) => {
      if (url === 'https://auth-bete.usini.eu/token') {
        assert.equal(opts.credentials, 'include');
        assert.equal(opts.body, undefined);
        renewals++;
        return Response.json({ access_token: 'access-' + renewals, expires_in: 3600 });
      }
      assert.equal(url, 'https://www.googleapis.com/drive/v3/files');
      driveCalls++;
      return driveCalls === 2 ? new Response('', { status: 401 }) : Response.json({ files: [] });
    },
  });
  vm.runInContext(source + '\nglobalThis.client = { ensureToken, api };', context);
  await Promise.all([context.client.ensureToken(), context.client.ensureToken()]);
  assert.equal(renewals, 1);
  await context.client.api('https://www.googleapis.com/drive/v3/files');
  now += 3600000;
  await context.client.api('https://www.googleapis.com/drive/v3/files');
  assert.equal(renewals, 3); // expiry followed by a rejected access token
  assert.deepEqual(removed, ['bete2:driveToken']);
});
