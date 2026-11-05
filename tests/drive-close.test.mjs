import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function client(remote, failUpload=false) {
 const calls=[];
 const element={dataset:{},setAttribute(){}};
 const source=readFileSync(new URL('../js/drive.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
 const ctx=vm.createContext({
  localStore:{getItem:()=>null,removeItem(){},setItem(){}},state:{nodes:[{id:'a',text:'local'}]},
  serialize:()=>({nodes:ctx.state.nodes,camera:ctx.state.camera}),document:{getElementById:()=>element},notify(){},updateBackupSize(){},
  URLSearchParams,AbortSignal,Response,console,exportData:async()=>({nodes:ctx.state.nodes}),
  fetch:async(url,options={})=>{calls.push(options.method||'GET');if(url.includes('/upload/')) {if(failUpload)throw new TypeError('offline');return Response.json({id:'file',modifiedTime:'new'});}return Response.json({files:remote?[remote]:[]});},
 });
 vm.runInContext(source+"\nmeta={linked:true,fileId:'file',remoteModified:'old'};token='valid';tokenExpiry=Date.now()+600000;",ctx);
 return {ctx,calls};
}
test('desktop shutdown awaits the upload and updates Drive metadata',async()=>{
 const {ctx,calls}=client({id:'file',modifiedTime:'old'});
 await vm.runInContext('saveDriveBeforeClose()',ctx);assert.deepEqual(calls,['GET','PATCH']);assert.equal(vm.runInContext('dirty',ctx),false);assert.equal(vm.runInContext('meta.remoteModified',ctx),'new');
});
test('newer remote data or failed uploads block shutdown, disconnected Drive is skipped',async()=>{
 const conflict=client({id:'file',modifiedTime:'changed'});await assert.rejects(vm.runInContext('saveDriveBeforeClose()',conflict.ctx));assert.deepEqual(conflict.calls,['GET']);
 const offline=client({id:'file',modifiedTime:'old'},true);await assert.rejects(vm.runInContext('saveDriveBeforeClose()',offline.ctx));
 const unlinked=client(null);vm.runInContext('meta=null;',unlinked.ctx);assert.equal((await vm.runInContext('saveDriveBeforeClose()',unlinked.ctx)).skipped,true);assert.deepEqual(unlinked.calls,[]);
});
test('shutdown waits for an existing Drive operation to finish before starting another',async()=>{
 const {ctx,calls}=client({id:'file',modifiedTime:'old'});vm.runInContext('busy=true;',ctx);
 const pending=vm.runInContext('saveDriveBeforeClose()',ctx);await Promise.resolve();assert.deepEqual(calls,[]);
 vm.runInContext('busy=false;releaseIdle();',ctx);await pending;assert.deepEqual(calls,['GET','PATCH']);
});

test('unchanged desktop shutdown skips all network requests, but real changes still upload',async()=>{
 const {ctx,calls}=client({id:'file',modifiedTime:'old'});
 vm.runInContext('meta.sig=hash(nodesJson());dirty=true;',ctx);
 assert.equal((await vm.runInContext('saveDriveBeforeClose()',ctx)).skipped,true);assert.deepEqual(calls,[]);
 vm.runInContext('state.nodes[0].text="changed";',ctx);
 assert.equal((await vm.runInContext('saveDriveBeforeClose()',ctx)).skipped,false);assert.deepEqual(calls,['GET','PATCH']);
 assert.equal((await vm.runInContext('saveDriveBeforeClose()',ctx)).skipped,true);assert.deepEqual(calls,['GET','PATCH']);
});

test('panning and zooming the view do not dirty Drive or trigger a closing upload',async()=>{
 const {ctx,calls}=client({id:'file',modifiedTime:'old'});
 vm.runInContext('state.camera={x:0,y:0,zoom:1};meta.sig=hash(nodesJson());',ctx);
 assert.equal(vm.runInContext('hasPendingDriveChanges()',ctx),false);
 vm.runInContext('state.camera={x:1000,y:-500,zoom:.25};',ctx);
 assert.equal(vm.runInContext('hasPendingDriveChanges()',ctx),false);
 assert.equal((await vm.runInContext('saveDriveBeforeClose()',ctx)).skipped,true);assert.deepEqual(calls,[]);
 vm.runInContext('state.nodes[0].x=50;',ctx);
 assert.equal(vm.runInContext('hasPendingDriveChanges()',ctx),true);
});
