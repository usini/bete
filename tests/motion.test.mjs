import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepMotion, setDragging } from '../js/motion.js';

test('drag follows the target, release settles elastically without modifying saved geometry', () => {
  const node = { x: 0, y: 0, w: 180, h: 110, text: 'Test' };
  stepMotion(node, 1/60);
  setDragging(node, true);
  node.x = 80;
  const during = stepMotion(node, 1/60);
  assert.equal(during.dx, 0);
  assert.ok(during.stretch > 0 && during.stretch <= 0.14);
  setDragging(node, false);
  assert.ok(stepMotion(node, 1/60).dx > 0);
  let after;
  for (let i=0;i<240;i++) after=stepMotion(node,1/60);
  assert.equal(after.active,false); assert.equal(after.dx,0);
  assert.deepEqual(node,{x:80,y:0,w:180,h:110,text:'Test'});
});

test('remote moves animate and a sleeping tab cannot destabilize the spring', () => {
  const node={x:0,y:0}; stepMotion(node,1/60);
  node.x=300;node.y=-100;
  const frame=stepMotion(node,100);
  assert.ok(frame.dx<0 && frame.dy>0);
  assert.ok(Number.isFinite(frame.dx));
  for(let i=0;i<240;i++)stepMotion(node,1/60);
  assert.equal(stepMotion(node,1/60).active,false);
});
