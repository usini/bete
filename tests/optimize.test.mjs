import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../js/optimize.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
test('optimization deduplicates shared images, respects protected originals and clears history after completion',async()=>{
 const nodes=[{id:'a',image:'idb:old'},{id:'b',image:'idb:old'},{id:'c',image:'idb:old',keepImageOriginal:true},{id:'d',image:'idb:bad'}];
 const calls=[];
 const ctx=vm.createContext({state:{nodes},getNode:id=>nodes.find(n=>n.id===id),optimizeImage:async ref=>{calls.push(ref);if(ref==='idb:bad')throw Error('decode');return 'idb:new';},clearHistory:()=>calls.push('clear'),emit:()=>calls.push('emit')});
 vm.runInContext(source,ctx);const result=await vm.runInContext('optimizeBoardImages()',ctx);
 assert.equal(result.count,2);assert.equal(result.failures,1);assert.equal(nodes[0].image,'idb:new');assert.equal(nodes[2].image,'idb:old');assert.equal(nodes[3].image,'idb:bad');assert.deepEqual(calls,['idb:old','idb:bad','clear','emit']);
});
test('an empty optimization still removes undo history and parallel calls share the same operation',async()=>{
 let cleared=0;
 const ctx=vm.createContext({state:{nodes:[]},getNode(){},optimizeImage(){},clearHistory:()=>cleared++,emit(){}});
 vm.runInContext(source,ctx);assert.equal(vm.runInContext('optimizeBoardImages() === optimizeBoardImages()',ctx),true);
 await vm.runInContext('optimizeBoardImages()',ctx);assert.equal(cleared,1);
});
