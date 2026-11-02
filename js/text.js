// Text layout for blocks: the text is centred in the block, and its font size is the
// largest one that still fits (short texts become big, long texts shrink).
// Shared by the canvas renderer and the inline editor so both show the same layout.
export const FONT_FAMILY = 'system-ui, "Segoe UI", Roboto, sans-serif';
export const LINE = 1.25;    // line height, in font sizes
export const TEXT_PAD = 10;  // inner margin, in world units
const MIN_SIZE = 6, MAX_SIZE = 400;

const measurer = document.createElement('canvas').getContext('2d');
const setFont = (size) => { measurer.font = size + 'px ' + FONT_FAMILY; };

// Word-wrap at the current measurer font (caller sets it first).
function wrapWithFont(text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const cand = line ? line + ' ' + word : word;
      if (!line || measurer.measureText(cand).width <= maxW) line = cand;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

function computeFit(text, maxW, maxH) {
  const tryFit = (size) => {
    setFont(size);
    const lines = wrapWithFont(text, maxW);
    const widest = Math.max(...lines.map((l) => measurer.measureText(l).width));
    return widest <= maxW && lines.length * size * LINE <= maxH ? { size, lines } : null;
  };
  // Binary search on the font size (world units).
  let lo = MIN_SIZE, hi = MAX_SIZE, best = null;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    const r = tryFit(mid);
    if (r) { best = r; lo = mid; } else hi = mid;
  }
  if (!best) {
    // Nothing fits even at the minimum size (e.g. a single very long word): best effort.
    setFont(MIN_SIZE);
    best = { size: MIN_SIZE, lines: wrapWithFont(text, maxW) };
  }
  return best;
}

// Largest font size (world units) at which `text` fits on ONE line in a maxW x maxH box.
// A line's width grows linearly with the font size, so one measurement is enough.
export function fitLine(text, maxW, maxH) {
  setFont(100);
  const w100 = measurer.measureText(text).width || 1;
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, maxH, (100 * Math.max(1, maxW)) / w100));
}

const cache = new Map();

// Largest size (world units) whose wrapped lines fit in a w x h box: { size, lines }.
export function fitText(text, w, h) {
  const maxW = Math.max(1, w), maxH = Math.max(1, h);
  const key = text + '\u0000' + Math.round(maxW) + '\u0000' + Math.round(maxH);
  let r = cache.get(key);
  if (!r) {
    r = computeFit(text, maxW, maxH);
    if (cache.size > 500) cache.clear();
    cache.set(key, r);
  }
  return r;
}
