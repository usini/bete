// Real IndexedDB migration, quota regression and failure recovery in an isolated profile.
const {createRequire}=require('node:module');
const {join,resolve,extname}=require('node:path');
const {readFileSync,existsSync}=require('node:fs');
const http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=createRequire(join(process.env.BETE_QA_MODULES,'package.json'))('playwright');
const root=resolve(__dirname,'..');
let browser,server;
const node={id:'migration-node-0001',kind:'rect',x:0,y:0,w:180,h:110,text:'Avant migration',color:'#ff3030',image:'idb:legacy-image'};
async function modules(page,fn,arg){
  return page.evaluate(async({source,arg})=>{
    const version=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+version),l=await import('/js/local-store.js'+version),i=await import('/js/images.js'+version);
    return new Function('s','l','i','arg','return ('+source+')(s,l,i,arg)')(s,l,i,arg);
  },{source:fn.toString(),arg});
}
(async()=>{
  server=http.createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/seed'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Migration test</title>');}
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root)||!existsSync(file)){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[extname(file)]||'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(r=>server.listen(8093,'127.0.0.1',r));
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8093/seed');
  await page.evaluate(async node=>{
    const doc={nodes:[node],camera:{x:0,y:0,zoom:1},history:{pos:0,states:[{nodes:[node],label:'Ancien historique',t:1}]}};
    localStorage.setItem('bete2:doc',JSON.stringify(doc));
    localStorage.setItem('bete2:lastSize',JSON.stringify({rect:{w:350,h:250}}));
    localStorage.setItem('bete2:drive',JSON.stringify({linked:false,fileId:'retained'}));
    localStorage.setItem('bete2:groupShares','[]');
    localStorage.setItem('bete2:ytTitles',JSON.stringify({abcdefghijk:'Titre conservé'}));
    localStorage.setItem('bete2:driveToken','old-token-must-be-deleted');
    localStorage.setItem('unrelated-key','leave-me-alone');
    await new Promise((resolve,reject)=>{
      const req=indexedDB.open('bete2',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('images');
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction('images','readwrite');
        tx.objectStore('images').put(new Blob(['legacy-image-bytes'],{type:'image/png'}),'legacy-image');
        tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
      };req.onerror=()=>reject(req.error);
    });
  },node);
  await page.goto('http://127.0.0.1:8093/');
  await page.waitForFunction(()=>document.querySelector('#drive-status').textContent);
  const migrated=await modules(page,async(s,l,i)=>{
    await s.saveNow();await l.flushLocalWrites();
    return {node:s.state.nodes[0],label:s.serialize().history.states[0].label,
      image:await(await i.imageBlob('idb:legacy-image')).text(),
      size:JSON.parse(l.localStore.getItem('bete2:lastSize')),drive:JSON.parse(l.localStore.getItem('bete2:drive')),
      title:JSON.parse(l.localStore.getItem('bete2:ytTitles')).abcdefghijk,shares:l.localStore.getItem('bete2:groupShares'),
      legacy:Object.keys(localStorage).filter(k=>k.startsWith('bete2:')),unrelated:localStorage.getItem('unrelated-key'),token:l.localStore.getItem('bete2:driveToken')};
  });
  assert.equal(migrated.node.text,node.text);assert.equal(migrated.label,'Ancien historique');
  assert.equal(migrated.image,'legacy-image-bytes');assert.equal(migrated.size.rect.w,350);
  assert.equal(migrated.drive.fileId,'retained');assert.equal(migrated.title,'Titre conservé');assert.equal(migrated.shares,'[]');
  assert.deepEqual(migrated.legacy,[]);assert.equal(migrated.unrelated,'leave-me-alone');assert.equal(migrated.token,null);
  const large=await modules(page,async(s,l)=>{
    const states=Array.from({length:24},(_,v)=>({label:'Étape '+v,t:v,nodes:Array.from({length:20},(_,j)=>({
      id:'large-node-'+String(j).padStart(5,'0'),kind:'rect',x:j*200,y:0,w:180,h:110,
      text:('version-'+v+'-').padEnd(14000,'x'),color:'transparent'}))}));
    s.setDoc({nodes:states.at(-1).nodes,camera:{x:0,y:0,zoom:1},history:{pos:23,states}});
    const ok=await s.saveNow();await l.flushLocalWrites();
    return {ok,length:l.localStore.getItem('bete2:doc').length};
  });
  assert.equal(large.ok,true);assert.ok(large.length>6_000_000);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#drive-status').textContent);
  assert.deepEqual(await modules(page,s=>({text:s.state.nodes[0].text.slice(0,11),history:s.serialize().history.states.length})),{text:'version-23-',history:24});
  const imageRoundTrip=await modules(page,async(s,l,i)=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const storage=await import('/js/storage.js'+v);
    const doc=s.serialize();
    doc.nodes[0].image='idb:legacy-image';
    for(const entry of doc.history.states) entry.nodes[0].image='idb:legacy-image';
    s.setDoc(doc);
    const exported=await storage.exportData();
    const copies=Object.keys(exported.assets).length;
    await storage.importData(exported);await s.saveNow();
    return {copies,image:await(await i.imageBlob(s.state.nodes[0].image)).text(),history:s.serialize().history.states.length};
  });
  assert.deepEqual(imageRoundTrip,{copies:1,image:'legacy-image-bytes',history:24});
  const savedBeforeFailure=await modules(page,(s,l)=>l.localStore.getItem('bete2:doc'));
  const failure=await modules(page,async(s,l)=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(){if(this.name==='local')throw new DOMException('Disk full','QuotaExceededError');return original.apply(this,arguments);};
    s.state.nodes[0].text='Not persisted';const ok=await s.saveNow();
    IDBObjectStore.prototype.put=original;
    return {ok,failed:l.localStorageFailed(),toast:document.querySelector('#notifications').textContent};
  });
  assert.equal(failure.ok,false);assert.equal(failure.failed,true);assert.match(failure.toast,/Exporte.*JSON/);
  const persisted=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const req=indexedDB.open('bete2',2);req.onsuccess=()=>{
      const db=req.result,tx=db.transaction('local'),get=tx.objectStore('local').get('bete2:doc');
      tx.oncomplete=()=>{resolve(get.result);db.close();};tx.onabort=()=>reject(tx.error);
    };
  }));
  assert.equal(persisted,savedBeforeFailure,'failed write must preserve the previous complete document');
  assert.deepEqual(errors,[]);
  await context.close();
  const failureContext=await browser.newContext(),fallback=await failureContext.newPage();
  await fallback.goto('http://127.0.0.1:8093/seed');
  await fallback.evaluate(node=>localStorage.setItem('bete2:doc',JSON.stringify({nodes:[node]})),node);
  await fallback.addInitScript(()=>{IDBFactory.prototype.open=()=>{throw new DOMException('Unavailable','InvalidStateError');};});
  await fallback.goto('http://127.0.0.1:8093/');await fallback.waitForFunction(()=>document.querySelector('#drive-status').textContent);
  assert.equal(await modules(fallback,s=>s.state.nodes[0].text),node.text);
  assert.ok(await fallback.evaluate(()=>localStorage.getItem('bete2:doc')),'failed migration must keep the legacy copy');
  assert.match(await fallback.locator('#notifications').textContent(),/Exporte.*JSON/);
  console.log('PASS: v1 image database upgrade, migration of all settings/history, token removal, no localStorage writes, >6 MB history reload, persistent error alert, previous document preserved after failed write, legacy retained after failed migration');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
});
