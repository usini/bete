import { openDatabase } from './database.js?v=mwag82om';
const MAX_ENTRIES = 200, RETRY_MS = 60000;
const images = new Map();
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
async function read(id) {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('media','readonly'), request=tx.objectStore('media').get('yt:'+id);
    request.onsuccess=()=>resolve(request.result?.blob || null);request.onerror=()=>reject(request.error);
  });
}
async function save(id,blob) {
  const db=await openDatabase();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('media','readwrite'),store=tx.objectStore('media');
    store.put({blob,savedAt:Date.now()},'yt:'+id);
    const count=store.count();
    count.onsuccess=()=>{
      let extra=count.result-MAX_ENTRIES;
      if(extra<=0)return;
      const cursor=store.index('savedAt').openCursor();
      cursor.onsuccess=()=>{const item=cursor.result;if(item&&extra-->0){item.delete();item.continue();}};
    };
    tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);
  });
}
export function youTubeThumbnail(id,onReady=()=>{}) {
  if(!validId(id))return null;
  let entry=images.get(id);
  if(entry?.image)return entry.image;
  if(entry?.pending || (entry?.failedAt && Date.now()-entry.failedAt<RETRY_MS))return null;
  entry={pending:true,image:null};images.set(id,entry);
  (async()=>{
    let blob;
    try{blob=await read(id);}catch{/* Caching is optional. */}
    if(!blob){
      const response=await fetch('https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('Miniature indisponible');
      blob=await response.blob();
      if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||blob.size>1024*1024)throw new Error('Miniature invalide');
      try{await save(id,blob);}catch{/* The image can still be shown this session. */}
    }
    const url=URL.createObjectURL(blob),image=new Image();
    try{image.src=url;await image.decode();entry.image=image;}finally{URL.revokeObjectURL(url);}
  })().catch(()=>{
    // A provider that refuses CORS may still allow displaying its image online.
    const image=new Image();image.referrerPolicy='no-referrer';image.onload=()=>{entry.image=image;onReady();};
    image.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';entry.failedAt=Date.now();
  }).finally(()=>{entry.pending=false;onReady();});
  return null;
}
