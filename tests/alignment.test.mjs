import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignmentPlan } from '../js/alignment.js';
const node=(id,x,y,w=100,h=60)=>({id,kind:'rect',x,y,w,h});
const group=(w,h)=>({x:0,y:0,w,h});
test('horizontal bar unifies similar shapes, preserves order and equalizes gaps without mutations',()=>{
 const nodes=[node('c',400,40,120,70),node('a',20,20),node('b',200,50,110,65)];const before=JSON.stringify(nodes);
 const plan=alignmentPlan(group(700,150),nodes);
 assert.equal(plan.mode,'Ligne horizontale');assert.deepEqual(plan.nodes.map(n=>n.id),['a','b','c']);
 assert.equal(new Set(plan.nodes.map(n=>n.w)).size,1);assert.equal(new Set(plan.nodes.map(n=>n.h)).size,1);
 assert.equal(new Set(plan.nodes.map(n=>n.y)).size,1);
 const [a,b,c]=plan.nodes;assert.equal(b.x-a.x-a.w,c.x-b.x-b.w);assert.equal(JSON.stringify(nodes),before);
});
test('vertical bar keeps top-to-bottom order and mixed formats',()=>{
 const nodes=[node('b',50,200,60,150),node('a',20,20,100,60)];
 const p=alignmentPlan(group(180,700),nodes);assert.equal(p.mode,'Colonne verticale');assert.deepEqual(p.nodes.map(n=>n.id),['a','b']);assert.equal(p.nodes[1].h,150);assert.equal(p.nodes[0].w,100);
});
test('rectangular rows preserve portrait videos and leave detached islands untouched',()=>{
 const nodes=[node('a',0,0),node('b',130,5),node('c',0,160),node('portrait',130,140,60,120),node('island1',700,0),node('island2',820,0)];
 const p=alignmentPlan(group(1000,500),nodes);
 assert.deepEqual(p.nodes.map(n=>n.id),['a','b','c','portrait']);assert.equal(p.nodes[3].h,120);assert.equal(p.nodes[3].w,60);
 assert.equal(p.nodes[0].x,p.nodes[2].x);assert.equal(p.nodes[2].y,p.nodes[3].y);
});
test('two staggered blocks follow the frame direction',()=>{
 const nodes=[node('a',0,0),node('b',200,200)];
 assert.equal(alignmentPlan(group(400,500),nodes).mode,'Colonne verticale');
 assert.equal(alignmentPlan(group(500,400),nodes).mode,'Ligne horizontale');
});
test('empty and single-block groups produce no changes',()=>{
 assert.deepEqual(alignmentPlan(group(400,400),[]).nodes,[]);
 assert.deepEqual(alignmentPlan(group(400,400),[node('a',0,0)]).nodes,[]);
});
