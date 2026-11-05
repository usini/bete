import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeDropPosition, settleDrop, dropTargetGroup } from '../js/placement.js';
const block = (x, y, w=100, h=100) => ({kind:'rect',x,y,w,h});
const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
test('drop beside a block moves only the dragged block, using the closest side',()=>{
 const fixed=block(0,0), moving=block(80,10); const snapshot={...fixed};
 const pos=freeDropPosition(moving,[fixed,moving]);
 assert.deepEqual(pos,{x:116,y:10}); assert.deepEqual(fixed,snapshot);
});
test('free drops and group containers retain their positions',()=>{
 const moving=block(10,10), group={kind:'group',x:0,y:0,w:500,h:500};
 assert.deepEqual(freeDropPosition(moving,[group,moving]),{x:10,y:10});
 settleDrop(group,[group,moving],[moving]);
 assert.deepEqual({x:group.x,y:group.y},{x:0,y:0});
 assert.deepEqual(freeDropPosition(moving,[moving,block(110,10)]),{x:10,y:10});
});
test('crowded drops find space without moving any obstacle',()=>{
 const fixed=[block(0,0),block(116,0),block(0,116),block(-116,0),block(0,-116)];
 const moving=block(5,5); const snapshot=JSON.stringify(fixed);
 const positioned={...moving,...freeDropPosition(moving,[...fixed,moving])};
 assert.ok(fixed.every(n=>!overlaps(positioned,n))); assert.equal(JSON.stringify(fixed),snapshot);
 assert.deepEqual(freeDropPosition(positioned,[...fixed,positioned]),{x:positioned.x,y:positioned.y});
});
test('custom visual bounds reserve labels outside the block',()=>{
 const moving=block(100,0), fixed=block(0,0);
 const bounds=n=>({...n,x:n.x-20,w:n.w+20,y:n.y-40,h:n.h+40});
 const pos=freeDropPosition(moving,[fixed,moving],bounds);
 assert.equal(pos.x,136); assert.equal(pos.y,0);
});

test('moving a group repels external blocks and carries its original contents together',()=>{
 const group={kind:'group',x:0,y:0,w:300,h:300};
 const member=block(40,90), nested={kind:'group',x:30,y:80,w:130,h:130};
 const outsider=block(270,100);
 const before={...outsider};
 settleDrop(group,[group,member,nested,outsider],[member,nested]);
 assert.deepEqual({x:group.x,y:group.y},{x:-46,y:0});
 assert.equal(member.x,group.x+40); assert.equal(member.y,group.y+90);
 assert.equal(nested.x,group.x+30); assert.equal(nested.y,group.y+80);
 assert.ok(!overlaps(group,outsider)); assert.deepEqual(outsider,before);
});

test('group intent is captured on contact before repulsion, including nested frames',()=>{
 const outer={kind:'group',x:0,y:0,w:500,h:500};
 const inner={kind:'group',x:100,y:100,w:200,h:200};
 const moving=block(290,150), fixed=block(270,150);
 const nodes=[outer,inner,moving,fixed];
 const target=dropTargetGroup(moving,nodes);
 assert.equal(target,inner);
 settleDrop(moving,nodes);
 assert.ok(!overlaps(moving,fixed));
 assert.equal(target,inner,'collision resolution must not discard the intended group');
 assert.equal(dropTargetGroup(block(500,40),[outer]),outer,'edge contact is enough');
 assert.equal(dropTargetGroup(block(501,40),[outer]),null);
 assert.equal(dropTargetGroup(inner,[outer,inner]),null,'moving groups never adopt blocks');
});
