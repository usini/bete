import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/drive.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
test('Android uses native Google authorization and retries a rejected Drive token without browser OAuth',async()=>{
 const calls=[],writes=[],requests=[];let tokens=0;
 const c=vm.createContext({__BETE_ANDROID_NATIVE__:{core:{async invoke(command){calls.push(command);if(command==='drive_logout')return null;return {access_token:'android-'+(++tokens),expires_in:3300};}}},
 localStore:{getItem:()=>null,removeItem(){},setItem:(key,value)=>writes.push(value)},state:{nodes:[]},notify(){},document:{},AbortSignal,
 fetch:async(url,opts)=>{assert.ok(url.startsWith('https://www.googleapis.com/'));requests.push(opts.headers.Authorization);return requests.length===1?new Response('',{status:401}):Response.json({files:[]})}});
 vm.runInContext(source+'\nrenderIndicator=()=>{};globalThis.client={requestToken,api,authRequest};',c);
 await c.client.requestToken();await c.client.api('https://www.googleapis.com/drive/v3/files');await c.client.authRequest('/logout');
 assert.deepEqual(calls,['drive_login','drive_token','drive_logout']);assert.deepEqual(requests,['Bearer android-1','Bearer android-2']);assert.equal(writes.length,0);
});
test('Android silent authorization does not show login and offline failures leave local blocks intact',async()=>{
 const local={id:'local'};let mode='unlinked';const c=vm.createContext({__BETE_ANDROID_NATIVE__:{core:{async invoke(command){assert.equal(command,'drive_token');if(mode==='offline')throw Error('Hors connexion');return null;}}},
 localStore:{getItem:()=>null,removeItem(){}},state:{nodes:[local]},notify(){},document:{},fetch(){throw Error('Unexpected browser auth')}});
 vm.runInContext(source+'\nrenderIndicator=()=>{};globalThis.client={ensureToken};',c);
 await assert.rejects(c.client.ensureToken());mode='offline';await assert.rejects(c.client.ensureToken(),/Hors connexion/);assert.equal(c.state.nodes[0],local);
});
