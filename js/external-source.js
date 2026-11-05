export function githubSource(value) {
  const parts = value.includes('/') ? value.split('/') : value.split('-');
  const [owner, repo, ...rest] = parts;
  const file = (value.includes('/') ? rest.length === 1 && rest[0] : rest.join('-'));
  if (!/^[a-z0-9][a-z0-9-]{0,38}$/i.test(owner || '') ||
      !/^[a-z0-9_][a-z0-9_.-]{0,99}$/i.test(repo || '') ||
      !/^[a-z0-9_][a-z0-9_.-]{0,199}$/i.test(file || '')) return null;
  const name = file.replace(/\.json$/i, '');
  if (!name) return null;
  return { id: [owner, repo, name].join('/'), name, url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${name}.json` };
}

// Accept Bête viewer links and root JSON files published on GitHub's main branch.
export function parseExternalBoardLink(raw, origin = 'https://bete.usini.eu') {
  const value=String(raw||'').trim();
  if(value.length>2048)return null;
  if(!value.includes('://')&&!value.startsWith('?'))return githubSource(value);
  try {
    const url=new URL(value,origin);
    if(url.username||url.password)return null;
    if((url.origin===origin||url.origin==='https://bete.usini.eu')&&url.searchParams.has('github'))return githubSource(url.searchParams.get('github'));
    if(url.protocol!=='https:'||url.port)return null;
    const path=url.pathname.split('/').slice(1);
    if(url.hostname==='github.com'&&path.length===5&&path[2]==='blob'&&path[3]==='main'&&path[4].endsWith('.json'))return githubSource([path[0],path[1],path[4]].join('/'));
    if(url.hostname==='raw.githubusercontent.com'&&path.length===4&&path[2]==='main'&&path[3].endsWith('.json'))return githubSource([path[0],path[1],path[3]].join('/'));
    return null;
  }catch{return null;}
}
