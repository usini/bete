// Identité de l'utilisateur (locale au navigateur) : un id stable + un nom choisi.
const UID = 'bete:uid';
const UNAME = 'bete:username';

export function getUserId() {
  try {
    let i = localStorage.getItem(UID);
    if (!i) { i = 'u-' + Math.random().toString(36).slice(2, 8); localStorage.setItem(UID, i); }
    return i;
  } catch (e) { return 'u-anon'; }
}

export function getUserName() {
  try { return localStorage.getItem(UNAME) || ''; } catch (e) { return ''; }
}

export function setUserName(n) {
  try { localStorage.setItem(UNAME, (n || '').slice(0, 24)); } catch (e) { /* */ }
}

// Nom affiché : le nom choisi, sinon « Invité xxxx ».
export function displayName() {
  return getUserName() || ('Invité ' + getUserId().slice(2, 6));
}
