import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/fx.js',import.meta.url),'utf8').replaceAll('export ','');
function effects(){const ctx=vm.createContext({Math:Object.create(Math)});ctx.Math.random=()=>.5;vm.runInContext(source,ctx);return ctx;}
test('deleting transparent blocks produces visible particles while colored blocks keep their color',()=>{
 for(const color of ['transparent','#00b7eb']){const ctx=effects();ctx.color=color;vm.runInContext('explode(0,0,200,100,color);',ctx);assert.equal(vm.runInContext('particles[0].color',ctx),color==='transparent'?'#f2f2f2':color);assert.ok(vm.runInContext('hasParticles()',ctx));}
});
test('particles scale with large blocks and expire after their animation',()=>{
 const small=effects(),large=effects();vm.runInContext('explode(0,0,200,160,"transparent");',small);vm.runInContext('explode(0,0,2000,1600,"transparent");',large);
 assert.equal(vm.runInContext('particles[0].size',large),vm.runInContext('particles[0].size',small)*10);
 assert.equal(vm.runInContext('particles[0].gravity',large),vm.runInContext('particles[0].gravity',small)*10);
 vm.runInContext('for(let t=0;t<2000;t+=16)updateFx(t);',large);assert.equal(vm.runInContext('hasParticles()',large),false);
});
