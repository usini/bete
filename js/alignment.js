// Geometry-only first pass: infer existing rows rather than inventing a reading order.
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
export function alignmentPlan(group, nodes, boundsOf = n => n) {
  if (nodes.length < 2) return { mode: 'Pas assez de blocs', nodes: [] };
  const gap = Math.max(24, median(nodes.map(n=>Math.min(n.w,n.h))) * .18);
  const xs=nodes.map(n=>n.x+n.w/2), ys=nodes.map(n=>n.y+n.h/2);
  const spanX=Math.max(...xs)-Math.min(...xs), spanY=Math.max(...ys)-Math.min(...ys);
  const rows=[];
  for (const n of [...nodes].sort((a,b)=>(a.y+a.h/2)-(b.y+b.h/2))) {
    const cy=n.y+n.h/2;
    const row=rows.find(r=>Math.abs(r.cy-cy)<=Math.min(r.height,n.h)*.55);
    if(row) {row.items.push(n);row.cy=row.items.reduce((sum,b)=>sum+b.y+b.h/2,0)/row.items.length;row.height=Math.min(row.height,n.h);}
    else rows.push({cy,height:n.h,items:[n]});
  }
  const multiRows=rows.filter(r=>r.items.length>=2).length;
  const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
  const vx=xs.reduce((s,x)=>s+(x-mx)**2,0),vy=ys.reduce((s,y)=>s+(y-my)**2,0);
  const cov=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
  const diagonal=nodes.length<=2 || (vx>0&&vy>0&&Math.abs(cov/Math.sqrt(vx*vy))>.88);
  let axis=null;
  if(group.w/group.h>2.8 || (spanX>spanY*2.2 && multiRows<2)) axis='x';
  else if(group.h/group.w>2.8 || (spanY>spanX*2.2 && multiRows<2)) axis='y';
  else if(diagonal && multiRows<2) axis=group.w>=group.h?'x':'y';
  const planned=[];
  const originX=Math.min(...nodes.map(n=>boundsOf(n).x)),originY=Math.min(...nodes.map(n=>boundsOf(n).y));
  function pack(items,x,y,axis,uniform) {
    const copies=items.map(n=>({...n}));
    if(uniform && copies.every(n=>n.kind!=='group')) {
      const w=Math.max(...copies.map(n=>n.w)),h=Math.max(...copies.map(n=>n.h));
      for(const n of copies){n.w=w;n.h=h;}
    }
    let cursor=axis==='x'?x:y,maxCross=0;
    for(const n of copies){
      const b=boundsOf(n);
      n.x+=(axis==='x'?cursor:x)-b.x;n.y+=(axis==='y'?cursor:y)-b.y;
      cursor+=(axis==='x'?b.w:b.h)+gap;maxCross=Math.max(maxCross,axis==='x'?b.h:b.w);
      planned.push(n);
    }
    return maxCross;
  }
  if(axis) {
    const ratios=nodes.map(n=>n.w/n.h);
    pack([...nodes].sort((a,b)=>(axis==='x'?a.x+a.w/2:a.y+a.h/2)-(axis==='x'?b.x+b.w/2:b.y+b.h/2)),originX,originY,axis,Math.max(...ratios)/Math.min(...ratios)<1.4);
    return {mode:axis==='x'?'Ligne horizontale':'Colonne verticale',nodes:planned};
  }
  // Split large gaps into independent islands. Keep islands away from the main row starts.
  const typical=median(nodes.map(n=>n.w));
  const chunks=[];
  for(const row of rows){
    const sorted=[...row.items].sort((a,b)=>a.x-b.x);let chunk=[];
    for(const n of sorted){if(chunk.length && n.x-(chunk.at(-1).x+chunk.at(-1).w)>typical*1.7){chunks.push(chunk);chunk=[];}chunk.push(n);}if(chunk.length)chunks.push(chunk);
  }
  const main=chunks.filter(c=>c.length>=2);
  if(!main.length) return {mode:'Disposition conservée : rangées incertaines',nodes:[]};
  const start=median(main.map(c=>Math.min(...c.map(n=>n.x))));
  let y=originY;
  for(const chunk of chunks){
    const left=Math.min(...chunk.map(n=>n.x));
    if(chunk.length<2 || (main.length>=2 && Math.abs(left-start)>typical*1.8)) continue;
    y+=pack(chunk,start,y,'x',false)+gap;
  }
  return {mode:'Rangées conservées · formats préservés',nodes:planned};
}
