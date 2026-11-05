import { cleanGitHubData } from './github-repo.js?v=mw3kyoh5';
// Shared groups use relative geometry and a bounded last-writer-wins register per block.
// Lamport clocks avoid depending on the devices' wall clocks. Tombstones survive reconnection.
export const MAX_MEMBERS = 1000;
export const MAX_RECORDS = 4000;
export const ROOT = 'root';
export const validId = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(v);
export const validImage = v => typeof v === 'string' && /^idb:shared-[a-f0-9]{64}$/.test(v);
// Accept old 32 KiB chunks and typed views produced by PeerJS's message reassembly.
export function imageChunkBytes(value) {
  if (value instanceof ArrayBuffer) return value.byteLength <= 32768 ? value : null;
  if (!ArrayBuffer.isView(value) || value.byteLength > 32768) return null;
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer;
}
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;

export function cleanValue(raw, root = false) {
  if (!raw || typeof raw !== 'object') return null;
  const n = {
    kind: root ? 'group' : ['rect', 'group', 'image'].includes(raw.kind) ? raw.kind : 'rect',
    x: root ? 0 : clamp(raw.x, -1e6, 1e6, 0),
    y: root ? 0 : clamp(raw.y, -1e6, 1e6, 0),
    w: clamp(raw.w, 20, 1e5, 180), h: clamp(raw.h, 20, 1e5, 110),
    text: typeof raw.text === 'string' ? raw.text.slice(0, 20000) : '',
    color: raw.color === 'transparent' ? 'transparent' : /^#[a-f0-9]{6}$/i.test(raw.color) ? raw.color.toLowerCase() : '#00b7eb',
  };
  if (validImage(raw.image)) n.image = raw.image;
  if (n.kind !== 'group' && raw.hideLinkLabel === true) n.hideLinkLabel = true;
  if (typeof raw.link === 'string' && /^https?:\/\//i.test(raw.link) && raw.link.length <= 2000) n.link = raw.link;
  for (const k of ['name', 'price', 'delivery']) if (typeof raw[k] === 'string' && raw[k].trim()) n[k] = raw[k].trim().slice(0, 100);
  if (n.kind === 'rect' && raw.github) {
    const github = cleanGitHubData(raw.github, n.link || n.text);
    if (github) n.github = github;
  }
  return n;
}

export function cleanRecord(raw) {
  if (!raw || (raw.id !== ROOT && !validId(raw.id)) || !validId(raw.actor)
    || !Number.isSafeInteger(raw.clock) || raw.clock < 1 || raw.clock > 1e12) return null;
  if (raw.deleted === true) return raw.id === ROOT ? null : { id: raw.id, actor: raw.actor, clock: raw.clock, deleted: true };
  const value = cleanValue(raw.value, raw.id === ROOT);
  return value ? { id: raw.id, actor: raw.actor, clock: raw.clock, value } : null;
}

export function mergeRecord(records, raw) {
  const next = cleanRecord(raw);
  if (!next) return false;
  const old = records.get(next.id);
  if (old && (old.clock > next.clock || (old.clock === next.clock && old.actor >= next.actor))) return false;
  if (!old && records.size >= MAX_RECORDS) return false;
  records.set(next.id, next);
  return true;
}

export function intersects(a, b, gap = 0) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

export function groupMembers(nodes, group) {
  return nodes.filter(n => n !== group && !(n.kind === 'group' && n.w * n.h >= group.w * group.h)
    && n.x + n.w / 2 >= group.x && n.x + n.w / 2 <= group.x + group.w
    && n.y + n.h / 2 >= group.y && n.y + n.h / 2 <= group.y + group.h);
}

// Reserve the complete shared content footprint, including blocks crossing the group's border.
export function emptyPlacement(nodes, values, origin = { x: 0, y: 0 }) {
  const live = values.filter(Boolean);
  const minX = Math.min(0, ...live.map(v => v.x)), minY = Math.min(0, ...live.map(v => v.y));
  const w = Math.max(20, ...live.map(v => v.x + v.w)) - minX;
  const h = Math.max(20, ...live.map(v => v.y + v.h)) - minY;
  const xs = [origin.x, 0, Math.max(0, ...nodes.map(n => n.x + n.w)) + 80,
    Math.min(0, ...nodes.map(n => n.x)) - w - 80, ...nodes.map(n => n.x + n.w + 80)];
  const ys = [origin.y, 0, Math.max(0, ...nodes.map(n => n.y + n.h)) + 80,
    Math.min(0, ...nodes.map(n => n.y)) - h - 80, ...nodes.map(n => n.y + n.h + 80)];
  let attempts = 0;
  for (const y of ys) for (const x of xs) {
    if (++attempts > 20000) throw new Error('Aucun emplacement libre trouvé pour ce groupe.');
    const candidate = { x, y, w, h };
    if (Math.abs(x) + w > 1e6 || Math.abs(y) + h > 1e6) continue;
    if (nodes.every(n => !intersects(candidate, n, 40))) return { x: x - minX, y: y - minY };
  }
  throw new Error('Aucun emplacement libre trouvé pour ce groupe.');
}
