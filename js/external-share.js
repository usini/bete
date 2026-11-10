import { loadShareScript } from './group-share.js?v=mwag82om';
import { notify } from './notifications.js?v=mwag82om';
export const externalBoardShareUrl = board => 'https://bete.usini.eu/?' + new URLSearchParams({github:board.id});
export async function copyExternalBoardLink(board) {
  try { await navigator.clipboard.writeText(externalBoardShareUrl(board)); notify('Lien du tableau copié.'); }
  catch { notify('Copie impossible. Ouvre le QR code pour sélectionner le lien.',{type:'error'}); }
}
export async function showExternalBoardQR(board) {
  const dialog=document.createElement('dialog');dialog.className='external-share-dialog';
  const title=document.createElement('h2');title.textContent=board.name;
  const image=document.createElement('img');image.alt='QR code du tableau '+board.name;image.hidden=true;
  const input=document.createElement('input');input.type='text';input.readOnly=true;input.value=externalBoardShareUrl(board);input.setAttribute('aria-label','Lien de partage du tableau');
  input.addEventListener('focus',()=>input.select());
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Préparation du QR code…';
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copier le lien';copy.addEventListener('click',()=>copyExternalBoardLink(board));
  const close=document.createElement('button');close.type='button';close.textContent='Fermer';close.addEventListener('click',()=>dialog.close());
  dialog.append(title,image,input,status,copy,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  try{
    await loadShareScript('qrcode.min.js');if(!dialog.open)return;
    const qr=window.qrcode(0,'M');qr.addData(input.value);qr.make();image.src=qr.createDataURL(10,24);image.hidden=false;status.textContent='Scanne ce code pour ouvrir le tableau en lecture seule.';
  }catch{status.textContent='QR code indisponible. Le lien reste utilisable.';}
}
