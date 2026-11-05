import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceForUrl, serviceForNode } from '../js/services.js';
import { genericLink } from '../js/links.js';

test('Gmail accepts every path/query/fragment without mistaking embedded video URLs for YouTube', () => {
  const url = 'https://mail.google.com/mail/u/2/?q=https://youtube.com/watch?v=dQw4w9WgXcQ#inbox/private';
  assert.equal(serviceForUrl(url).id, 'gmail');
  assert.equal(genericLink(url), url);
  assert.equal(serviceForNode({kind:'rect',text:url}).id,'gmail');
});

test('YouTube and Facebook are restricted to the homepage, X to /home', () => {
  for (const [url,id] of [['https://www.youtube.com','youtube'],['https://youtube.com/','youtube'],['https://www.facebook.com','facebook'],['https://x.com/home','x']]) assert.equal(serviceForUrl(url).id,id);
  for (const url of ['https://youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com/@channel','https://youtube.com/shorts/123','https://facebook.com/profile.php?id=123','https://facebook.com/?story_fbid=123','https://x.com/user/status/123','https://x.com/']) assert.equal(serviceForUrl(url),null,url);
});

test('app entry points are recognized while documents, profiles, songs and repositories stay links', () => {
  const cases = [
    ['https://drive.google.com/drive/u/1/my-drive','googledrive'],
    ['https://calendar.google.com/calendar/u/0/r','googlecalendar'],
    ['https://www.google.com/maps','googlemaps'],
    ['https://docs.google.com/document/u/0/','googledocs'],
    ['https://docs.google.com/spreadsheets/u/0/','googlesheets'],
    ['https://docs.google.com/presentation/u/0/','googleslides'],
    ['https://outlook.live.com/mail/0/inbox','microsoftoutlook'],
    ['https://www.instagram.com/','instagram'],['https://www.linkedin.com/feed/','linkedin'],
    ['https://web.whatsapp.com/','whatsapp'],['https://discord.com/channels/@me','discord'],
    ['https://github.com/','github'],['https://open.spotify.com/','spotify'],
    ['https://www.reddit.com/','reddit'],['https://www.twitch.tv/','twitch'],['https://web.telegram.org/k/','telegram'],
  ];
  for (const [url,id] of cases) assert.equal(serviceForUrl(url).id,id,url);
  for (const url of ['https://docs.google.com/document/d/private/edit','https://drive.google.com/file/d/123/view','https://instagram.com/profile','https://github.com/usini/bete','https://open.spotify.com/track/123','https://google.com/search?q=private','https://twitch.tv/channel']) assert.equal(serviceForUrl(url),null,url);
});

test('lookalike domains, credentials, custom ports and non-rectangle blocks cannot get branded icons', () => {
  for (const url of ['https://mail.google.com.evil.example/','https://evil.example/?site=mail.google.com','https://user:pass@mail.google.com/','https://www.youtube.com:444/','javascript:alert(1)']) assert.equal(serviceForUrl(url),null);
  assert.equal(serviceForNode({kind:'group',text:'https://mail.google.com/'}),null);
});

test('ChatGPT homepage uses a local service icon, leaving conversations as links',()=>{
 for(const url of ['https://chatgpt.com','https://chatgpt.com/','https://www.chatgpt.com/']) assert.equal(serviceForUrl(url)?.id,'chatgpt');
 for(const url of ['https://chatgpt.com/c/private','https://chatgpt.com.evil.test/']) assert.equal(serviceForUrl(url),null);
});

test('Google Calendar entry URLs ignore account numbers, language parameters and fragments',()=>{
 for(const url of ['https://calendar.google.com/calendar/u/1/r?hl=fr','https://calendar.google.com/calendar/u/23/r?hl=en#main','https://calendar.google.com/?hl=fr']) assert.equal(serviceForUrl(url)?.id,'googlecalendar',url);
 for(const url of ['https://calendar.google.com.evil.test/calendar/u/1/r?hl=fr','https://calendar.google.com/calendar/u/1/r/eventedit?text=private']) assert.equal(serviceForUrl(url),null);
});
