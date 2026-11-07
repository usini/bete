import {test} from 'node:test';
import assert from 'node:assert/strict';
import {creationSize,freeCreationPosition} from '../js/creation.js';
test('new blocks retain a usable remembered size and normalize tiny or oversized screen sizes',()=>{
 assert.deepEqual(creationSize({w:180,h:110},1),{w:180,h:110});
 for(const zoom of [.001,.01,8]){
  const size=creationSize({w:900,h:600},zoom,{w:393,h:850});
  assert.ok(size.w*zoom>=40&&size.w*zoom<=393*.65);
  assert.ok(size.h*zoom>=40&&size.h*zoom<=850*.6);
 }
 const size=creationSize({w:180,h:110},.01);assert.ok(Math.abs(size.w/size.h-180/110)<1e-9);
});
test('creation avoids the entire group including empty space and leaves a margin',()=>{
 const group={kind:'group',x:0,y:0,w:500,h:300};
 const block={kind:'rect',x:200,y:100,w:100,h:80};
 const pos=freeCreationPosition(block,[group],n=>n,32);
 const placed={...block,...pos};
 assert.ok(placed.x+placed.w<=-32||placed.x>=532||placed.y+placed.h<=-32||placed.y>=332);
 assert.deepEqual(group,{kind:'group',x:0,y:0,w:500,h:300});
});
test('creation respects spacing even without an initial overlap, and keeps free positions',()=>{
 const block={kind:'rect',x:110,y:0,w:100,h:80};
 const other={kind:'rect',x:0,y:0,w:100,h:80};
 const pos=freeCreationPosition(block,[other],n=>n,32);
 assert.ok(pos.x>=132||pos.y>=112||pos.y+80<=-32||pos.x+100<=-32);
 assert.deepEqual(freeCreationPosition({...block,x:300},[other]),{x:300,y:0});
});
