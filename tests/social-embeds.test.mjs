import test from 'node:test';
import assert from 'node:assert/strict';
import { socialEmbed, socialEmbedOf } from '../js/social-embeds.js';

test('X and legacy Twitter post URLs produce the same official frame without tracking parameters', () => {
  const expected=socialEmbed('https://x.com/example/status/1234567890123456789?s=20');
  assert.equal(expected.className,'x-embed');
  assert.equal(new URL(expected.src).hostname,'platform.twitter.com');
  assert.equal(new URL(expected.src).searchParams.get('id'),'1234567890123456789');
  assert.equal(new URL(expected.src).searchParams.get('dnt'),'true');
  assert.equal(new URL(expected.src).searchParams.has('s'),false);
  for(const url of ['https://twitter.com/example/status/1234567890123456789/photo/1','https://mobile.twitter.com/example/status/1234567890123456789','https://x.com/i/web/status/1234567890123456789','https://x.com/i/status/1234567890123456789']) assert.equal(socialEmbed(url).key,expected.key);
});

test('Instagram posts and reels use official frames with caption and strip share parameters', () => {
  for(const path of ['p','reel']) {
    const value=socialEmbed('https://www.instagram.com/'+path+'/AbC_d-123/?igsh=private-tracking');
    assert.equal(value.className,'instagram-embed');
    assert.equal(value.src,'https://www.instagram.com/'+path+'/AbC_d-123/embed/captioned/');
    assert.equal(socialEmbed(value.src).key,value.key);
    assert.equal(socialEmbedOf({kind:'rect',link:'https://instagram.com/'+path+'/AbC_d-123/'}).key,value.key);
  }
});

test('profiles, stories, arbitrary hosts, credentials and custom ports remain ordinary links', () => {
  for(const url of ['https://x.com/home','https://x.com/example','https://x.com/example/status/not-an-id',
    'https://x.com.evil.test/example/status/123','https://user@x.com/example/status/123',
    'https://x.com:444/example/status/123','http://x.com/example/status/123','https://t.co/123',
    'https://instagram.com/example/','https://instagram.com/stories/example/123',
    'https://instagram.com.evil.test/p/AbCd/','https://instagram.com/p/a/b/']) assert.equal(socialEmbed(url),null,url);
  const link='https://instagram.com/p/AbCd/';
  assert.equal(socialEmbedOf({kind:'group',link}),null);
  assert.equal(socialEmbedOf({kind:'rect',link,image:'idb:photo'}),null);
});
