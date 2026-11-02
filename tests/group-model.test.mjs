import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanRecord, mergeRecord, cleanValue, emptyPlacement, intersects, groupMembers } from '../js/group-model.js';

const value = text => cleanValue({ text, w: 100, h: 80, color: '#FF0000' });
const record = (clock, actor, text) => ({ id: 'block-0001', clock, actor, value: value(text) });

test('concurrent changes converge, deletion survives a stale snapshot and offline edits can advance', () => {
  const first = record(1, 'actor-0001', 'one'), a = record(2, 'actor-0001', 'two'), b = record(2, 'actor-0002', 'three');
  const left = new Map(), right = new Map();
  for (const r of [first, a, b]) mergeRecord(left, r);
  for (const r of [b, first, a]) mergeRecord(right, r);
  assert.deepEqual([...left], [...right]);
  mergeRecord(left, { id: first.id, clock: 3, actor: first.actor, deleted: true });
  assert.equal(mergeRecord(left, first), false);
  assert.equal(left.get(first.id).deleted, true);
  assert.equal(mergeRecord(left, record(4, 'actor-0002', 'offline')), true);
});

test('wire data cannot carry unrelated ids, private fields, raw images or root deletion', () => {
  assert.equal(cleanRecord({ id: 'root', clock: 1, actor: 'actor-0001', deleted: true }), null);
  assert.equal(cleanRecord(record(Infinity, 'actor-0001', 'bad')), null);
  const clean = cleanValue({ ...value('ok'), image: 'data:image/png;base64,private', ownerToken: 'secret', shareId: 'private' });
  assert.equal(clean.image, undefined); assert.equal(clean.ownerToken, undefined); assert.equal(clean.shareId, undefined);
});

test('new groups reserve space for protruding members and group membership uses their centres', () => {
  const privateNodes = [{ x: 0, y: 0, w: 900, h: 600 }, { x: 1000, y: 0, w: 400, h: 500 }];
  const values = [{ x: 0, y: 0, w: 400, h: 300 }, { x: -50, y: 100, w: 100, h: 100 }];
  const position = emptyPlacement(privateNodes, values);
  for (const v of values) for (const n of privateNodes) assert.equal(intersects({ ...v, x: v.x + position.x, y: v.y + position.y }, n), false);
  const root = { kind: 'group', x: 0, y: 0, w: 400, h: 300 };
  const inside = { kind: 'rect', x: -50, y: 100, w: 100, h: 100 };
  const outside = { kind: 'rect', x: 600, y: 0, w: 100, h: 100 };
  assert.deepEqual(groupMembers([root, inside, outside], root), [inside]);
});
