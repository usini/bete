import { state, events, addNode, getNode, emit } from './state.js?v=mw3mnbdx';
import { externalMode } from './external-board.js?v=mw3mnbdx';
import { isLocked } from './mobile-mode.js?v=mw3mnbdx';
import { notify } from './notifications.js?v=mw3mnbdx';
import { cleanApplication, newSteamApplication } from './application-model.js?v=mw3mnbdx';
export const applicationEvents=new EventTarget();
let lastSnapshot=null;
let native=null,queue=Promise.resolve(),status={enabled:false,approved:{}};
let opening=false,lastOpened=0,lastBlock='';
const repaint=()=>applicationEvents.dispatchEvent(new Event('change'));
export const applicationAllowed=node=>!!native&&status.enabled&&status.approved[node.id]===node.application?.reference;
export const flushApplicationWrites=()=>queue;
const enqueue=operation=>{queue=queue.catch(()=>{}).then(operation);return queue;};
const snapshot=()=>state.nodes.filter(n=>n.kind==='rect'&&n.application).map(n=>({id:n.id,application:cleanApplication(n.application)})).filter(n=>n.application);
function sync(){
  if(!native)return Promise.resolve();
  const blocks=snapshot();
  const signature=JSON.stringify(blocks);
  if(signature===lastSnapshot)return queue;
  lastSnapshot=signature;
  return enqueue(async()=>{try{status=await native.core.invoke('sync_application_blocks',{blocks});repaint();}catch(error){lastSnapshot=null;throw error;}});
}
export function addApplicationBlock(application,x,y){
  const clean=cleanApplication(application);if(!clean)return null;
  const n=addNode('rect',x,y);n.application=clean;n.text=clean.label;emit();return n;
}
export function addSteamBlock(value,x,y){const app=newSteamApplication(value);return app?addApplicationBlock(app,x,y):null;}
export function dropApplicationFile(file,x,y){
  if(!/\.(?:exe|lnk|url)$/i.test(file.name))return false;
  if(!window.__TAURI__){
    const reference=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    addApplicationBlock({reference,label:file.name.replace(/\.(?:exe|lnk|url)$/i,'')},x,y);
    return true;
  }
  if(!window.chrome?.webview?.postMessageWithAdditionalObjects){notify('Ce WebView2 ne permet pas le dépôt d’applications. Mets à jour WebView2.',{type:'error'});return true;}
  window.chrome.webview.postMessageWithAdditionalObjects({type:'bete-application-drop',x,y},[file]);return true;
}
export async function openApplication(node){
  if(!node?.application)return false;
  if(!native||externalMode){notify('L’ouverture d’applications est disponible uniquement dans Bête Windows, après autorisation locale.');return false;}
  if(opening||(lastBlock===node.id&&performance.now()-lastOpened<650))return false;
  opening=true;lastBlock=node.id;lastOpened=performance.now();
  try{
    await sync();
    if(getNode(node.id)!==node)return false;
    const opened=await native.core.invoke('launch_application',{blockId:node.id,reference:node.application.reference});
    status=await native.core.invoke('application_launch_status');repaint();return opened;
  }catch(error){notify(String(error),{type:'error',duration:0});return false;}
  finally{opening=false;lastOpened=performance.now();}
}
export async function initApplications(desktop){
  native=desktop;
  const section=document.getElementById('desktop-applications'),button=document.getElementById('application-launch-toggle'),label=document.getElementById('application-launch-status');
  const update=()=>{button.textContent=status.enabled?'Désactiver l’ouverture d’applications':'Activer l’ouverture d’applications';label.textContent=status.enabled?'Chaque nouveau bloc nécessite aussi une autorisation individuelle.':'Ouverture désactivée sur cet ordinateur.';};
  applicationEvents.addEventListener('change',update);
  await desktop.event.listen('bete-application-dropped',event=>{
    if(isLocked()||externalMode)return;
    const {application,x,y}=event.payload;
    if(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=1e6&&Math.abs(y)<=1e6)addApplicationBlock(application,x,y);
  });
  await desktop.event.listen('bete-application-error',event=>notify(String(event.payload),{type:'error',duration:0}));
  events.addEventListener('change',()=>{sync().catch(error=>notify('Autorisations locales : '+String(error),{type:'error'}));});
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{await queue.catch(()=>{});status=await desktop.core.invoke('set_application_launch_enabled',{enabled:!status.enabled});repaint();}
    catch(error){notify(String(error),{type:'error'});}
    finally{button.disabled=false;}
  });
  section.hidden=false;await sync();update();
}
