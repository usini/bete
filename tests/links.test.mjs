import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainLink, genericLink, genericLinkOf } from '../js/links.js';

test('ordinary single URLs become link previews, without changing YouTube or Amazon handling', () => {
  assert.equal(genericLink('example.org/path?q=hello#test'), 'https://example.org/path?q=hello#test');
  assert.equal(genericLink('https://youtu.be/dQw4w9WgXcQ'), null);
  assert.equal(genericLink('https://www.amazon.fr/dp/B012345678'), null);
  assert.equal(genericLink('https://amzn.to/example'), null);
  assert.equal(genericLink('du texte https://example.org'), null);
  assert.equal(plainLink('javascript:alert(1)'), null);
  assert.equal(genericLink('https://user:password@example.org'), null);
  assert.equal(genericLinkOf({kind:'group',text:'https://example.org'}),null);
  assert.equal(genericLinkOf({kind:'rect',text:'https://example.org'}),'https://example.org/');
  assert.equal(genericLinkOf({kind:'rect',text:'Mon site',link:'https://example.org'}),'https://example.org/');
});
