// Public repository metadata only: no account, token, cookies or page scraping.
const reserved = new Set(['settings','orgs','users','topics','collections','marketplace','features','login','signup','search','explore','notifications','pulls','issues','new','sponsors','apps','codespaces','enterprises','organizations','site','about','security']);
export function githubRepository(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['github.com','www.github.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
    const parts=url.pathname.replace(/\/$/,'').split('/').slice(1);
    if(parts.length!==2 || reserved.has(parts[0].toLowerCase()))return null;
    const [owner,rawRepo]=parts,repo=rawRepo.replace(/\.git$/i,'');
    if(!/^[a-z0-9](?:[a-z0-9-]{0,38})$/i.test(owner) || !/^[a-z0-9_.-]{1,100}$/i.test(repo) || ['.','..'].includes(repo))return null;
    return { owner, repo, key:owner+'/'+repo };
  } catch { return null; }
}
const text=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
export function cleanGitHubData(raw, link) {
  const repo=githubRepository(link);
  if(!repo || !raw || typeof raw!=='object' || typeof raw.repository!=='string' || raw.repository.toLowerCase()!==repo.key.toLowerCase())return null;
  const n={repository:repo.key,description:text(raw.description,320),language:text(raw.language,60),license:text(raw.license,60),release:text(raw.release,80)};
  for(const key of ['stars','forks']) n[key]=Number.isSafeInteger(raw[key])&&raw[key]>=0&&raw[key]<=1e12?raw[key]:0;
  n.pushedAt=typeof raw.pushedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(raw.pushedAt)&&Number.isFinite(Date.parse(raw.pushedAt))?raw.pushedAt:'';
  return n;
}
export async function fetchGitHubData(repo, fetcher=fetch) {
  const base='https://api.github.com/repos/'+encodeURIComponent(repo.owner)+'/'+encodeURIComponent(repo.repo);
  const options=()=>({credentials:'omit',referrerPolicy:'no-referrer',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});
  try {
    const response=await fetcher(base,options());
    if(!response.ok)return null;
    const data=await response.json();
    if(data.private!==false || String(data.full_name).toLowerCase()!==repo.key.toLowerCase())return null;
    let release='';
    try {const r=await fetcher(base+'/releases/latest',options());if(r.ok){const j=await r.json();release=j.draft||j.prerelease?'':j.tag_name;}} catch { /* No release information does not discard repository details. */ }
    return cleanGitHubData({repository:repo.key,description:data.description,language:data.language,license:data.license?.spdx_id==='NOASSERTION'?'':data.license?.spdx_id,release,stars:data.stargazers_count,forks:data.forks_count,pushedAt:data.pushed_at},'https://github.com/'+repo.key);
  }catch{return null;}
}
