import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('history round trip retains undo and redo, accepts legacy boards and sanitizes imports', () => {
  const source = readFileSync(new URL('../js/history.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
  function board() {
    let adapter;
    const elements = new Map();
    const state = { nodes: [{ id: 'a', text: 'one' }] };
    const context = vm.createContext({
    isLocked: () => false, modeEvents: {addEventListener(){}}, state, Date, Map, Set,
      document: { getElementById(id) { if(!elements.has(id)) elements.set(id, {hidden:true, addEventListener(){}}); return elements.get(id); }, addEventListener(){} },
      onSaved(){}, saveNow(){adapter.save();}, sanitizeNode: n => n && typeof n.id === 'string' ? {id:n.id, text:String(n.text)} : null,
      replaceNodes(nodes){state.nodes=nodes;},
      registerHistory(a){adapter=a; a.load(null);},
    });
    vm.runInContext(source+'\nglobalThis.api={initHistory,undo,redo,clearHistory};',context);
    context.api.initHistory();
    return {state, api:context.api, save:()=>adapter.save(), load:h=>adapter.load(h)};
  }
  const a=board();
  a.state.nodes[0].text='two'; a.save();
  a.state.nodes[0].text='three'; a.save();
  a.api.undo(); assert.equal(a.state.nodes[0].text,'two');
  const saved=JSON.parse(JSON.stringify(a.save()));
  const b=board(); b.state.nodes=[{id:'a',text:'two'}]; b.load(saved);
  b.api.redo(); assert.equal(b.state.nodes[0].text,'three');
  b.api.undo(); b.api.undo(); assert.equal(b.state.nodes[0].text,'one');
  b.load(undefined); assert.equal(b.save().states.length,1);
  b.load({states:[null,{nodes:[null,{id:'a',text:'one'}],label:'x',t:0}],pos:0});
  assert.equal(b.save().states.length,1);
  a.api.clearHistory();
  assert.equal(a.save().states.length,1);
  assert.equal(a.state.nodes[0].text,'two');
  a.api.undo();assert.equal(a.state.nodes[0].text,'two');
  a.state.nodes[0].text='after clear';a.save();a.api.undo();assert.equal(a.state.nodes[0].text,'two');
});
