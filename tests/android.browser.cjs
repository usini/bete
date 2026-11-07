// Run after node android/stage.mjs. Uses an isolated browser and fake native Google responses.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '../android/dist');
  const csp = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../android/src-tauri/tauri.conf.json'),'utf8')).app.security.csp;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy',csp);
    let file = path.join(root, req.url.split('?')[0]);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
    fs.createReadStream(file).on('error', () => {res.statusCode=404;res.end();}).pipe(res);
  });
  await new Promise(resolve => server.listen(8766, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await require('puppeteer').launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
    const page = await browser.newPage();
    await page.setViewport({width:393,height:850,isMobile:true,hasTouch:true});
    await page.evaluateOnNewDocument(() => {
      window.nativeCalls = [];
      window.__TAURI__ = {core:{invoke:async command => {
        window.nativeCalls.push(command);
        if(command.startsWith('drive_')) return {access_token:'test-token',expires_in:3300};
        return {enabled:false,approved:{}};
      }}};
    });
    const errors = [], authRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if(request.url().startsWith('https://www.googleapis.com/')) request.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({files:[]})});
      else if(request.url().includes('auth-bete.')) {authRequests.push(request.url());request.abort();}
      else request.continue();
    });
    await page.goto('http://127.0.0.1:8766');
    await page.waitForSelector('#clock-calendar');
    const initial = await page.evaluate(() => ({locked:document.body.classList.contains('mobile-locked'),windows:!!window.__TAURI__,searchNearMap:document.querySelector('#open-command-search').parentElement.id==='map-controls'}));
    assert.deepEqual(initial,{locked:true,windows:false,searchNearMap:true});
    await page.click('#open-command-search');
    assert.equal(await page.$eval('#command-search', dialog=>dialog.open),true);
    await page.evaluate(()=>document.querySelector('#command-search').close());
    await page.evaluate(()=>document.querySelector('#drive-connect').click());
    await page.waitForFunction(()=>window.nativeCalls.includes('drive_login')&&!document.querySelector('#drive-disconnect').hidden);
    const drive = await page.evaluate(()=>({sectionVisible:!document.querySelector('#drive-status').closest('section').hidden,storedToken:localStorage.getItem('bete2:driveToken')}));
    assert.deepEqual(drive,{sectionVisible:true,storedToken:null});
    const created = await page.evaluate(async () => {
      const version=document.querySelector('script[type=module]').src.split('?')[1];
      const model=await import('./js/state.js?'+version);
      model.setDoc({camera:{x:0,y:0,zoom:.01},nodes:[{id:'group',kind:'group',x:-200,y:-150,w:400,h:300,text:'Groupe'}]});
      const node=model.addNode('rect',0,0);
      return {id:node.id,w:node.w,h:node.h};
    });
    assert.ok(created.w*.01>=40&&created.w*.01<393*.65);
    await new Promise(resolve=>setTimeout(resolve,600));
    const placement=await page.evaluate(async id=>{
      const version=document.querySelector('script[type=module]').src.split('?')[1];
      const model=await import('./js/state.js?'+version),n=model.getNode(id),g=model.getNode('group');
      return {free:n.x+n.w<=g.x||n.x>=g.x+g.w||n.y+n.h<=g.y||n.y>=g.y+g.h,
        followed:Math.abs(model.state.camera.x-(n.x+n.w/2))<1&&Math.abs(model.state.camera.y-(n.y+n.h/2))<1,
        groupUnchanged:g.x===-200&&g.y===-150&&g.w===400&&g.h===300};
    },created.id);
    assert.deepEqual(placement,{free:true,followed:true,groupUnchanged:true});
    await page.evaluate(async id => {
      window.renderedTestFont = 0;
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text,...args) {
        if(text==='Test') { const t=this.getTransform();window.renderedTestFont=parseFloat(this.font)*Math.hypot(t.a,t.b); }
        return original.call(this,text,...args);
      };
      const version=document.querySelector('script[type=module]').src.split('?')[1];
      const model=await import('./js/state.js?'+version);
      model.getNode(id).text='Test';model.emit();
    },created.id);
    await page.waitForFunction(()=>window.renderedTestFont>20);
    const renderedSizes=[];
    for(const zoom of [1,.01,8]) {
      await page.evaluate(async zoom => {
        const version=document.querySelector('script[type=module]').src.split('?')[1];
        const model=await import('./js/state.js?'+version);
        window.renderedTestFont=0;
        model.setDoc({camera:{x:0,y:0,zoom},nodes:[{id:'scaled-text',kind:'rect',x:-80/zoom,y:-80/zoom,w:160/zoom,h:160/zoom,text:'Test'}]});
      },zoom);
      await page.waitForFunction(()=>window.renderedTestFont>0);
      renderedSizes.push(await page.evaluate(()=>window.renderedTestFont));
    }
    assert.ok(Math.max(...renderedSizes)-Math.min(...renderedSizes)<1,'text keeps the same screen size for equivalent blocks at different zooms');


    const imageRestored = await page.evaluate(async () => {
      const version = document.querySelector('script[type=module]').src.split('?')[1];
      const {importData} = await import('./js/storage.js?'+version);
      const {state} = await import('./js/state.js?'+version);
      await importData({nodes:[{id:'image-test',kind:'image',x:0,y:0,w:100,h:100,image:Object.assign(document.createElement('canvas'),{width:2,height:2}).toDataURL('image/png')}]});
      return state.nodes[0].image.startsWith('idb:');
    });
    assert.equal(imageRestored,true);
    assert.deepEqual(errors,[]);assert.deepEqual(authRequests,[]);
    console.log('Android : mode lecture, loupe près de la minimap et connexion Drive native et restauration d’image sous CSP vérifiées, sans jeton persistant ni OAuth web.');
  } finally {if(browser) await browser.close();server.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
