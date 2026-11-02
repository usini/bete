const {createRequire}=require('node:module');
const {join,resolve,extname}=require('node:path');
const {readFileSync,existsSync}=require('node:fs');
const http=require('node:http'), assert=require('node:assert/strict');
const {chromium}=createRequire(join(process.env.BETE_QA_MODULES,'package.json'))('playwright');
const root=resolve(__dirname,'..'), requests=[];
let browser,server;
(async()=>{
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/favicon.ico'){
      requests.push({host:req.headers.host,path:req.url,cookie:req.headers.cookie,referer:req.headers.referer});
      res.writeHead(200,{'Content-Type':'image/png','Access-Control-Allow-Origin':'*'});
      return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xQAAAAASUVORK5CYII=','base64'));
    }
    const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root)||!existsSync(file)){res.writeHead(404);return res.end();}
    res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css'})[extname(file)]||'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise(r=>server.listen(8092,'0.0.0.0',r));
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext();
  await context.addCookies([{name:'private-session',value:'never-send',domain:'localhost',path:'/'}]);
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8092/');
  await page.waitForFunction(()=>document.querySelector('#drive-status').textContent);
  const link='http://localhost:8092/private/page?secret=never-fetch';
  await page.evaluate(async link=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);
    s.addNode('rect',0,0);
    const data=new DataTransfer();data.setData('text/plain',link);
    document.getElementById('canvas').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));
  },link);
  await page.waitForFunction(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);
    return !!s.state.nodes[0]?.link;
  });
  const result=await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),l=await import('/js/labels.js'+v);
    return {node:s.state.nodes[0],label:l.labelInfo(s.state.nodes[0])};
  });
  assert.equal(result.node.text,'');assert.equal(result.node.link,link);assert.equal(result.label.text,link);
  await page.waitForTimeout(250);
  assert.equal(requests.filter(r=>r.host==='localhost:8092').length,0,'ordinary links must not request favicons');
  await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),e=await import('/js/editor.js'+v);
    const n=s.addNode('rect',200,0);e.startEdit(n.id);
  });
  await page.fill('#editor',link);await page.click('#text-ok');
  const edited=await page.evaluate(async()=>{const v=new URL(document.querySelector('script[type=module]').src).search;return (await import('/js/state.js'+v)).state.nodes.at(-1);});
  assert.equal(edited.link,link);assert.equal(edited.text,'');
  const dropped=await page.evaluate(async link=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),c=await import('/js/camera.js'+v);
    const expected=c.screenToWorld(450,350),data=new DataTransfer();
    data.setData('text/uri-list','# Browser link\r\n'+link+'\r\n');data.setData('text/plain','Le titre de la page');
    document.getElementById('canvas').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,clientX:450,clientY:350,dataTransfer:data}));
    return {node:s.state.nodes.at(-1),expected,count:s.state.nodes.length};
  },link);
  assert.equal(dropped.count,3);assert.equal(dropped.node.link,link);assert.equal(dropped.node.text,'Le titre de la page');
  assert.equal(dropped.node.x+dropped.node.w/2,dropped.expected.x);
  assert.equal(dropped.node.y+dropped.node.h/2,dropped.expected.y);
  const htmlTitle=await page.evaluate(async link=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const l=await import('/js/links.js'+v);const data=new DataTransfer();
    data.setData('text/plain',link);data.setData('text/html','<a href="'+link+'"><strong>Titre fourni par le navigateur</strong><img src="/must-not-load"></a><script>throw new Error("must-not-run")</script>');
    return l.droppedTitle(data,link);
  },link);
  assert.equal(htmlTitle,'Titre fourni par le navigateur');
  assert.equal(await page.locator('#sel, #swatches, #del').count(),0);
  assert.equal(await page.locator('#drive-save').isVisible(),false);
  const target=await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),l=await import('/js/labels.js'+v),c=await import('/js/camera.js'+v);
    const n=s.state.nodes[0];s.select(n.id);const b=l.deleteIconBox(n,s.state.camera.zoom);
    return {id:n.id,...c.worldToScreen(b.x+b.w/2,b.y+b.h/2)};
  });
  await page.mouse.click(target.x,target.y);
  assert.equal(await page.evaluate(async id=>{const v=new URL(document.querySelector('script[type=module]').src).search;return !!(await import('/js/state.js'+v)).getNode(id);},target.id),false);
  let releaseAuth;
  await page.route('https://auth-bete.usini.eu/token',route=>new Promise(resolve=>{releaseAuth=async()=>{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'fake',expires_in:3600})});resolve();};}));
  await page.route('https://www.googleapis.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().method()==='GET'?{files:[]}:{id:'file-test',modifiedTime:'2026-11-02T12:00:00Z'})}));
  await page.evaluate(()=>localStorage.setItem('bete2:drive',JSON.stringify({linked:true,fileId:'',remoteModified:'',sig:'',lastSyncedAt:0})));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='connecting');
  await releaseAuth();
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='saved');
  assert.equal(await page.locator('#drive-connect').isVisible(),false);
  assert.equal(await page.locator('#drive-restore').textContent(),'Restaurer');
  await page.evaluate(async()=>{const v=new URL(document.querySelector('script[type=module]').src).search;const s=await import('/js/state.js'+v);s.state.nodes[0].text='Modifié';s.emit();});
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='pending');
  await page.click('#drive-save');
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='saved');
  await page.screenshot({path:join(process.env.TEMP,'bete-menu-clean.png')});
  await page.unroute('https://auth-bete.usini.eu/token');
  await page.route('https://auth-bete.usini.eu/token',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='error');
  assert.equal(await page.locator('#drive-save').evaluate(el=>getComputedStyle(el).animationName),'drive-error-blink');
  assert.equal(requests.filter(r=>r.host==='localhost:8092').length,0);
  assert.deepEqual(errors,[]);
  console.log('PASS: clean menu, block deletion, Drive hidden/red/yellow/green/blinking status, browser URL drop at pointer location, pasted URL and editor conversion, URL label, browser-provided title, no linked-site favicon requests');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
});
