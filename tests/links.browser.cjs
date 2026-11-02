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
    const s=await import('/js/state.js'+v),l=await import('/js/links.js'+v);
    const n=s.state.nodes[0];return !!n?.link&&!!l.faviconFor(n.link,()=>{});
  });
  const result=await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),l=await import('/js/labels.js'+v);
    return {node:s.state.nodes[0],label:l.labelInfo(s.state.nodes[0])};
  });
  assert.equal(result.node.text,'');assert.equal(result.node.link,link);assert.equal(result.label.text,link);
  assert.ok(requests.some(r=>r.host==='localhost:8092'));
  for(const req of requests.filter(r=>r.host==='localhost:8092')){assert.equal(req.path,'/favicon.ico');assert.equal(req.cookie,undefined);assert.equal(req.referer,undefined);}
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
  assert.equal(dropped.count,3);assert.equal(dropped.node.link,link);assert.equal(dropped.node.text,'');
  assert.equal(dropped.node.x+dropped.node.w/2,dropped.expected.x);
  assert.equal(dropped.node.y+dropped.node.h/2,dropped.expected.y);
  assert.deepEqual(errors,[]);
  console.log('PASS: browser URL drop at pointer location, pasted URL and editor conversion, URL label, direct favicon without cookies/referrer/page URL');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
});
