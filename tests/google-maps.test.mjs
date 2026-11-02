import test from 'node:test';
import assert from 'node:assert/strict';
import { googleMapsEmbed, googleMapsEmbedOf } from '../js/google-maps.js';
import { plainLink } from '../js/links.js';

test('direct Google Maps embed URLs and copied iframe HTML retain only an approved source', () => {
  const source='https://www.google.com/maps/embed?pb=!1m18!2m3!1d123&hl=fr';
  const expected=googleMapsEmbed(source);
  assert.equal(new URL(expected).searchParams.get('pb'),'!1m18!2m3!1d123');
  assert.equal(new URL(expected).searchParams.get('hl'),'fr');
  const html='<iframe src="'+source.replaceAll('&','&amp;')+'" width="600" onload="alert(1)"></iframe>';
  assert.equal(googleMapsEmbed(html),expected);
  assert.equal(plainLink(html),expected);
  assert.equal(googleMapsEmbedOf({kind:'rect',text:source}),expected);
  assert.equal(googleMapsEmbedOf({kind:'rect',link:source,image:'idb:photo'}),null);
  assert.equal(googleMapsEmbedOf({kind:'group',link:source}),null);
});

test('other URLs, arbitrary embeds, credentials and lookalike domains cannot load a frame', () => {
  for(const value of ['https://www.google.com/maps','https://maps.app.goo.gl/abcd',
    'https://www.google.com/maps/embed','https://www.google.com/maps/embed/v1/place?key=example&q=Paris',
    'http://www.google.com/maps/embed?pb=test','https://www.google.com.evil.test/maps/embed?pb=test',
    'https://user@www.google.com/maps/embed?pb=test','https://www.google.com:444/maps/embed?pb=test',
    '<iframe src="https://evil.test/maps/embed?pb=test"></iframe>','<script>alert(1)</script>'])
    assert.equal(googleMapsEmbed(value),null,value);
});
