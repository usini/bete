// Run with BETE_QA_MODULES pointing to an external npm prefix containing peer and playwright.
// No npm dependency or build step is added to the static application.
const { createRequire } = require('node:module');
const { join, extname, resolve } = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const dependency = createRequire(join(process.env.BETE_QA_MODULES, 'package.json'));
const { chromium } = dependency('playwright');
const { PeerServer } = dependency('peer');
const root = resolve(__dirname, '..');
const group = { id: 'group-test-0001', kind: 'group', x: 100, y: 100, w: 500, h: 400, text: 'Équipe', color: '#00b7eb' };
const block = { id: 'block-test-0001', kind: 'rect', x: 160, y: 240, w: 150, h: 100, text: 'À partager', color: '#39ff14' };
const adjacent = { id: 'private-edge-0001', kind: 'rect', x: 800, y: 200, w: 100, h: 100, text: 'À garder privé', color: '#ff8c00' };
const hidden = { id: 'private-test-0001', kind: 'rect', x: -500, y: -300, w: 100, h: 100, text: 'PRIVÉ', color: '#ff8c00' };
let peerHttp, browser, web;
const errors = [];

async function moduleOn(page, fn, arg) {
  return page.evaluate(async ({ fn, arg }) => {
    const version = new URL(document.querySelector('script[type=module]').src).search;
    const modules = {};
    for (const name of ['state', 'group-share', 'labels', 'camera', 'images']) modules[name] = await import('/js/' + name + '.js' + version);
    return new Function('m', 'arg', 'return (' + fn + ')(m,arg)')(modules, arg);
  }, { fn: fn.toString(), arg });
}
async function setup(context, nodes) {
  await context.addInitScript(nodes => { if (!localStorage.getItem('bete2:doc')) localStorage.setItem('bete2:doc', JSON.stringify({ nodes, camera: {x:300,y:250,zoom:1} })); }, nodes);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8091/');
  await page.waitForFunction(() => !!document.querySelector('#drive-status').textContent);
  await moduleOn(page, m => { Object.assign(m['group-share'].peerConfig, { host: '127.0.0.1', port: 9091, secure: false, config: { iceServers: [] } }); });
  return page;
}
async function waitText(page, id, text) {
  for (let i = 0; i < 120; i++) {
    if (await moduleOn(page, (m, a) => m.state.state.nodes.some(n=>n.text===a.text && (n.id===a.id || n.id!=='private-test-0001')), {id,text})) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Missing text ' + text + ': ' + await page.locator('#share-status').textContent());
}

(async () => {
  web = http.createServer((req,res) => {
    const file = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url,'http://localhost').pathname));
    if (!file.startsWith(root) || !existsSync(file)) {res.writeHead(404); return res.end();}
    res.setHeader('Content-Type', ({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(r => web.listen(8091,'127.0.0.1',r));
  PeerServer({ host:'127.0.0.1', port:9091, path:'/', key:'bete', allow_discovery:false }, s => {peerHttp=s;});
  assert.equal((await fetch('http://127.0.0.1:9091/')).status,200);
  assert.equal((await fetch('http://127.0.0.1:9091/bete/peers')).status,401);
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true });
  const hostContext = await browser.newContext({viewport:{width:1280,height:900}});
  const guestContext = await browser.newContext({viewport:{width:1280,height:900}});
  // Keep the old sender chunk size in this host to exercise real PeerJS fragmentation.
  await hostContext.route('**/js/group-share.js*',route=>route.fulfill({contentType:'text/javascript',
    body:readFileSync(join(root,'js','group-share.js'),'utf8').replace('CHUNK = 12288','CHUNK = 32768')}));
  const host = await setup(hostContext, [group,block,hidden,adjacent]);
  const guestPrivate = { ...hidden, id:'block-test-0001', x:0,y:0,w:900,h:900 };
  const guest = await setup(guestContext,[guestPrivate]);
  // Use the actual QR action button, including pointer capture and the modal's controls.
  const icon = await moduleOn(host, m => {
    m.state.select('group-test-0001');
    const box=m.labels.shareIconBox(m.state.getNode('group-test-0001'),m.state.state.camera.zoom);
    return m.camera.worldToScreen(box.x+box.w/2,box.y+box.h/2);
  });
  await host.mouse.click(icon.x,icon.y);
  host.on('dialog', dialog=>dialog.accept());
  await host.locator('#sharedialog').waitFor({state:'visible'});
  await host.click('#share-activate');
  await host.waitForFunction(() => document.querySelector('#share-status').textContent.includes('attente'));
  await host.screenshot({path:join(root,'tests','share-dialog.png')});
  assert.match(await host.locator('#clock-sharing').textContent(),/1 participant/);
  const link = await host.locator('#share-link').inputValue();
  assert.ok(link.includes('#group='));
  await guest.evaluate(link => { location.hash = new URL(link).hash; },link);
  await guest.click('#share-join');
  await waitText(guest,block.id,block.text);
  await guest.waitForFunction(()=>document.querySelector('#clock-sharing').textContent.includes('2 participants'));
  assert.match(await host.locator('#clock-sharing').textContent(),/2 participants/);
  let received = await moduleOn(guest,m=>m.state.state.nodes);
  assert.equal(received.some(n=>n.text==='PRIVÉ' && n.id===hidden.id),false);
  assert.deepEqual(received.find(n=>n.id===guestPrivate.id),guestPrivate);
  const incoming = received.find(n=>n.shareId===group.id);
  assert.ok(incoming.x>=guestPrivate.x+guestPrivate.w || incoming.y>=guestPrivate.y+guestPrivate.h);
  await host.click('#share-close'); await guest.click('#share-close');
  await guest.waitForTimeout(600);
  assert.equal(await moduleOn(host,m=>m['group-share'].isGroupShared(m.state.getNode('group-test-0001'))),true);
  const glowState=await moduleOn(host,m=>JSON.stringify(m.state.state.nodes));
  const glowBefore=await host.locator('#canvas').evaluate(canvas=>canvas.toDataURL());
  await host.waitForTimeout(250);
  assert.notEqual(await host.locator('#canvas').evaluate(canvas=>canvas.toDataURL()),glowBefore,'shared border must animate');
  assert.equal(await moduleOn(host,m=>JSON.stringify(m.state.state.nodes)),glowState,'glow must not change board data');
  await host.screenshot({path:join(root,'tests','share-glow.png')});
  await host.emulateMedia({reducedMotion:'reduce'});
  await host.waitForTimeout(100);
  const staticGlow=await host.locator('#canvas').evaluate(canvas=>canvas.toDataURL());
  await host.waitForTimeout(250);
  assert.equal(await host.locator('#canvas').evaluate(canvas=>canvas.toDataURL()),staticGlow,'reduced motion keeps the glow static');
  await host.emulateMedia({reducedMotion:'no-preference'});
  const beforePresence=await moduleOn(host,m=>JSON.stringify(m.state.state.nodes));
  const cursorPoint=await moduleOn(guest,m=>{const g=m.state.state.nodes.find(n=>n.shareId==='group-test-0001');return m.camera.worldToScreen(g.x+100,g.y+150);});
  await guest.mouse.move(cursorPoint.x,cursorPoint.y);
  let cursors=[];
  for(let i=0;i<50;i++){cursors=await moduleOn(host,m=>m['group-share'].remoteCursors());if(cursors.length)break;await host.waitForTimeout(100);}
  assert.equal(cursors.length,1,'shared cursor should arrive');
  assert.ok(Math.abs(cursors[0].x-(group.x+100))<2 && Math.abs(cursors[0].y-(group.y+150))<2,'cursor coordinates must be relative to the shared group');
  assert.equal(await moduleOn(host,m=>JSON.stringify(m.state.state.nodes)),beforePresence,'presence must not change saved content');
  await guest.mouse.move(0,0);
  for(let i=0;i<50;i++){if(!(await moduleOn(host,m=>m['group-share'].remoteCursors())).length)break;await host.waitForTimeout(100);}
  assert.equal((await moduleOn(host,m=>m['group-share'].remoteCursors())).length,0,'private-area cursor must disappear');
  await host.evaluate(()=>document.dispatchEvent(new CustomEvent('bete-share-group',{detail:'group-test-0001'})));
  await moduleOn(guest,m=>{m.state.state.nodes.find(n=>n.text==='À partager').text='Depuis invité';m.state.emit();});
  await waitText(host,block.id,'Depuis invité');
  await moduleOn(host,m=>{m.state.getNode('block-test-0001').text='Depuis source';m.state.emit();});
  await waitText(guest,block.id,'Depuis source');
  await moduleOn(guest,m=>{m.state.state.nodes.find(n=>n.shareId==='group-test-0001').w=1000;m.state.emit();});
  await host.waitForTimeout(1200);
  assert.equal(await moduleOn(guest,m=>m.state.state.nodes.some(n=>n.text==='À garder privé')),false,'remote expansion must not leak adjacent private blocks');
  // Moving the enlarged group must not carry or publish the adjacent private block.
  const adjacentBefore=await moduleOn(host,m=>({...m.state.getNode('private-edge-0001')}));
  await moduleOn(host,m=>{const g=m.state.getNode('group-test-0001');for(const n of [g,...m.state.membersOf(g)]){n.x+=30;n.y+=30;}document.dispatchEvent(new CustomEvent('bete-node-moved',{detail:g.id}));m.state.emit();});
  await host.waitForTimeout(700);
  assert.deepEqual(await moduleOn(host,m=>({...m.state.getNode('private-edge-0001')})),adjacentBefore);
  assert.equal(await moduleOn(guest,m=>m.state.state.nodes.some(n=>n.text==='À garder privé')),false);
  await moduleOn(host,m=>{const g=m.state.getNode('group-test-0001');for(const n of [g,...m.state.membersOf(g)]){n.x-=30;n.y-=30;}m.state.emit();});
  const hostCamera = await moduleOn(host,m=>({...m.state.state.camera}));
  await moduleOn(guest,m=>{const g=m.state.state.nodes.find(n=>n.shareId==='group-test-0001');const dx=300,dy=200;for(const n of [g,...m.state.membersOf(g)]){n.x+=dx;n.y+=dy;}m.state.emit();});
  await guest.waitForTimeout(800);
  assert.equal(await moduleOn(host,m=>m.state.getNode('group-test-0001').x),group.x);
  assert.deepEqual(await moduleOn(host,m=>({...m.state.state.camera})),hostCamera);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xQAAAAASUVORK5CYII=';
  await moduleOn(host,async(m,image)=>{
    const blob=await(await fetch(image)).blob();
    const n=m.state.getNode('block-test-0001');
    n.image=await m.images.addImageFile(new Blob([blob,new Uint8Array(2*1024*1024)],{type:'image/png'}));
    n.link='https://www.amazon.fr/dp/B07HG51ZYK';n.name='Manette';m.state.emit();
  },image);
  let imageReceived=false;
  for(let i=0;i<120;i++) {
    imageReceived=await moduleOn(guest,async m=>{
      const n=m.state.state.nodes.find(n=>n.text==='Depuis source');
      const blob=await m.images.imageBlob(n?.image);
      return !!blob && blob.size>2*1024*1024 && !!m.images.imageFor(n.image,()=>{})?.naturalWidth;
    });
    if(imageReceived)break;
    await guest.waitForTimeout(100);
  }
  assert.ok(imageReceived,'shared image bytes must arrive');
  assert.equal(await moduleOn(guest,m=>m['group-share'].shareInfo(m.state.state.nodes.find(n=>n.shareId==='group-test-0001')).peers),1,'image transfer must not disconnect the client');
  await guest.evaluate(link=>{location.hash=new URL(link).hash;},link);
  await guest.click('#share-join');
  await guest.waitForTimeout(700);
  assert.equal((await moduleOn(guest,m=>m.state.state.nodes.filter(n=>n.shareId==='group-test-0001'))).length,1);
  // Removing a shared block deletes only its counterpart, never a colliding private id.
  await moduleOn(host,m=>{const root=m.state.getNode('group-test-0001');const n=m.state.addNode('rect',root.x+300,root.y+250);n.text='Éphémère';m.state.emit();});
  await waitText(guest,'unused-0001','Éphémère');
  await moduleOn(guest,m=>m.state.removeNode(m.state.state.nodes.find(n=>n.text==='Éphémère').id));
  for(let i=0;i<80;i++){if(!await moduleOn(host,m=>m.state.state.nodes.some(n=>n.text==='Éphémère')))break;await host.waitForTimeout(100);}
  assert.equal(await moduleOn(host,m=>m.state.state.nodes.some(n=>n.text==='Éphémère')),false);
  await host.locator('#share-regenerate').click({noWaitAfter:true});
  await host.waitForTimeout(500);
  const newLink=await host.locator('#share-link').inputValue();
  assert.notEqual(newLink,link);
  await guest.evaluate(link=>{location.hash=new URL(link).hash;},newLink);
  await guest.click('#share-join');
  await waitText(guest,block.id,'Depuis source');
  await guest.waitForTimeout(700);
  assert.equal((await moduleOn(guest,m=>m.state.state.nodes.filter(n=>n.shareId==='group-test-0001'))).length,1);
  assert.equal((await moduleOn(guest,m=>m.state.state.nodes.filter(n=>n.text==='Depuis source'))).length,1,'regenerating the link must preserve remapped aliases');
  const thirdContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const third=await setup(thirdContext,[]);
  await third.evaluate(link=>{location.hash=new URL(link).hash;},newLink);
  await third.click('#share-join');
  await waitText(third,block.id,'Depuis source');
  await third.waitForFunction(()=>document.querySelector('#clock-sharing').textContent.includes('3 participants'));
  assert.match(await guest.locator('#clock-sharing').textContent(),/3 participants/);
  await third.screenshot({path:join(root,'tests','share-mobile.png')});
  await moduleOn(guest,m=>{m.state.state.nodes.find(n=>n.text==='Depuis source').text='Trois participants';m.state.emit();});
  await waitText(host,block.id,'Trois participants');
  await waitText(third,block.id,'Trois participants');
  await moduleOn(host,m=>{m.state.getNode('block-test-0001').text='Depuis source';m.state.emit();});
  await waitText(guest,block.id,'Depuis source');
  await thirdContext.close();
  const badContext=await browser.newContext();
  const bad=await setup(badContext,[]);
  const badLink=new URL(newLink);const badParams=new URLSearchParams(badLink.hash.slice(1));badParams.set('access','0'.repeat(64));badLink.hash=badParams.toString();
  await bad.evaluate(link=>{location.hash=new URL(link).hash;},badLink.href);
  await bad.click('#share-join');
  await bad.waitForFunction(()=>document.querySelector('#share-status').textContent.includes('invalide'));
  assert.equal(await moduleOn(bad,m=>m.state.state.nodes.length),0,'wrong capability must never receive shared nodes');
  await badContext.close();
  // Source disappears: edit the guest copy offline, then let the source reload its saved registers.
  await host.waitForTimeout(600);
  await host.close();
  await guest.waitForTimeout(700);
  await moduleOn(guest,m=>{m.state.state.nodes.find(n=>n.text==='Depuis source').text='Modifié hors ligne';m.state.emit();});
  await guest.waitForTimeout(500);
  const hostAgain = await hostContext.newPage();
  hostAgain.on('pageerror',e=>errors.push(e.message));
  await hostAgain.goto('http://127.0.0.1:8091/');
  await moduleOn(hostAgain,m=>{Object.assign(m['group-share'].peerConfig,{host:'127.0.0.1',port:9091,secure:false,config:{iceServers:[]}});});
  // Restored auto-start may have attempted the production endpoint before the test override.
  await moduleOn(hostAgain,async m=>{const g=m.state.getNode('group-test-0001');m['group-share'].disableShare(g);await m['group-share'].enableShare(g);});
  for(let i=0;i<600;i++){
    if(await moduleOn(hostAgain,m=>m.state.state.nodes.some(n=>n.text==='Modifié hors ligne')))break;
    await guest.waitForTimeout(100);
  }
  assert.equal(await moduleOn(hostAgain,m=>m.state.state.nodes.some(n=>n.text==='Modifié hors ligne')),true,'offline guest edits must reach the restored source');
  assert.deepEqual(await moduleOn(guest,m=>m.state.getNode('block-test-0001')),guestPrivate);
  await guest.locator('#share-close').click();
  await hostAgain.screenshot({path:join(root,'tests','share-host.png')});
  await guest.screenshot({path:join(root,'tests','share-guest.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: scoped live cursors, non-persistent presence, QR action, handshake, private-board isolation, empty placement, bidirectional edits, local positions, images, id collisions, deletions, renewed link, offline reconnection, clean console');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(web)await new Promise(r=>web.close(r));
  if(peerHttp)await new Promise(r=>peerHttp.close(r));
  process.exit(process.exitCode || 0);
});
