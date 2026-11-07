import { state, membersOf, sanitizeNode, newId, select } from './state.js?v=mw62ezdd';
import { exportData } from './storage.js?v=mw62ezdd';
import { addDataUrl } from './images.js?v=mw62ezdd';
export const GROUP_PREFIX='BETE_GROUP_V1\n';
export async function exportGroup(group, title=group.text, includeFrame=true) {
  const contents=membersOf(group);
  const nodes=(includeFrame?[group,...contents]:contents).map(node=>{
    const {shareId,...copy}=node;
    return {...copy,x:node.x-group.x,y:node.y-group.y};
  });
  if(includeFrame) nodes[0].text=title;
  return exportData({app:'bete2',nodes,camera:{x:group.w/2,y:group.h/2,zoom:1}});
}
export async function pasteGroup(text,center) {
  if(typeof text!=='string'||text.length>50*1024*1024)throw new Error('Groupe trop volumineux.');
  const data=JSON.parse(text.replace(/^BETE_GROUP_V1\r?\n/,''));
  if(!Array.isArray(data.nodes)||!data.nodes.length||data.nodes.length>5000||data.nodes[0]?.kind!=='group')throw new Error('Groupe invalide.');
  const nodes=data.nodes.map(raw=>sanitizeNode(raw));
  if(nodes.some(n=>!n))throw new Error('Bloc invalide.');
  const images=new Map();
  for(let i=0;i<nodes.length;i++){
    const raw=data.nodes[i],node=nodes[i];
    if(typeof raw.image==='string'&&raw.image.startsWith('asset:')){
      const asset=data.assets?.[raw.image.slice(6)];
      if(typeof asset!=='string'||asset.length>20e6||!/^data:image\/(?:png|jpeg|webp|gif|avif|bmp);base64,/i.test(asset))throw new Error('Image absente ou invalide.');
      if(!images.has(raw.image))images.set(raw.image,await addDataUrl(asset));
      node.image=images.get(raw.image);
    }else if(raw.image)throw new Error('Image non intégrée au groupe.');
    node.id=newId();delete node.shareId;
  }
  const root=nodes[0],dx=center.x-root.x-root.w/2,dy=center.y-root.y-root.h/2;
  for(const n of nodes){n.x+=dx;n.y+=dy;}
  state.nodes.push(...nodes);select(root.id);return root;
}
