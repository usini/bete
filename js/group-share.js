import { localStore } from './local-store.js?v=mw11boe7';
import { state, events, onSaved, newId, sanitizeNode, emit, select, getNode, setGroupMemberFilter } from './state.js?v=mw11boe7';
import { imageBlob, storeSharedImage } from './images.js?v=mw11boe7';
import { flyTo, view, screenToWorld } from './camera.js?v=mw11boe7';
import { MAX_MEMBERS, MAX_RECORDS, ROOT, validId, validImage, cleanValue, cleanRecord, mergeRecord, groupMembers, emptyPlacement, intersects, imageChunkBytes } from './group-model.js?v=mw11boe7';
import { smoothPointer } from './motion.js?v=mw11boe7';

// Explicit ICE config is essential: PeerJS's defaults include public TURN relays.
export const peerConfig = {
  host: 'peer-bete.usini.eu', port: 443, path: '/', key: 'bete', secure: true, debug: 0,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
};
const KEY = 'bete2:groupShares';
const MAX_IMAGE = 10 * 1024 * 1024, CHUNK = 12288, MAX_PEERS = 8;
const shares = new Map();
const PROFILE_KEY = 'bete2:shareProfile';
let profile;
function shareProfile() {
  if (profile) return profile;
  try { profile = JSON.parse(localStore.getItem(PROFILE_KEY)); } catch {}
  if (!/^[a-f0-9]{64}$/.test(profile?.device || '')) {
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), byte => alphabet[byte % 32]).join('');
    profile = { device: secret(), fallback: 'Invité ' + suffix, name: '' };
    localStore.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  return profile;
}
const cleanName = value => typeof value === 'string' ? value.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 40) : '';

const actor = newId();
export const shareEvents = new EventTarget();
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const secret = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async bytes => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
let scripts = new Map(), pending = Promise.resolve(), persistTimer, initialised = false;
const cursors = new Map();
const CURSOR_INTERVAL_MS = 150;
let pointer = null, cursorScope = null, cursorTimer = null, lastCursorSent = 0;
const presenceChanged = () => shareEvents.dispatchEvent(new Event('presence'));

export function remoteCursors(animate = true) {
  const result = [];
  for (const [key, c] of cursors) {
    const s = shares.get(c.groupId), root = s && rootOf(s);
    if (!root || !s.enabled || Date.now() - c.time > 6000) { cursors.delete(key); continue; }
    let hue = 0;
    for (const char of c.actor) hue = (hue * 31 + char.charCodeAt(0)) % 360;
    const visual = smoothPointer(c, performance.now(), animate);
    result.push({ x: root.x + visual.x, y: root.y + visual.y, moving: visual.moving,
      color: `hsl(${hue} 85% 70%)`, label: 'Participant ' + c.actor.slice(0, 4).toUpperCase() });
  }
  return result;
}
function removeCursors(s, participant) {
  for (const [key, cursor] of cursors) if (cursor.groupId === s.groupId && (!participant || cursor.actor === participant)) cursors.delete(key);
  presenceChanged();
}
function sendCursor(force = false) {
  clearTimeout(cursorTimer);
  cursorTimer = null;
  const elapsed = performance.now() - lastCursorSent;
  if (!force && elapsed < CURSOR_INTERVAL_MS) {
    cursorTimer = setTimeout(() => sendCursor(), CURSOR_INTERVAL_MS - elapsed);
    return;
  }
  lastCursorSent = performance.now();
  const world = pointer && document.visibilityState === 'visible' ? screenToWorld(pointer.x, pointer.y) : null;
  let active = null;
  for (const s of shares.values()) {
    const root = rootOf(s);
    if (s.enabled && root && world && world.x >= root.x && world.x <= root.x + root.w && world.y >= root.y && world.y <= root.y + root.h) { active = s; break; }
  }
  if (cursorScope && cursorScope !== active) for (const c of cursorScope.channels) if (c.ready) send(c, { type: 'cursor', actor, x: null, y: null });
  cursorScope = active;
  if (active) {
    const root = rootOf(active);
    for (const c of active.channels) if (c.ready) send(c, { type: 'cursor', actor, x: world.x - root.x, y: world.y - root.y });
  }
}

export function loadShareScript(name) {
  if (!scripts.has(name)) scripts.set(name, new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/' + name, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => { scripts.delete(name); script.remove(); reject(new Error('Chargement du partage impossible.')); };
    document.head.append(script);
  }));
  return scripts.get(name);
}

function notify(s, text) {
  if (text !== undefined) s.status = text;
  shareEvents.dispatchEvent(new Event('change'));
}
function sendParticipants(s) {
  const participants = [actor, ...[...s.channels].filter(c => c.ready).map(c => c.participant).filter(Boolean)];
  for (const c of s.channels) if (c.ready) send(c, { type: 'participants', participants });
}
export function sharingSummary() {
  const active = [...shares.values()].filter(s => s.enabled);
  const participants = new Set();
  let groups = 0;
  for (const s of active) {
    const connections = [...s.channels].filter(c => c.ready && c.conn.open);
    if (s.role === 'host' && (s.peer?.open || connections.length)) {
      groups++; participants.add(actor);
      for (const c of connections) if (c.participant) participants.add(c.participant);
    } else if (s.role === 'guest' && connections.length) {
      groups++; participants.add(actor);
      for (const id of s.participants || []) participants.add(id);
    }
  }
  return { enabled: active.length > 0, groups, participants: participants.size };
}
function rootOf(s) { return state.nodes.find(n => n.kind === 'group' && (n.id === s.groupId || n.shareId === s.groupId)); }
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStore.setItem(KEY, JSON.stringify([...shares.values()].map(s => ({
        groupId: s.groupId, peerId: s.peerId, cap: s.cap, role: s.role, enabled: s.enabled,
        aliases: [...s.aliases], ignored: [...s.ignored], records: [...s.records.values()],
      }))));
    } catch { for (const s of shares.values()) notify(s, 'Stockage du partage plein : le lien risque de ne pas être conservé après fermeture.'); }
  }, 200);
}
function session(config) {
  return {
    ...config, approved: new Set(), aliases: new Map(config.aliases || []), ignored: new Map(config.ignored || []), records: new Map(), clock: 0,
    peer: null, channels: new Set(), hashes: new Map(), requested: new Map(),
    status: 'Partage désactivé.', nextTry: 0, starting: false, generation: 0, seeded: config.role === 'host',
  };
}
function remember(s, raw) {
  const r = cleanRecord(raw);
  if (!r || r.clock > s.clock + 1000000) return false;
  if (!mergeRecord(s.records, r)) return false;
  s.clock = Math.max(s.clock, r.clock);
  return true;
}
function overlap(s) {
  const root = rootOf(s);
  return root && [...shares.values()].some(other => other !== s && other.enabled && rootOf(other) && intersects(root, rootOf(other)));
}

export function shareInfo(group) {
  const s = shares.get(group.shareId || group.id);
  return s ? { enabled: s.enabled, role: s.role, status: s.status, peers: [...s.channels].filter(c => c.ready).length, url: shareUrl(s), groupId: s.groupId } : null;
}
export const isGroupShared = group => !!shares.get(group.shareId || group.id)?.enabled;
export function shareUrl(s) {
  const url = new URL(location.pathname, location.origin);
  url.hash = new URLSearchParams({ group: s.groupId, peer: s.peerId, access: s.cap }).toString();
  return url.href;
}
export function parseShareLink(value) {
  try {
    const url = new URL(value, location.href), p = new URLSearchParams(url.hash.slice(1));
    const config = { groupId: p.get('group'), peerId: p.get('peer'), cap: p.get('access') };
    return validId(config.groupId) && validId(config.peerId) && /^[a-f0-9]{64}$/.test(config.cap || '') ? config : null;
  } catch { return null; }
}
function makeShare(group) {
  const id = group.shareId || (validId(group.id) ? group.id : newId());
  let s = shares.get(id);
  if (!s) {
    s = session({ groupId: id, peerId: 'bete-' + secret().slice(0, 32), cap: secret(), role: 'host', enabled: false });
    shares.set(id, s);
  }
  group.shareId = id;
  emit(); persist();
  return s;
}
export function prepareShare(group) { makeShare(group); return shareInfo(group); }

export async function enableShare(group) {
  const s = makeShare(group);
  if ([...shares.values()].some(o => o !== s && o.enabled && rootOf(o) && intersects(group, rootOf(o)))) {
    throw new Error('Deux groupes partagés ne peuvent pas se chevaucher. Déplace-les ou désactive l’autre partage.');
  }
  s.enabled = true; s.nextTry = 0;
  try { await capture(s); persist(); await start(s); }
  catch (e) { s.enabled = false; stop(s); persist(); notify(s, e.message); throw e; }
}
export function disableShare(group) {
  const s = shares.get(group.shareId || group.id);
  if (!s) return;
  s.enabled = false; stop(s, true);
  notify(s, 'Partage désactivé. Les copies déjà reçues restent sur les autres appareils.');
  persist();
}
export async function regenerateShare(group) {
  const s = makeShare(group);
  if (s.role !== 'host') throw new Error('Seul l’appareil à l’origine du partage peut régénérer son lien.');
  const active = s.enabled;
  s.enabled = false;
  stop(s, true);
  s.enabled = active;
  s.peerId = 'bete-' + secret().slice(0, 32); s.cap = secret(); s.nextTry = 0;
  persist(); notify(s, 'Ancien lien révoqué.');
  if (active) await start(s);
}

export async function joinSharedGroup(config) {
  let s = shares.get(config.groupId);
  if (s?.role === 'host' && s.peerId === config.peerId) { focusGroup(s); return; }
  if (s?.role === 'host') throw new Error('Ce groupe est déjà partagé depuis cet appareil. Désactive son partage avant de rejoindre un autre lien.');
  if (!s || s.peerId !== config.peerId || s.cap !== config.cap) {
    if (s) {
      stop(s);
      Object.assign(s, config); // Keep aliases and offline revisions when only the link changes.
    } else {
      s = session({ ...config, role: 'guest', enabled: true });
      s.seeded = !!rootOf(s);
      shares.set(s.groupId, s);
    }
  }
  s.enabled = true; s.nextTry = 0;
  await capture(s);
  persist(); await start(s);
}

function stop(s, broadcast = false) {
  if (broadcast) s.approved.clear();
  s.generation++;
  s.requested.clear();
  removeCursors(s);
  if (broadcast && s.role === 'host') for (const c of s.channels) send(c, { type: 'stopped' });
  for (const c of s.channels) c.conn.close();
  s.channels.clear();
  if (s.peer) { const peer = s.peer; s.peer = null; peer.destroy(); }
  s.starting = false;
}

async function canonicalImage(s, ref) {
  if (!ref) return undefined;
  if (validImage(ref)) return ref;
  if (!s.hashes.has(ref)) s.hashes.set(ref, (async () => {
    const blob = await imageBlob(ref);
    if (!blob) throw new Error('Une image du groupe manque sur cet appareil.');
    if (blob.size > MAX_IMAGE) throw new Error('Une image dépasse 10 Mo : réduis-la avant de partager ce groupe.');
    if (blob.type && !/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(blob.type)) throw new Error('Pour le partage, convertis cette image en PNG, JPEG, WebP, GIF, AVIF ou BMP.');
    const hash = await digest(await blob.arrayBuffer());
    return storeSharedImage(hash, blob);
  })().catch(e => { s.hashes.delete(ref); throw e; }));
  return s.hashes.get(ref);
}

async function capture(s) {
  const root = rootOf(s);
  if (!root) return;
  if (overlap(s)) { notify(s, 'Synchronisation suspendue : deux groupes partagés se chevauchent.'); return; }
  const nodes = [root, ...groupMembers(state.nodes, root).filter(n => !s.ignored.has(n.id))];
  if (nodes.length > MAX_MEMBERS) throw new Error('Un groupe partagé est limité à 1 000 blocs.');
  if (s.records.size >= MAX_RECORDS - MAX_MEMBERS) throw new Error('Historique de synchronisation plein. Désactive le partage et recrée un groupe pour repartir.');
  const localToWire = new Map([...s.aliases].map(([wire, local]) => [local, wire]));
  const values = new Map();
  for (const n of nodes) {
    const id = n === root ? ROOT : localToWire.get(n.id) || (validId(n.id) ? n.id : newId());
    if (id !== ROOT) s.aliases.set(id, n.id);
    const image = await canonicalImage(s, n.image);
    values.set(id, cleanValue({ ...n, x: n.x - root.x, y: n.y - root.y, image }, id === ROOT));
  }
  const changed = [];
  for (const [id, value] of values) {
    const old = s.records.get(id);
    if (old && !old.deleted && JSON.stringify(old.value) === JSON.stringify(value)) continue;
    const r = { id, value, clock: ++s.clock, actor };
    s.records.set(id, r); changed.push(r);
  }
  for (const [id, old] of s.records) if (id !== ROOT && !old.deleted && !values.has(id)) {
    const r = { id, deleted: true, clock: ++s.clock, actor };
    s.records.set(id, r); changed.push(r);
    // A block moved outside stays local and is no longer an alias of the shared block.
    const local = getNode(s.aliases.get(id));
    if (local) s.aliases.delete(id);
  }
  if (changed.length) { persist(); broadcastRecords(s, changed); }
}

function apply(s, focus = false) {
  const rootRecord = s.records.get(ROOT);
  if (!rootRecord?.value) return;
  let root = rootOf(s);
  // Remote resizing must never turn adjacent private blocks into shared content.
  const known = new Set(s.aliases.values());
  for (const n of state.nodes) if (n !== root && !known.has(n.id) && !s.ignored.has(n.id)) {
    s.ignored.set(n.id, JSON.stringify([n.x, n.y, n.w, n.h]));
  }
  if (!root) {
    const values = [...s.records.values()].filter(r => !r.deleted).map(r => r.value);
    const position = emptyPlacement(state.nodes, values, { x: state.camera.x, y: state.camera.y });
    const id = getNode(s.groupId) ? newId() : s.groupId;
    root = { ...rootRecord.value, id, ...position, shareId: s.groupId };
    state.nodes.push(root);
    focus = true;
  }
  const x = root.x, y = root.y;
  Object.assign(root, sanitizeNode({ ...rootRecord.value, id: root.id, x, y, shareId: s.groupId }));
  const protectedIds = new Set([...shares.values()].filter(o => o !== s).map(rootOf).filter(Boolean).map(n => n.id));
  for (const r of s.records.values()) {
    if (r.id === ROOT) continue;
    let localId = s.aliases.get(r.id);
    let node = localId ? getNode(localId) : null;
    if (protectedIds.has(localId)) continue;
    if (r.deleted) {
      if (node) state.nodes = state.nodes.filter(n => n.id !== localId);
      continue;
    }
    if (!node) {
      if (state.nodes.length >= 5000) throw new Error('Le tableau contient déjà 5 000 blocs.');
      localId = getNode(r.id) ? newId() : r.id;
      s.aliases.set(r.id, localId);
      node = {}; state.nodes.push(node);
    }
    // Replace fields instead of assigning: clearing an image/link must propagate too.
    const value = sanitizeNode({ ...r.value, id: localId, x: x + r.value.x, y: y + r.value.y });
    for (const key of Object.keys(node)) delete node[key];
    Object.assign(node, value);
  }
  emit(); persist();
  if (focus) focusGroup(s);
}
function focusGroup(s) {
  const root = rootOf(s);
  if (!root) return;
  select(root.id);
  const z = Math.min(1.5, Math.max(0.05, Math.min(view.w * 0.7 / root.w, view.h * 0.7 / root.h)));
  flyTo(root.x + root.w / 2, root.y + root.h / 2, z);
}

function send(c, packet) {
  if (!c.conn.open) return;
  // Presence is disposable: never let stale positions build up behind file transfers.
  if (packet.type === 'cursor' && (c.conn.bufferSize > 0 || c.conn.dataChannel?.bufferedAmount > 16384)) return;
  if (c.conn.bufferSize > 256) { c.conn.close(); return; }
  try { c.conn.send(packet); } catch { c.conn.close(); }
}
function sendRecords(c, records) {
  for (let i = 0; i < records.length; i += 4) send(c, { type: 'records', records: records.slice(i, i + 4) });
}
function broadcastRecords(s, records, except) {
  for (const c of s.channels) if (c.ready && c !== except) sendRecords(c, records);
}
function queue(task, s) {
  pending = pending.then(task).catch(e => { if (s) notify(s, e.message || 'Synchronisation impossible.'); });
  return pending;
}
async function proof(s, c, kind, challenge, nonce) {
  // Bind authentication to this DTLS channel, not just the rendezvous identifier.
  // A signalling service substituting WebRTC fingerprints cannot relay these proofs.
  const pc = c.conn.peerConnection;
  const parts = [pc?.localDescription?.sdp, pc?.remoteDescription?.sdp]
    .map(sdp => [...(sdp || '').matchAll(/^a=fingerprint:(.+)$/gm)].map(m => m[1].trim()).sort().join(','));
  if (parts.some(p => !p)) throw new Error('Authentification du canal WebRTC impossible.');
  const fingerprints = parts.sort().join('|');
  const bytes = Uint8Array.from(s.cap.match(/../g), x => parseInt(x, 16));
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode([kind, s.groupId, challenge, nonce, fingerprints].join(':')))));
}
function equalProof(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

async function start(s) {
  if (!s.enabled || s.starting || s.peer || Date.now() < s.nextTry) return;
  s.starting = true;
  const generation = s.generation;
  notify(s, 'Connexion au serveur de liaison…');
  try {
    await loadShareScript('peerjs.min.js');
    if (!s.enabled || s.generation !== generation) return;
    const peer = new window.Peer(s.role === 'host' ? s.peerId : undefined, peerConfig);
    s.peer = peer;
    peer.on('open', () => {
      if (s.peer !== peer) return;
      s.starting = false;
      notify(s, s.role === 'host' ? 'Partage actif. En attente de participants.' : 'Recherche de l’appareil qui partage…');
      if (s.role === 'guest') attach(s, peer.connect(s.peerId, { reliable: true, serialization: 'binary', label: 'bete-group-v1' }), false);
    });
    peer.on('connection', conn => {
      if (s.role !== 'host' || s.channels.size >= MAX_PEERS || conn.label !== 'bete-group-v1') { conn.close(); return; }
      attach(s, conn, true);
    });
    peer.on('call', call => call.close());
    peer.on('disconnected', () => {
      if (s.peer !== peer || !s.enabled) return;
      notify(s, 'Serveur de liaison déconnecté. Reconnexion automatique…');
      setTimeout(() => { if (s.peer === peer && !peer.destroyed && peer.disconnected && s.enabled) { try { peer.reconnect(); } catch { stop(s); } } }, 5000);
    });
    peer.on('error', error => {
      if (s.peer !== peer) return;
      if (['network', 'socket-error', 'server-error'].includes(error.type) && [...s.channels].some(c => c.ready)) {
        notify(s, 'Liaison indisponible ; les connexions directes existantes restent actives.');
        return;
      }
      notify(s, error.type === 'unavailable-id' ? 'Ce partage est déjà actif dans un autre onglet ou appareil.'
        : error.type === 'peer-unavailable' ? 'Appareil source absent. Copie locale conservée ; nouvel essai dans 15 secondes.'
          : 'Connexion directe impossible ou serveur indisponible. Nouvel essai dans 15 secondes.');
      s.nextTry = Date.now() + (error.type === 'unavailable-id' ? 60000 : 15000);
      stop(s);
    });
    setTimeout(() => {
      if (s.peer === peer && s.starting) { stop(s); s.nextTry = Date.now() + 15000; notify(s, 'Serveur de liaison injoignable. Nouvel essai automatique.'); }
    }, 20000);
  } catch (e) { s.nextTry = Date.now() + 15000; notify(s, e.message); }
  finally { if (!s.peer && s.generation === generation) s.starting = false; }
}

async function approval(s, c, name) {
  const dialog = document.createElement('dialog');
  dialog.className = 'share-approval';
  const form = document.createElement('form');
  form.method = 'dialog';
  const label = document.createElement('p');
  label.textContent = name + ' souhaite rejoindre le groupe « ' + (rootOf(s)?.text || 'Groupe') + ' ».';
  form.append(label);
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  form.append(actions);
  for (const [value, text] of [['refuse', 'Refuser'], ['accept', 'Accepter']]) {
    const button = document.createElement('button');
    button.value = value;
    button.textContent = text;
    actions.append(button);
  }
  dialog.append(form);
  document.body.append(dialog);
  return new Promise(resolve => {
    c.cancelApproval = () => dialog.close();
    dialog.addEventListener('close', () => {
      c.cancelApproval = null;
      dialog.remove();
      resolve(dialog.returnValue === 'accept');
    }, { once: true });
    dialog.showModal();
  });
}

function attach(s, conn, host) {
  if (!conn) return;
  const c = { conn, host, ready: false, seeded: host, incoming: null, lastSeen: Date.now(), challenge: secret(), nonce: null, imageQueue: Promise.resolve(), wantedImages: new Set(), queued: 0, handshakes: 0 };
  s.channels.add(c);
  c.timeout = setTimeout(() => { if (!c.ready) { notify(s, 'Connexion directe impossible : réseau incompatible ou lien invalide.'); conn.close(); } }, 20000);
  conn.on('open', () => { if (!host) send(c, { type: 'hello', v: 1, group: s.groupId, actor, challenge: c.challenge }); });
  conn.on('data', packet => {
    if (++c.queued > 2048) { conn.close(); return; }
    c.lastSeen = Date.now();
    queue(async () => { try { await receive(s, c, packet); } finally { c.queued--; } }, s);
  });
  const closed = () => {
    clearTimeout(c.timeout);
    c.cancelApproval?.();
    if (!s.channels.delete(c)) return;
    if (host) sendParticipants(s);
    else s.participants = [];
    if (host && c.cursorActor) {
      removeCursors(s, c.cursorActor);
      for (const other of s.channels) if (other.ready) send(other, { type: 'cursor', actor: c.cursorActor, x: null, y: null });
    } else if (!host) removeCursors(s);
    if (s.enabled) {
      notify(s, s.role === 'host' ? 'Partage actif. ' + [...s.channels].filter(c => c.ready).length + ' participant(s).' : 'Connexion perdue. Copie locale conservée ; reconnexion automatique.');
      if (!host) { stop(s); s.nextTry = Date.now() + 5000; }
    }
  };
  conn.on('close', closed); conn.on('error', () => { conn.close(); closed(); });
}

async function receive(s, c, p) {
  if (!s.enabled || !p || typeof p !== 'object' || !s.channels.has(c)) return;
  if (!c.ready) {
    if (++c.handshakes > 6) { c.conn.close(); return; }
    if (p.type === 'hello' && c.host && p.v === 1 && p.group === s.groupId && /^[a-f0-9]{64}$/.test(p.challenge || '')) {
      c.participant = validId(p.actor) ? p.actor : c.conn.peer;
      c.challenge = p.challenge; c.nonce = secret();
      send(c, { type: 'challenge', nonce: c.nonce, proof: await proof(s, c, 'host', c.challenge, c.nonce) });
    } else if (p.type === 'challenge' && !c.host && /^[a-f0-9]{64}$/.test(p.nonce || '')) {
      c.nonce = p.nonce;
      if (!equalProof(p.proof, await proof(s, c, 'host', c.challenge, c.nonce))) {
        s.enabled = false; stop(s); persist();
        notify(s, 'Lien invalide ou révoqué : ce canal ne correspond pas au partage attendu.');
        return;
      }
      const profile = shareProfile();
      send(c, { type: 'authenticate', device: await digest(new TextEncoder().encode(profile.device + ':' + s.groupId + ':' + s.peerId + ':' + s.cap)), name: cleanName(profile.name) || profile.fallback, proof: await proof(s, c, 'guest', c.challenge, c.nonce) });
    } else if (p.type === 'authenticate' && c.host && c.nonce) {
      if (!equalProof(p.proof, await proof(s, c, 'guest', c.challenge, c.nonce))) { c.conn.close(); return; }
      if (c.authenticated || !/^[a-f0-9]{64}$/.test(p.device || '')) { c.conn.close(); return; }
      c.authenticated = true;
      clearTimeout(c.timeout);
      const name = cleanName(p.name) || 'Invité';
      const finish = async accepted => {
        if (!s.enabled || !s.channels.has(c) || !c.conn.open) return;
        if (!accepted) {
          send(c, { type: 'refused' });
          c.timeout = setTimeout(() => c.conn.close(), 1000);
          return;
        }
        s.approved.add(p.device);
        await capture(s);
        if (!s.enabled || !s.channels.has(c) || !c.conn.open) return;
        clearTimeout(c.timeout);
        c.lastSeen = Date.now();
        c.ready = true;
        send(c, { type: 'ready' });
        sendParticipants(s);
        sendRecords(c, [...s.records.values()]);
        send(c, { type: 'seed-end' });
        notify(s, name + ' a rejoint le groupe.');
      };
      if (s.approved.has(p.device)) await finish(true);
      else {
        c.timeout = setTimeout(() => c.conn.close(), 120000);
        send(c, { type: 'waiting' });
        approval(s, c, name).then(accepted => queue(() => finish(accepted), s));
      }
    } else if (p.type === 'waiting' && !c.host && c.nonce) {
      clearTimeout(c.timeout);
      c.timeout = setTimeout(() => c.conn.close(), 125000);
      notify(s, 'En attente de validation par l’hôte.');
    } else if (p.type === 'refused' && !c.host && c.nonce) {
      s.enabled = false; stop(s); persist();
      notify(s, 'L’hôte a refusé la demande.');
    } else if (p.type === 'ready' && !c.host && c.nonce) { clearTimeout(c.timeout); c.ready = true; }
    else c.conn.close();
    return;
  }
  if (p.type === 'ping') { send(c, { type: 'pong' }); return; }
  if (p.type === 'pong') return;
  if (p.type === 'participants' && !c.host && Array.isArray(p.participants) && p.participants.length <= MAX_PEERS + 1 && p.participants.every(validId)) {
    s.participants = [...new Set(p.participants)];
    notify(s);
    return;
  }
  if (p.type === 'cursor') {
    if (!validId(p.actor) || p.actor === actor) return;
    if (c.host) {
      if (c.cursorActor && c.cursorActor !== p.actor) return;
      c.cursorActor = p.actor;
    }
    const root = rootOf(s);
    if (!root) return;
    const hidden = p.x === null && p.y === null;
    if (!hidden && (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > root.w || p.y > root.h)) return;
    const key = s.groupId + ':' + p.actor;
    if (hidden) cursors.delete(key);
    else if (cursors.has(key) || cursors.size < 240) {
      const cursor = cursors.get(key) || { actor: p.actor, groupId: s.groupId };
      Object.assign(cursor, { x: p.x, y: p.y, time: Date.now() });
      cursors.set(key, cursor);
    }
    if (c.host) for (const other of s.channels) if (other !== c && other.ready) send(other, { type: 'cursor', actor: p.actor, x: p.x, y: p.y });
    presenceChanged();
    return;
  }
  if (p.type === 'stopped' && !c.host) {
    s.enabled = false; stop(s); persist();
    notify(s, 'Le partage a été désactivé ou son lien régénéré. Ta copie locale reste disponible.');
    return;
  }
  if (p.type === 'records') {
    if (!Array.isArray(p.records) || p.records.length > 4 || JSON.stringify(p).length > 200000) { c.conn.close(); return; }
    if (c.seeded) await capture(s); // Preserve local edits made before this remote packet arrived.
    const changed = [];
    for (const r of p.records) {
      if (r && !r.deleted && (!s.records.has(r.id) || s.records.get(r.id).deleted)
        && [...s.records.values()].filter(r => !r.deleted).length >= MAX_MEMBERS) continue;
      if (remember(s, r)) changed.push(s.records.get(r.id));
    }
    if (changed.length) {
      if (c.seeded) apply(s);
      persist();
      if (c.host) broadcastRecords(s, changed, c);
    }
    if (c.seeded) await requestImages(s, c);
  } else if (p.type === 'seed-end' && !c.host) {
    c.seeded = true; s.seeded = true;
    apply(s, true);
    sendRecords(c, [...s.records.values()]);
    await requestImages(s, c);
    notify(s, 'Groupe connecté. Les modifications sont partagées dans les deux sens.');
  } else if (p.type === 'image-request' && /^[a-f0-9]{64}$/.test(p.hash || '')) {
    if (![...s.records.values()].some(r => !r.deleted && r.value.image === 'idb:shared-' + p.hash)) return;
    if (c.wantedImages.has(p.hash)) return;
    c.wantedImages.add(p.hash);
    // One transfer at a time per channel; bound the browser's queued bytes.
    c.imageQueue = c.imageQueue.then(async () => { if (await sendImage(c, p.hash)) c.wantedImages.delete(p.hash); }).catch(() => c.conn.close());
  } else if (p.type === 'image-start' && /^[a-f0-9]{64}$/.test(p.hash || '') && s.requested.has(p.hash)) {
    if (!Number.isInteger(p.size) || p.size < 1 || p.size > MAX_IMAGE || c.incoming || typeof p.mime !== 'string' || !/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(p.mime)) return;
    c.incoming = { hash: p.hash, size: p.size, mime: p.mime, parts: [], received: 0 };
  } else if (p.type === 'image-chunk' && c.incoming) {
    // PeerJS returns typed-array views after reassembling its own fragmented messages.
    // Copy only the view's bytes, never unrelated bytes from its backing buffer.
    const data = imageChunkBytes(p.data);
    if (!data || c.incoming.received + data.byteLength > c.incoming.size) { c.conn.close(); return; }
    c.incoming.parts.push(data); c.incoming.received += data.byteLength;
  } else if (p.type === 'image-end' && c.incoming) {
    const image = c.incoming; c.incoming = null;
    if (image.received !== image.size) return;
    const blob = new Blob(image.parts, { type: image.mime });
    if (await digest(await blob.arrayBuffer()) !== image.hash) { c.conn.close(); return; }
    await storeSharedImage(image.hash, blob); s.requested.delete(image.hash); emit();
    for (const other of s.channels) if (other !== c && other.ready && other.wantedImages.has(image.hash)) {
      other.imageQueue = other.imageQueue.then(async () => { if (await sendImage(other, image.hash)) other.wantedImages.delete(image.hash); }).catch(() => other.conn.close());
    }
  }
}

async function sendImage(c, hash) {
  const blob = await imageBlob('idb:shared-' + hash);
  if (!blob || blob.size > MAX_IMAGE || !c.conn.open) return;
  send(c, { type: 'image-start', hash, size: blob.size, mime: blob.type || 'image/png' });
  for (let i = 0; i < blob.size; i += CHUNK) {
    while (c.conn.open && (c.conn.bufferSize > 8 || c.conn.dataChannel?.bufferedAmount > 512000)) await new Promise(resolve => setTimeout(resolve, 20));
    if (!c.conn.open) return;
    send(c, { type: 'image-chunk', data: await blob.slice(i, i + CHUNK).arrayBuffer() });
  }
  send(c, { type: 'image-end' });
  return true;
}
async function requestImages(s, c) {
  for (const r of s.records.values()) {
    const ref = !r.deleted && r.value.image;
    if (!validImage(ref)) continue;
    const hash = ref.slice('idb:shared-'.length);
    if (Date.now() - (s.requested.get(hash) || 0) < 30000 || await imageBlob(ref)) continue;
    s.requested.set(hash, Date.now()); send(c, { type: 'image-request', hash });
  }
}

export function initGroupSharing() {
  if (initialised) return;
  initialised = true;
  const name = document.getElementById('share-name');
  const profile = shareProfile();
  name.value = profile.name;
  name.placeholder = profile.fallback;
  name.addEventListener('input', () => {
    profile.name = name.value;
    localStore.setItem(PROFILE_KEY, JSON.stringify(profile));
  });
  const canvas = document.getElementById('canvas');
  canvas.addEventListener('pointermove', event => {
    pointer = { x: event.clientX, y: event.clientY };
    if (!cursorTimer) sendCursor();
  });
  const hideCursor = () => { pointer = null; clearTimeout(cursorTimer); sendCursor(true); };
  canvas.addEventListener('pointerleave', hideCursor);
  canvas.addEventListener('pointerup', event => { if (event.pointerType === 'touch') hideCursor(); });
  canvas.addEventListener('pointercancel', hideCursor);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') hideCursor(); });
  setInterval(() => {
    const before = cursors.size;
    remoteCursors();
    if (before !== cursors.size) presenceChanged();
    if (pointer) sendCursor();
  }, 2000);
  setGroupMemberFilter((group, node) => {
    const s = shares.get(group.shareId || group.id);
    return !s?.enabled || !s.ignored.has(node.id);
  });
  document.addEventListener('bete-node-moved', event => {
    const node = getNode(event.detail);
    if (!node) return;
    for (const s of shares.values()) {
      const root = rootOf(s);
      if (s.enabled && root && groupMembers([node], root).includes(node)) s.ignored.delete(node.id);
    }
  });
  try {
    const saved = JSON.parse(localStore.getItem(KEY) || '[]');
    for (const item of (Array.isArray(saved) ? saved.slice(0, 5000) : [])) {
      if (!validId(item.groupId) || !validId(item.peerId) || !/^[a-f0-9]{64}$/.test(item.cap || '') || !['host', 'guest'].includes(item.role)) continue;
      const aliases = Array.isArray(item.aliases) ? item.aliases.filter(a => Array.isArray(a) && validId(a[0]) && validId(a[1])).slice(0, MAX_MEMBERS) : [];
      const ignored = Array.isArray(item.ignored) ? item.ignored.filter(a => Array.isArray(a) && validId(a[0]) && typeof a[1] === 'string' && a[1].length < 200).slice(0, 5000) : [];
      const s = session({ ...item, enabled: item.enabled === true, aliases, ignored });
      // Persisted clocks are trusted only after bounded validation, never executable data.
      for (const raw of (Array.isArray(item.records) ? item.records.slice(0, MAX_RECORDS) : [])) {
        const r = cleanRecord(raw);
        if (r && mergeRecord(s.records, r)) s.clock = Math.max(s.clock, r.clock);
      }
      s.seeded = s.role === 'host' || !!rootOf(s);
      shares.set(s.groupId, s);
    }
  } catch { /* Corrupt storage must never prevent the local board from opening. */ }
  events.addEventListener('change', () => {
    // Deleting/replacing a local group must stop its session before a delayed remote packet
    // can recreate it. A not-yet-received invitation deliberately has no local root yet.
    for (const s of shares.values()) if (s.enabled && s.seeded && !rootOf(s)) disableShare({ id: s.groupId });
  });
  onSaved(() => queue(async () => {
    for (const s of shares.values()) {
      if (!s.enabled) continue;
      if (!rootOf(s) && s.seeded) { disableShare({ id: s.groupId }); continue; }
      try { await capture(s); } catch (e) { notify(s, e.message); }
    }
  }));
  setInterval(() => {
    for (const s of shares.values()) {
      if (!s.enabled) continue;
      if (!s.peer && (rootOf(s) || s.role === 'guest')) queue(() => start(s), s);
      for (const c of s.channels) {
        if (c.ready && Date.now() - c.lastSeen > 20000) c.conn.close();
        else if (c.ready) { send(c, { type: 'ping' }); queue(() => requestImages(s, c), s); }
      }
    }
  }, 5000);
  for (const s of shares.values()) if (s.enabled && rootOf(s)) queue(async () => { await capture(s); await start(s); }, s);
}
