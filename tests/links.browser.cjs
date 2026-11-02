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
  const serviceRequests=[];
  const checkServiceRequest=request=>{if(new URL(request.url()).origin!=='http://127.0.0.1:8092')serviceRequests.push(request.url());};
  page.on('request',checkServiceRequest);
  const previous=await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);const previous=JSON.parse(JSON.stringify(s.state.nodes));
    const urls=['https://mail.google.com/mail/u/0/#inbox/private','https://www.youtube.com','https://www.facebook.com','https://x.com/home','https://www.google.com','https://drive.google.com/drive/u/0/my-drive','https://calendar.google.com/calendar/u/0/r','https://www.google.com/maps','https://docs.google.com/document/u/0/','https://docs.google.com/spreadsheets/u/0/','https://docs.google.com/presentation/u/0/','https://outlook.live.com/mail/0/inbox','https://www.instagram.com','https://www.linkedin.com/feed','https://web.whatsapp.com','https://discord.com/app','https://github.com','https://open.spotify.com','https://www.reddit.com','https://www.twitch.tv','https://web.telegram.org/k/'];
    s.replaceNodes([]);
    for(let i=0;i<urls.length;i++){const n=s.addNode('rect',(i%7-3)*170,(Math.floor(i/7)-1)*180);n.w=140;n.h=100;n.text='Texte remplacé visuellement';n.link=urls[i];}
    s.emit();return previous;
  });
  await page.waitForFunction(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),a=await import('/js/services.js'+v);
    return s.state.nodes.every(n=>a.serviceIcon(a.serviceForNode(n),()=>{})?.naturalWidth>0);
  });
  await page.screenshot({path:join(process.env.TEMP,'bete-service-icons.png')});
  assert.deepEqual(serviceRequests,[],'service icons must load locally without contacting the services');
  page.off('request',checkServiceRequest);
  await page.evaluate(async previous=>{const v=new URL(document.querySelector('script[type=module]').src).search;(await import('/js/state.js'+v)).replaceNodes(previous);},previous);
  assert.equal(await page.locator('#sel, #swatches, #del').count(),0);
  assert.equal(await page.locator('#drive-save').isVisible(),false);
  const target=await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),l=await import('/js/labels.js'+v),c=await import('/js/camera.js'+v);
    const n=s.state.nodes[0];s.select(n.id);const b=l.deleteIconBox(n,s.state.camera.zoom);
    return {id:n.id,...c.worldToScreen(b.x+b.w/2,b.y+b.h/2)};
  });
  let allowDelete=false,deleteDialogs=0;
  page.on('dialog',dialog=>{deleteDialogs++;return allowDelete?dialog.accept():dialog.dismiss();});
  await page.mouse.click(target.x,target.y);
  assert.equal(await page.evaluate(async id=>{const v=new URL(document.querySelector('script[type=module]').src).search;return !!(await import('/js/state.js'+v)).getNode(id);},target.id),true,'cancelled trash must preserve the block');
  await page.waitForTimeout(650);allowDelete=true;
  await page.mouse.click(target.x,target.y);
  assert.equal(await page.evaluate(async id=>{const v=new URL(document.querySelector('script[type=module]').src).search;return !!(await import('/js/state.js'+v)).getNode(id);},target.id),false);
  const dialogCount=deleteDialogs;
  for(const key of ['Delete','Backspace']) {
    const id=await page.evaluate(async()=>{
      const v=new URL(document.querySelector('script[type=module]').src).search;
      return (await import('/js/state.js'+v)).addNode('rect',0,0).id;
    });
    await page.keyboard.press(key);
    assert.equal(await page.evaluate(async id=>{
      const v=new URL(document.querySelector('script[type=module]').src).search;
      return !!(await import('/js/state.js'+v)).getNode(id);
    },id),false,'keyboard deletion must be immediate');
  }
  assert.equal(deleteDialogs,dialogCount,'only the trash icon must ask for confirmation');
  let releaseAuth;
  await page.route('https://auth-bete.usini.eu/token',route=>new Promise(resolve=>{releaseAuth=async()=>{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'fake',expires_in:3600})});resolve();};}));
  let holdUpload=false,releaseUpload,driveUploads=0;
  await page.route('https://www.googleapis.com/**',route=>{
    if(route.request().method()!=='GET')driveUploads++;
    const finish=()=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().method()==='GET'?{files:[]}:{id:'file-test',modifiedTime:'2026-11-02T12:00:00Z'})});
    if(holdUpload&&route.request().method()!=='GET')return new Promise(resolve=>{releaseUpload=async()=>{await finish();resolve();};});
    return finish();
  });
  await page.evaluate(()=>localStorage.setItem('bete2:drive',JSON.stringify({linked:true,fileId:'',remoteModified:'',sig:'',lastSyncedAt:0})));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='connecting');
  assert.match(await page.locator('#notifications').textContent(),/Connexion.*en cours/);
  await releaseAuth();
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='pending');
  assert.equal(driveUploads,0,'opening the app must not save automatically');
  assert.equal(await page.locator('#drive-connect').isVisible(),false);
  assert.equal(await page.locator('#drive-restore').textContent(),'Restaurer');
  await page.evaluate(async()=>{const v=new URL(document.querySelector('script[type=module]').src).search;const s=await import('/js/state.js'+v);s.state.nodes[0].text='Modifié';s.emit();});
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='pending');
  const warning=await page.evaluate(()=>{
    const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;
  });
  assert.equal(warning,true,'unsaved Drive changes must warn before leaving');
  assert.equal(driveUploads,0,'leaving must not start a Drive upload');
  holdUpload=true;
  await page.click('#drive-save');
  await page.waitForFunction(()=>document.querySelector('#notifications .toast')?.dataset.type==='progress');
  for(let i=0;i<50&&!releaseUpload;i++)await page.waitForTimeout(20);
  assert.ok(releaseUpload);
  assert.equal(await page.locator('#drive-save').getAttribute('data-working'),'true');
  assert.equal(await page.locator('#drive-save').evaluate(el=>getComputedStyle(el,'::after').animationName),'drive-spin');
  assert.match(await page.locator('#notifications').textContent(),/Sauvegarde.*en cours/);
  await releaseUpload();holdUpload=false;
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='saved');
  assert.equal(await page.evaluate(()=>{
    const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;
  }),false,'saved board must not warn before leaving');
  await page.waitForFunction(()=>document.querySelector('#notifications .toast')?.dataset.type==='success');
  assert.match(await page.locator('#notifications').textContent(),/Sauvegarde terminée/);
  assert.equal(await page.locator('#notifications .toast').count(),1);
  await page.screenshot({path:join(process.env.TEMP,'bete-menu-clean.png')});
  await page.unroute('https://auth-bete.usini.eu/token');
  await page.route('https://auth-bete.usini.eu/token',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#drive-save').dataset.state==='error');
  assert.equal(await page.locator('#drive-save').evaluate(el=>getComputedStyle(el).animationName),'drive-error-blink');
  assert.equal(await page.locator('#notifications .toast').getAttribute('data-type'),'error');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#mobile-lock').isVisible(),false,'narrow desktop windows stay editable');
  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobileContext.addInitScript(()=>localStorage.setItem('bete2:doc',JSON.stringify({camera:{x:0,y:0,zoom:1},nodes:[{id:'mobile-block-0001',kind:'rect',x:-90,y:-55,w:180,h:110,text:'Mobile',color:'#00b7eb'}]})));
  const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto('http://127.0.0.1:8092/');
  await mobile.waitForFunction(()=>document.querySelector('#drive-status').textContent);
  const mobileState=()=>mobile.evaluate(async()=>{const v=new URL(document.querySelector('script[type=module]').src).search;const s=await import('/js/state.js'+v),m=await import('/js/mobile-mode.js'+v);return {nodes:s.state.nodes,camera:s.state.camera,locked:m.isLocked()};});
  assert.equal((await mobileState()).locked,true);
  const initialMobile=(await mobileState()).nodes;
  await mobile.mouse.move(195,422);await mobile.mouse.down();await mobile.mouse.move(245,472,{steps:5});await mobile.mouse.up();
  assert.deepEqual((await mobileState()).nodes,initialMobile,'locked pan must not drag blocks');
  assert.notEqual((await mobileState()).camera.x,0);
  const cdp=await mobileContext.newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:380},{x:240,y:380}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:380},{x:280,y:380}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok((await mobileState()).camera.zoom>1,'pinch zoom remains available');
  await mobile.mouse.dblclick(100,100);
  assert.equal((await mobileState()).nodes.length,1,'locked double click must not create');
  await mobile.evaluate(async()=>{const v=new URL(document.querySelector('script[type=module]').src).search;const s=await import('/js/state.js'+v);s.select('mobile-block-0001');const d=new DataTransfer();d.setData('text/plain','https://example.org');document.getElementById('canvas').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));});
  await mobile.keyboard.press('Delete');
  assert.equal((await mobileState()).nodes.length,1);
  assert.equal((await mobileState()).nodes[0].link,undefined);
  await mobile.click('#panel-toggle');
  assert.equal(await mobile.locator('#mobile-lock-label').textContent(),'Déverrouiller');
  assert.equal(await mobile.locator('#import').isDisabled(),true);
  await mobile.locator('[data-block="rect"]').click();
  assert.equal((await mobileState()).nodes.length,1);
  await mobile.click('#mobile-lock');
  assert.equal((await mobileState()).locked,false);
  assert.equal(await mobile.locator('#mobile-lock-label').textContent(),'Verrouiller');
  await mobile.locator('[data-block="rect"]').click();
  assert.equal((await mobileState()).nodes.length,2);
  await mobile.click('#mobile-lock');
  assert.equal((await mobileState()).locked,true);
  await mobile.screenshot({path:join(process.env.TEMP,'bete-mobile-lock.png')});
  await mobile.click('#mobile-lock');
  await mobile.reload();
  assert.equal((await mobileState()).locked,true,'each mobile opening starts in read-only mode');
  await mobileContext.close();
  assert.equal(requests.filter(r=>r.host==='localhost:8092').length,0);
  await page.setViewportSize({width:1280,height:900});
  let facebookRequests = 0;
  await page.route('https://www.facebook.com/**', route => {
    facebookRequests++;
    return route.fulfill({contentType:'text/html',body:'<!doctype html><p>Publication Facebook de test</p>'});
  });
  await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);
    s.state.nodes=[];s.state.camera={x:0,y:0,zoom:1};
    const n=s.addNode('rect',0,0);n.w=500;n.h=400;
    n.link='https://www.facebook.com/example/posts/123?fbclid=secret';s.emit();
  });
  await page.waitForSelector('.facebook-post iframe');
  await page.waitForFunction(()=>document.querySelector('.facebook-post iframe').contentWindow!==null);
  const fb = page.locator('.facebook-post iframe');
  assert.equal(await fb.getAttribute('referrerpolicy'),'no-referrer');
  assert.equal(new URL(await fb.getAttribute('src')).searchParams.get('href'),'https://www.facebook.com/example/posts/123');
  await page.waitForTimeout(200);
  assert.equal(facebookRequests,1);
  await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);s.state.camera.zoom=0.5;s.emit();
  });
  await page.waitForFunction(()=>document.querySelector('.facebook-post').style.width==='242px');
  assert.equal(facebookRequests,1,'camera movement must not recreate the embed');
  const fbPoint = await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),c=await import('/js/camera.js'+v);
    const n=s.state.nodes[0];return {...c.worldToScreen(n.x+200,n.y+180),nodeX:n.x,nodeY:n.y};
  });
  assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y).id,fbPoint),'canvas');
  await page.mouse.move(fbPoint.x,fbPoint.y);await page.mouse.down();
  await page.mouse.move(fbPoint.x+60,fbPoint.y+40,{steps:6});await page.mouse.up();
  const movedPost = await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v),c=await import('/js/camera.js'+v),n=s.state.nodes[0];
    return {x:n.x,y:n.y,w:n.w,h:n.h,handle:c.worldToScreen(n.x+n.w,n.y+n.h)};
  });
  assert.equal(movedPost.x-fbPoint.nodeX,120,'post must drag from its body horizontally');
  assert.equal(movedPost.y-fbPoint.nodeY,80,'post must drag from its body vertically');
  await page.mouse.move(movedPost.handle.x,movedPost.handle.y);await page.mouse.down();
  await page.mouse.move(movedPost.handle.x+30,movedPost.handle.y+20,{steps:6});await page.mouse.up();
  assert.ok(await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const n=(await import('/js/state.js'+v)).state.nodes[0];return n.w>540 && n.h>420;
  }),'post resize handle must remain accessible');
  await page.click('.facebook-interact');
  assert.equal(await page.locator('.facebook-post').getAttribute('data-interactive'),'true');
  await page.click('.facebook-interact');
  assert.equal(await page.locator('.facebook-post').getAttribute('data-interactive'),'false');
  await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);s.state.nodes[0].link='https://www.facebook.com/reel/123456?fbclid=secret';s.emit();
  });
  await page.waitForFunction(()=>document.querySelector('.facebook-post iframe')?.src.includes('/plugins/video.php'));
  const reelFrame = page.locator('.facebook-post iframe');
  assert.equal(new URL(await reelFrame.getAttribute('src')).searchParams.get('href'),'https://www.facebook.com/reel/123456');
  assert.equal(new URL(await reelFrame.getAttribute('src')).searchParams.get('autoplay'),'false');
  await page.waitForTimeout(200);
  assert.equal(facebookRequests,2);
  await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);s.state.nodes[0].link='https://www.facebook.com/groups/123/posts/456';s.emit();
  });
  await page.waitForFunction(()=>!document.querySelector('.facebook-post'));
  assert.equal(facebookRequests,2,'group posts must not load Facebook');
  await page.evaluate(async()=>{
    const v=new URL(document.querySelector('script[type=module]').src).search;
    const s=await import('/js/state.js'+v);s.state.nodes=[];s.emit();
  });
  await page.waitForFunction(()=>!document.querySelector('.facebook-post'));
  assert.deepEqual(errors,[]);
  console.log('PASS: Facebook post automatic iframe, normalized URL, no referrer, zoom without reload, removal after deletion (Meta response mocked)');
  console.log('PASS: 21 local service icons without external requests, confirmed deletion, mobile default lock/unlock/relock, protected editing, pan/pinch, desktop unchanged, save animation and progress/success/error/connection notifications, clean menu, block deletion, Drive hidden/red/yellow/green/blinking status, browser URL drop at pointer location, pasted URL and editor conversion, URL label, browser-provided title, no linked-site favicon requests');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
});
