import {test} from 'node:test';
import assert from 'node:assert/strict';
import {showLinkByDefault} from '../js/link-label-default.js';
test('new YouTube and social links default to a visible label',()=>{
 for(const url of ['https://www.amazon.fr/dp/B012345678','https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://www.instagram.com/p/example/','https://x.com/user/status/123','https://www.facebook.com/user','https://www.linkedin.com/in/example'])assert.equal(showLinkByDefault(url),true,url);
 for(const url of ['https://example.com','https://amazon.fr.evil.test/dp/B012345678','https://x.com.evil.test/user','not a link'])assert.equal(showLinkByDefault(url),false,url);
});
