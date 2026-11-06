import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanXtool, xtoolSummary } from '../js/xtool.js';
test('xTool keeps complete export and resolves active overrides in order',()=>{
 const data={format:'xtool-studio-processing-settings',version:1,payload:{deviceCode:'GS002',custom:{keep:true},displayData:{graph:{profiles:[{id:'p',values:{power:1,speed:80,repeat:1}}],patches:[{id:'unused',profileId:'p',overrides:{power:20}},{id:'active',profileId:'p',overrides:{power:100,speed:600,repeat:5}}],activeBinding:{baseProfileId:'p',patchIds:['active']}}}}};
 assert.deepEqual(cleanXtool(JSON.stringify(data)),data);
 const text=xtoolSummary(data);assert.match(text,/Puissance : 100 %/);assert.match(text,/Vitesse : 600/);assert.match(text,/Passages : 5/);
});
test('xTool rejects invalid, unsupported and oversized exports',()=>{
 for(const input of [null,'broken','{}',JSON.stringify({format:'xtool-studio-processing-settings',version:2,payload:{}}),' '.repeat(500001)])assert.equal(cleanXtool(input),null);
});

test('laser source uses the same label for diode and fibre without altering exports',()=>{
 for(const [source,label] of [['blue','Diode'],['red','Fibre']]) {
  const data={format:'xtool-studio-processing-settings',version:1,payload:{displayData:{graph:{profiles:[{id:'p',values:{processingLightSource:source}}],patches:[],activeBinding:{baseProfileId:'p',patchIds:[]}}}}};
  assert.ok(xtoolSummary(data).includes('Source laser : '+label));
  assert.equal(data.payload.displayData.graph.profiles[0].values.processingLightSource,source);
 }
});
