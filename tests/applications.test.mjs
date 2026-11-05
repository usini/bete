import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanApplication, steamApplicationUri } from '../js/application-model.js';
import { cleanValue } from '../js/group-model.js';
test('Steam links can only launch a numeric game and cannot carry parameters or other commands',()=>{
 assert.equal(steamApplicationUri('steam://run/123'),'steam://rungameid/123');
 for(const url of ['steam://uninstall/123','steam://install/123','steam://rungameid/123?cmd=bad','steam://run/123//flag','file:///C:/Windows/cmd.exe','javascript:alert(1)'])assert.equal(steamApplicationUri(url),null,url);
});
test('portable application blocks cannot import launch permissions, paths, commands or arguments',()=>{
 const raw={reference:'a'.repeat(64),label:'Application',enabled:true,approved:true,path:'C:/Windows/cmd.exe',args:'/c bad',fingerprint:'forged'};
 assert.deepEqual(cleanApplication(raw),{reference:'a'.repeat(64),label:'Application'});
 const clean=cleanValue({kind:'rect',application:raw});assert.deepEqual(clean.application,{reference:'a'.repeat(64),label:'Application'});
 assert.equal(cleanApplication({reference:'../../cmd.exe'}),null);
});

test('WebView2 file drops use a JSON string so Wry does not swallow the additional file object',()=>{
 const source=readFileSync(new URL('../js/applications.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
 let sent;const file={name:'Bambu Studio.lnk'};
 const ctx=vm.createContext({EventTarget,crypto:{randomUUID:()=> 'request-1'},setTimeout:()=>1,clearTimeout(){},notify(){},window:{__TAURI__:{},chrome:{webview:{postMessageWithAdditionalObjects:(message,files)=>{sent={message,files};}}}}});
 vm.runInContext(source,ctx);ctx.file=file;assert.equal(vm.runInContext('dropApplicationFile(file,10,20)',ctx),true);
 assert.equal(typeof sent.message,'string');assert.equal(JSON.parse(sent.message).type,'bete-application-drop');assert.equal(sent.files[0],file);
});

test('application PNG icons survive sanitizing while unsafe image URLs are discarded',()=>{
 const base={reference:'a'.repeat(64),label:'App'};
 const icon='data:image/png;base64,aGVsbG8=';
 assert.equal(cleanApplication({...base,icon}).icon,icon);
 assert.equal(cleanValue({kind:'rect',application:{...base,icon}}).application.icon,icon);
 for(const value of ['https://example.com/icon.png','data:image/svg+xml;base64,aGVsbG8=','data:image/png;base64,'+'a'.repeat(200001)])assert.equal(cleanApplication({...base,icon:value}).icon,undefined);
});
