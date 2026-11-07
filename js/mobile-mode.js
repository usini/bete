import { externalMode } from './external-board.js?v=mw62q2s5';
// Local interaction lock only: remote updates, navigation and exports remain available.
// Desktop windows are not classified as mobile just because they are narrow.
export const isMobile = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
let locked = isMobile || externalMode;
export const modeEvents = new EventTarget();
export const isLocked = () => locked;

export function setLocked(value) {
  if (externalMode) return;
  locked = !!value;
  modeEvents.dispatchEvent(new Event('change'));
}

export function initMobileMode() {
  const button = document.getElementById('mobile-lock');
  const label = document.getElementById('mobile-lock-label');
  const update = () => {
    button.hidden = externalMode;
    label.textContent = locked ? 'Déverrouiller' : 'Verrouiller';
    button.setAttribute('aria-pressed', String(!locked));
    button.title = locked ? 'Déverrouiller le tableau (V)' : 'Verrouiller le tableau (V)';
    document.body.classList.toggle('mobile-locked', locked);
    document.getElementById('mobile-lock-indicator').hidden = !locked;
  };
  button.addEventListener('click', () => setLocked(!locked));
  modeEvents.addEventListener('change', update);
  update();
}
