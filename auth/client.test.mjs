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
    isLocked: () => false, modeEvents: {addEventListener(){}},
    notify: () => {},
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

test('Drive stays manual; hiding only saves locally and leaving warns only for pending changes', async () => {
  const source = readFileSync(new URL('../js/drive.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
  const elements = new Map(), windowEvents = new Map(), documentEvents = new Map();
  let saved, localSaves = 0, networkCalls = 0, intervals = 0;
  const context = vm.createContext({
    isLocked: () => false, modeEvents: {addEventListener(){}}, notify(){},
    localStorage: {getItem:()=>null, removeItem(){}, setItem(){}},
    state: {nodes:[{id:'local',text:'before'}]}, AbortSignal,
    document: {visibilityState:'visible', addEventListener:(name,fn)=>documentEvents.set(name,fn),
      getElementById(id) {
        if (!elements.has(id)) elements.set(id,{dataset:{},setAttribute(){},addEventListener(){}});
        return elements.get(id);
      }},
    window: {addEventListener:(name,fn)=>windowEvents.set(name,fn)},
    onSaved: fn => {saved=fn;}, saveNow:()=>{localSaves++;saved();},
    setInterval:()=>{intervals++;},
    fetch:async()=>{networkCalls++;throw new Error('Unexpected background request');},
  });
  vm.runInContext(source+`
    meta={linked:true,sig:hash(nodesJson())};token='valid';tokenExpiry=Date.now()+3600000;
    globalThis.client={initDrive,change(){state.nodes[0].text='after';},unlink(){meta=null;},
      markSaved(){meta.sig=hash(nodesJson());dirty=false;}};
  `,context);
  context.client.initDrive();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(intervals,0);
  const leave=()=>{const e={prevented:false,preventDefault(){this.prevented=true;}};windowEvents.get('beforeunload')(e);return e;};
  assert.equal(leave().prevented,false);
  context.client.change();
  context.document.visibilityState='hidden';documentEvents.get('visibilitychange')();
  context.document.visibilityState='visible';documentEvents.get('visibilitychange')();
  assert.equal(leave().prevented,true);
  assert.equal(networkCalls,0);
  assert.ok(localSaves>=3);
  context.client.markSaved();assert.equal(leave().prevented,false);
  context.client.change();context.client.unlink();assert.equal(leave().prevented,false);
});
