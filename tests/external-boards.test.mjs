import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { githubSource, parseExternalBoardLink } from '../js/external-source.js';
test('manual external links accept viewer URLs, identifiers and root main-branch JSON files',()=>{
 for(const value of ['usini/bete/demo','usini-bete-demo','https://bete.usini.eu/?github=usini%2Fbete%2Fdemo','?github=usini-bete-demo','https://github.com/usini/bete/blob/main/demo.json','https://raw.githubusercontent.com/usini/bete/main/demo.json']) assert.equal(parseExternalBoardLink(value)?.id,'usini/bete/demo',value);
 for(const value of ['https://evil.test/?github=usini-bete-demo','javascript:alert(1)','https://github.com/usini/bete/blob/dev/demo.json','https://github.com/usini/bete/blob/main/sub/demo.json','https://user:secret@bete.usini.eu/?github=usini-bete-demo']) assert.equal(parseExternalBoardLink(value),null,value);
});
test('manual links deduplicate, persist and can be removed without downloading or deleting a remote file',async()=>{
 const values=new Map();let writes=0;
 const source=readFileSync(new URL('../js/external-board.js',import.meta.url),'utf8').replace(/^(?:import .*|export \{.*\} from .*);\r?\n/gm,'').replaceAll('export ','');
 const ctx=vm.createContext({githubSource,parseExternalBoardLink,location:{search:'',origin:'https://bete.usini.eu'},URLSearchParams,localStore:{getItem:key=>values.get(key),setItem:async(key,value)=>{writes++;values.set(key,value);return true;}},fetch:()=>{throw Error('No network expected');}});
 vm.runInContext(source,ctx);await vm.runInContext('addExternalBoard("usini/bete/demo")',ctx);await vm.runInContext('addExternalBoard("https://bete.usini.eu/?github=usini-bete-demo")',ctx);
 assert.equal(vm.runInContext('recentGithubBoards().length',ctx),1);await vm.runInContext('removeExternalBoard("usini/bete/demo")',ctx);assert.equal(vm.runInContext('recentGithubBoards().length',ctx),0);assert.equal(writes,3);
 await assert.rejects(vm.runInContext('addExternalBoard("https://evil.test")',ctx));assert.equal(writes,3);
});

test('the GitHub Electronique link is accepted directly from the file page',()=>{
 const board=parseExternalBoardLink('https://github.com/remisarrailh/bete-pages/blob/main/Electronique.json');
 assert.equal(board.id,'remisarrailh/bete-pages/Electronique');
 assert.equal(board.url,'https://raw.githubusercontent.com/remisarrailh/bete-pages/main/Electronique.json');
});
