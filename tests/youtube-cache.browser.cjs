const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const csp=JSON.parse(fs.readFileSync(path.join(root,'android/src-tauri/tauri.conf.json'),'utf8')).app.security.csp;
 const server=http.createServer((q,r)=>{
  if(q.url==='/cache-test'){r.setHeader('Content-Type','text/html');r.end('<!doctype html><title>Test du cache</title>');return;}
  let file=path.join(root,q.url.split('?')[0]);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  r.setHeader('Content-Security-Policy',csp);r.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');fs.createReadStream(file).on('error',()=>r.end()).pipe(r);
 });
 await new Promise(r=>server.listen(8767,'127.0.0.1',r));let browser;
 try{
  browser=await require('puppeteer').launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let offline=false,thumbnailRequests=0,titleRequests=0;
  await page.setRequestInterception(true);page.on('request',r=>{
   if(r.url().startsWith('https://i.ytimg.com/')){thumbnailRequests++;if(offline)r.abort();else r.respond({status:200,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:fs.readFileSync(path.join(root,'img/logo.png'))});}
   else if(r.url().startsWith('https://www.youtube.com/oembed')){titleRequests++;if(offline)r.abort();else r.respond({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({title:'Titre gardé hors connexion',width:480,height:360})});}
   else r.continue();
  });
  await page.goto('http://127.0.0.1:8767/cache-test');
  await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('bete2',2);request.onupgradeneeded=()=>{request.result.createObjectStore('local');request.result.createObjectStore('images');};request.onsuccess=()=>{const db=request.result,tx=db.transaction('images','readwrite');tx.objectStore('images').put(new Blob(['sentinel']),'existing');tx.oncomplete=()=>{db.close();resolve()};};request.onerror=()=>reject(request.error)}));
  const prepare=async()=>{
   await page.goto('http://127.0.0.1:8767/');
   await page.evaluate(async()=>{
    const version=document.querySelector('script[type=module]').src.split('?')[1];
    const yt=await import('./js/yt.js?'+version),thumb=await import('./js/youtube-thumbnails.js?'+version);
    window.cacheReady=()=>!!thumb.youTubeThumbnail('dQw4w9WgXcQ')&&yt.youTubeTitle('dQw4w9WgXcQ')==='Titre gardé hors connexion'&&Math.abs(yt.youTubeRatio('https://youtu.be/dQw4w9WgXcQ')-4/3)<1e-9;
   });
   await page.waitForFunction(()=>window.cacheReady());
  };
  await prepare();
  await page.evaluate(async()=>{const version=document.querySelector('script[type=module]').src.split('?')[1];await(await import('./js/local-store.js?'+version)).flushLocalWrites()});
  assert.equal(thumbnailRequests,1);assert.equal(titleRequests,1);offline=true;thumbnailRequests=0;titleRequests=0;
  await prepare();assert.equal(thumbnailRequests,0);assert.equal(titleRequests,0);
  const restored=await page.evaluate(async()=>{const version=document.querySelector('script[type=module]').src.split('?')[1];const db=await(await import('./js/database.js?'+version)).openDatabase();return new Promise(resolve=>{const tx=db.transaction('images'),r=tx.objectStore('images').get('existing');r.onsuccess=()=>resolve(!!r.result)})});
  assert.equal(restored,true);assert.deepEqual(errors,[]);console.log('Titre et miniature YouTube disponibles après rechargement sans réseau ; migration IndexedDB sans perte des images existantes.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
