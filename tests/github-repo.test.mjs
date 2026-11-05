import { test } from 'node:test';
import assert from 'node:assert/strict';
import { githubRepository, cleanGitHubData, fetchGitHubData } from '../js/github-repo.js';
import { cleanValue } from '../js/group-model.js';
import { serviceForUrl } from '../js/services.js';
const repo=githubRepository('https://github.com/usini/bete');
test('repository detection accepts repository links, not account pages, files, issues or lookalikes',()=>{
 for(const url of ['https://github.com/usini/bete','https://www.github.com/usini/bete.git/?tab=readme#test']) assert.equal(githubRepository(url)?.key,'usini/bete');
 for(const url of ['https://github.com','https://github.com/usini','https://github.com/usini/bete/issues/1','https://github.com/settings/profile','https://github.com.evil.test/usini/bete','https://user:secret@github.com/usini/bete','http://github.com/usini/bete','https://github.com:444/usini/bete']) assert.equal(githubRepository(url),null,url);
 assert.equal(serviceForUrl('https://github.com/usini/bete')?.id,'github');
});
test('public metadata and latest release are fetched without authentication or cookies',async()=>{
 const requests=[];
 const data=await fetchGitHubData(repo,async(url,options)=>{
  requests.push(url);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers.Authorization,undefined);
  return Response.json(url.endsWith('/latest')?{tag_name:'v1.2.3'}:{private:false,full_name:'usini/bete',description:'Un tableau libre',language:'JavaScript',license:{spdx_id:'MIT'},stargazers_count:12,forks_count:3,pushed_at:'2026-11-05T12:00:00Z'});
 });
 assert.equal(requests.length,2);assert.equal(data.description,'Un tableau libre');assert.equal(data.release,'v1.2.3');assert.equal(data.stars,12);assert.equal(data.license,'MIT');
});
test('private, nonexistent, rate-limited and offline repositories fall back without further requests',async()=>{
 for(const status of [404,403,429]){let calls=0;assert.equal(await fetchGitHubData(repo,async()=>{calls++;return new Response('',{status});}),null);assert.equal(calls,1);}
 assert.equal(await fetchGitHubData(repo,async()=>{throw new TypeError('offline');}),null);
 assert.equal(await fetchGitHubData(repo,async()=>Response.json({private:true,full_name:'usini/bete'})),null);
});
test('missing release does not discard public metadata; untrusted imported fields are bounded',async()=>{
 const data=await fetchGitHubData(repo,async url=>url.endsWith('/latest')?new Response('',{status:404}):Response.json({private:false,full_name:'usini/bete',description:'a'.repeat(1000),stargazers_count:-1}));
 assert.equal(data.release,'');assert.equal(data.description.length,320);assert.equal(data.stars,0);
 const clean=cleanValue({kind:'rect',link:'https://github.com/usini/bete',github:{...data,secret:'private',stars:Infinity}});
 assert.equal(clean.github.repository,'usini/bete');assert.equal(clean.github.secret,undefined);assert.equal(clean.github.stars,0);
 assert.equal(cleanGitHubData(data,'https://github.com/another/project'),null);
});
