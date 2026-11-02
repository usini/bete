import test from 'node:test';
import assert from 'node:assert/strict';
import { facebookPost, facebookPostOf, facebookEmbed } from '../js/facebook.js';

test('explicit Facebook posts are normalized without tracking parameters', () => {
  assert.equal(facebookPost('https://m.facebook.com/example/posts/pfbid123?fbclid=secret#comments'), 'https://www.facebook.com/example/posts/pfbid123');
  assert.equal(facebookPost('https://www.facebook.com/groups/123/permalink/456/'), null);
  assert.equal(facebookPost('https://www.facebook.com/groups/123/posts/456/'), null);
  assert.equal(facebookPost('https://facebook.com/story.php?story_fbid=pfbid123&id=123&tracking=secret'), 'https://www.facebook.com/story.php?story_fbid=pfbid123&id=123');
  assert.match(facebookEmbed('https://www.facebook.com/example/posts/123'), /^https:\/\/www\.facebook\.com\/plugins\/post\.php\?href=https%3A/);
});

test('ordinary links, lookalikes and unsupported Facebook links are never embedded', () => {
  for (const url of ['https://facebook.com', 'https://facebook.com/example', 'https://facebook.com/share/p/123', 'https://facebook.com/reel/123', 'https://facebook.com.evil.test/example/posts/123', 'https://evilfacebook.com/example/posts/123', 'https://user@facebook.com/example/posts/123', 'https://facebook.com:444/example/posts/123', 'http://facebook.com/example/posts/123', 'https://facebook.com/story.php?id=123']) assert.equal(facebookPost(url), null, url);
  const link = 'https://facebook.com/example/posts/123';
  assert.ok(facebookPostOf({kind:'rect', link}));
  assert.equal(facebookPostOf({kind:'group', text:link}), null);
  assert.equal(facebookPostOf({kind:'rect', link, image:'idb:photo'}), null);
});
