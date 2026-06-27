// Panneau debug (touche ²) : réglage à chaud des paramètres de wobble.
// Non persisté — sert juste à tester des valeurs. Recharger réinitialise.
import { wobbleCfg, WOBBLE_DEFAULTS } from './physics.js?v=mqwtueyh';

let panel = null;

const FIELDS = [
  { key: 'stiffness', label: 'Raideur (ressort)', min: 20, max: 400, step: 1 },
  { key: 'damping', label: 'Amortissement', min: 1, max: 40, step: 0.5 },
  { key: 'maxStretch', label: 'Déformation max', min: 0, max: 0.4, step: 0.01 },
  { key: 'stretchK', label: 'Sensibilité vitesse', min: 0, max: 0.004, step: 0.0001 },
];

function row(f) {
  const wrap = document.createElement('div');
  wrap.className = 'dbg-row';
  const lab = document.createElement('label');
  lab.textContent = f.label;
  const val = document.createElement('span');
  val.className = 'dbg-val';
  const inp = document.createElement('input');
  inp.type = 'range';
  inp.min = f.min; inp.max = f.max; inp.step = f.step;
  inp.value = wobbleCfg[f.key];
  const show = () => { val.textContent = String(wobbleCfg[f.key]); };
  show();
  inp.addEventListener('input', () => { wobbleCfg[f.key] = parseFloat(inp.value); show(); });
  inp._sync = () => { inp.value = wobbleCfg[f.key]; show(); };
  wrap.appendChild(lab);
  wrap.appendChild(inp);
  wrap.appendChild(val);
  return wrap;
}

function build() {
  panel = document.createElement('div');
  panel.id = 'debug';
  const head = document.createElement('div');
  head.className = 'dbg-head';
  head.textContent = 'DEBUG · WOBBLE (²)';
  panel.appendChild(head);
  const rows = FIELDS.map(row);
  rows.forEach((r) => panel.appendChild(r));
  const reset = document.createElement('button');
  reset.className = 'dbg-reset';
  reset.textContent = 'Réinitialiser';
  reset.addEventListener('click', () => {
    Object.assign(wobbleCfg, WOBBLE_DEFAULTS);
    rows.forEach((r) => r.querySelector('input')._sync());
  });
  panel.appendChild(reset);
  // Empêche les clics de tomber sur le canvas.
  panel.addEventListener('mousedown', (e) => e.stopPropagation());
  panel.addEventListener('touchstart', (e) => e.stopPropagation());
  document.body.appendChild(panel);
}

export function toggleDebug() {
  if (!panel) build();
  panel.classList.toggle('show');
}
