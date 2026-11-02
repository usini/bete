import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainLink, genericLink, genericLinkOf, droppedLink, droppedTitle } from '../js/links.js';

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

test('drop titles use supplied browser text only, excluding repeated URLs', () => {
  const data = values => ({getData: type => values[type] || ''});
  assert.equal(droppedTitle(data({'text/plain':'Le titre de la page'}),'https://example.org/'),'Le titre de la page');
  assert.equal(droppedTitle(data({'text/plain':'https://example.org/'}),'https://example.org/'),'');
  assert.equal(droppedTitle(data({'text/x-moz-url':'https://example.org/\nTitre Firefox'}),'https://example.org/'),'Titre Firefox');
  assert.equal(droppedTitle(data({}),'https://example.org/'),'');
});

test('browser drops accept URL lists, bookmarks and Firefox links without interpreting HTML', () => {
  const data = values => ({getData: type => values[type] || ''});
  assert.equal(droppedLink(data({'text/uri-list':'# bookmark\r\nhttps://example.org/page\r\n','text/plain':'Un titre'})),'https://example.org/page');
  assert.equal(droppedLink(data({'text/x-moz-url':'https://example.org/\nUn titre'})),'https://example.org/');
  assert.equal(droppedLink(data({'text/plain':'https://youtu.be/dQw4w9WgXcQ'})),'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(droppedLink(data({'text/plain':'javascript:alert(1)','text/html':'<a href="https://example.org">test</a>'})),null);
});
