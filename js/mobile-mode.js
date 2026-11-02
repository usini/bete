// Local interaction lock only: remote updates, navigation and exports remain available.
// Desktop windows are not classified as mobile just because they are narrow.
export const isMobile = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
let locked = isMobile;
export const modeEvents = new EventTarget();
export const isLocked = () => locked;

export function setLocked(value) {
  if (!isMobile) return;
  locked = !!value;
  modeEvents.dispatchEvent(new Event('change'));
}

export function initMobileMode() {
  const button = document.getElementById('mobile-lock');
  const label = document.getElementById('mobile-lock-label');
  const update = () => {
    button.hidden = !isMobile;
    label.textContent = locked ? 'Déverrouiller' : 'Verrouiller';
    button.setAttribute('aria-pressed', String(!locked));
    button.title = locked ? 'Lecture seule : autoriser les modifications' : 'Revenir en lecture seule';
    document.body.classList.toggle('mobile-locked', locked);
    document.getElementById('mobile-lock-indicator').hidden = !locked;
  };
  button.addEventListener('click', () => setLocked(!locked));
  modeEvents.addEventListener('change', update);
  update();
}
