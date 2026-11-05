import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/desktop.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/function chooseUpdate\(version\) \{[\s\S]*?\nexport async function initDesktop/, 'async function initDesktop');
async function run(choice, saved=true, driveFail=false) {
  const calls=[];let close;
  const element=()=>({addEventListener(){},setAttribute(){},append(){},after(){},show(){},close(){},showModal(){},remove(){}});
  const ctx=vm.createContext({
    window:{__TAURI__:{core:{invoke:async(command,args)=>{calls.push([command,args]);return command==='check_update'?'0.9.0':undefined;}},window:{getCurrentWindow:()=>({onCloseRequested:async fn=>{close=fn;},destroy:async()=>calls.push(['destroy'])})}}},
    document:{createElement:element,querySelector:element,body:{append(){}}},
    isEditing:()=>false,stopEdit(){},waitForDriveIdle:async()=>{calls.push(['idle']);},
    optimizeBoardImages:async()=>{calls.push(['optimize']);return {count:1,failures:0};},
    saveDriveBeforeClose:async()=>{calls.push(['drive']);if(driveFail)throw new Error('Drive hors ligne');},
    initDesktopCalendar(){},chooseUpdate:async()=>choice,saveNow:async()=>{calls.push(['save']);return saved;},flushLocalWrites:async()=>{calls.push(['flush']);return true;},
    notify:message=>calls.push(['error',message]),openLink(){},console,
  });
  vm.runInContext(source,ctx);await vm.runInContext('initDesktop()',ctx);
  return {calls,close};
}
test('install now saves locally and requests relaunch',async()=>{
 const {calls}=await run('now');const update=calls.find(([name])=>name==='install_update');
 assert.equal(update[1].restart,true);assert.equal(update[1].version,'0.9.0');
 assert.ok(calls.findIndex(([n])=>n==='flush')<calls.indexOf(update));
});
test('install on close keeps the app closed after updating',async()=>{
 const {calls,close}=await run('on-close');assert.ok(!calls.some(([n])=>n==='install_update'));
 await close({preventDefault(){}});assert.equal(calls.find(([n])=>n==='install_update')[1].restart,false);
});
test('later does not install and a failed save blocks installation',async()=>{
 assert.ok(!(await run('later')).calls.some(([n])=>n==='install_update'));
 const {calls}=await run('now',false);assert.ok(calls.some(([n])=>n==='error'));assert.ok(!calls.some(([n])=>n==='install_update'));
});

test('normal desktop close optimizes, saves Drive and only then destroys the window',async()=>{
 const {calls,close}=await run('later');await close({preventDefault(){}});
 const names=calls.map(([n])=>n);
 assert.ok(names.indexOf('optimize')<names.indexOf('save'));
 assert.ok(names.indexOf('flush')<names.indexOf('drive'));
 assert.ok(names.indexOf('drive')<names.indexOf('destroy'));
});
test('failed Drive backup keeps the app open and prevents update installation',async()=>{
 for(const choice of ['later','now']) {
  const {calls,close}=await run(choice,true,true);
  if(choice==='later')await close({preventDefault(){}});
  assert.ok(calls.some(([n])=>n==='error'));
  assert.ok(!calls.some(([n])=>n==='destroy'||n==='install_update'));
 }
});
