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
