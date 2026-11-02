import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/storage.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
function client(doc, blobs = {}) {
  let imported, reads = 0, writes = 0;
  const context = vm.createContext({
    serialize: () => structuredClone(doc), isLocked: () => false,
    refToDataUrl: async ref => { reads++; return blobs[ref] || null; },
    addDataUrl: async () => 'idb:restored-' + (++writes),
    setDoc: value => { imported = value; },
  });
  vm.runInContext(source+'\nglobalThis.api = {exportData,importData};',context);
  return {api:context.api, imported:()=>imported, counts:()=>({reads,writes})};
}

test('export stores identical image bytes once across current blocks and 60 history states', async () => {
  const data='data:image/png;base64,'+'A'.repeat(100000);
  const nodes=[{id:'a',image:'idb:first'},{id:'b',image:'idb:alias'},{id:'c',image:data}];
  const doc={nodes,history:{pos:59,states:Array.from({length:60},()=>({nodes}))}};
  const app=client(doc,{'idb:first':data,'idb:alias':data});
  const result=await app.api.exportData();
  assert.equal(result.version,2);assert.equal(Object.keys(result.assets).length,1);
  assert.equal(result.assets['image-1'],data);
  assert.ok(result.nodes.every(n=>n.image==='asset:image-1'));
  assert.equal(result.history.states[0].nodes[0].image,'asset:image-1');
  assert.ok(JSON.stringify(result).length<130000,'image size must not multiply by history length');
  assert.equal(doc.nodes[0].image,'idb:first','export must not mutate the live board');
  await app.api.importData(result);
  assert.equal(app.counts().writes,1);
  assert.equal(app.imported().nodes[0].image,app.imported().history.states[59].nodes[2].image);
});

test('legacy inline images import once and missing assets never replace the current board', async () => {
  const data='data:image/png;base64,AAAA';
  const app=client({nodes:[]});
  await app.api.importData({version:1,nodes:[{image:data}],history:{states:[{nodes:[{image:data}]}]}});
  assert.equal(app.counts().writes,1);
  const previous=app.imported();
  await assert.rejects(app.api.importData({version:2,nodes:[{image:'asset:missing'}],assets:{}}),/absente ou invalide/);
  assert.equal(app.imported(),previous);
  const missing=client({nodes:[{image:'idb:missing'}]});
  await assert.rejects(missing.api.exportData(),/image manque/);
});
