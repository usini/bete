import { getNode, emit } from './state.js?v=mw3nilz8';
import { githubRepository, fetchGitHubData } from './github-repo.js?v=mw3nilz8';
const cache=new Map();
const requests=new WeakMap();
export async function updateGitHubCard(node, refresh=false) {
  const repo=node.kind==='rect'&&githubRepository(node.link||node.text);
  if(!repo){if(node.github){delete node.github;emit();}return false;}
  const ticket={};requests.set(node,ticket);
  const key=repo.key.toLowerCase();
  let entry=cache.get(key);
  if(refresh||!entry||Date.now()-entry.time>600000){
    if(cache.size>=200)cache.delete(cache.keys().next().value);
    entry={time:Date.now(),promise:fetchGitHubData(repo)};cache.set(key,entry);
  }
  const data=await entry.promise;
  if(getNode(node.id)!==node || requests.get(node)!==ticket || githubRepository(node.link||node.text)?.key.toLowerCase()!==key)return false;
  if(data)node.github=data;else delete node.github;
  emit();return !!data;
}
