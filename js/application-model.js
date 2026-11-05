// Portable block descriptors contain no executable path and no launch permission.
export function steamApplicationUri(value) {
  const match = /^steam:\/\/(?:rungameid|run)\/(\d{1,20})\/?$/i.exec(String(value || '').trim());
  return match ? 'steam://rungameid/' + match[1] : null;
}
export function cleanApplication(raw) {
  if(!raw||typeof raw!=='object'||typeof raw.reference!=='string'||!/^[a-f0-9]{64}$/.test(raw.reference))return null;
  const label=typeof raw.label==='string'?raw.label.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,100):'Application';
  const result={reference:raw.reference,label:label||'Application'};
  if(typeof raw.icon==='string' && raw.icon.length<=200000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(raw.icon)) result.icon=raw.icon;
  const steam=steamApplicationUri(raw.steam);if(steam)result.steam=steam;
  return result;
}
export function newSteamApplication(value) {
  const steam=steamApplicationUri(value);if(!steam)return null;
  const reference=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  return {reference,label:'Steam — '+steam.split('/').at(-1),steam};
}
