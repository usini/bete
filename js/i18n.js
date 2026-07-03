// Minimal i18n engine: no build step, no external files — just a dictionary object
// per language and a lookup function. Adding a language is one new object with the
// same keys as an existing one (missing keys fall back to English, then to the key
// itself so a typo never crashes the UI, it just shows the raw key).
//
// Language choice: explicit user choice (Settings) is persisted and always wins.
// With no saved choice, we guess from the browser (navigator.language), falling
// back to English for anything we don't have a dictionary for.

const STORE_KEY = 'bete:lang';

const STRINGS = {
  en: {
    'app.title': 'Bete',

    'hint.default': 'RIGHT CLICK / LONG PRESS = MENU',
    'hint.active': 'INTERACTION ON · LONG PRESS = MENU',
    'hint.locked': 'VIEW ONLY · LONG PRESS TO ENABLE',

    'button.settings': 'Settings',
    'button.mic.title': 'Mic: talk (listening is automatic)',
    'button.mic.aria': 'Talk',
    'button.listen.title': 'Listening (speaker)',
    'button.listen.aria': 'Listening',

    'toast.connecting': 'CONNECTING TO LIAISON...',
    'toast.noHost': "NO HOST: YOU ARE THE HOST",
    'toast.synced': 'SYNCED ✓',
    'toast.connectedReceiving': 'CONNECTED - RECEIVING...',
    'toast.unreachable': 'LIAISON UNREACHABLE',
    'toast.hostDisconnected': 'HOST DISCONNECTED',
    'toast.homeLocal': 'HOME STAYS LOCAL (not connectable)',

    'reconnect.title': 'CONNECTION ISSUE',
    'reconnect.loopMessage': "The liaison keeps disconnecting and reconnecting. Refreshing the page usually fixes this.",
    'reconnect.refresh': '↻ Refresh the page',
    'reconnect.dismiss': 'Ignore',

    'net.relay': '● RELAY (TURN)',
    'net.p2p': '● DIRECT P2P',
    'net.connecting': '● CONNECTING…',

    'liaison.host': 'Host',
    'liaison.you': 'You',
    'liaison.guest': 'Guest',
    'liaison.manage': 'Manage liaisons',
    'liaison.disconnect': 'Disconnect liaison',

    'board.home': 'Home',
    'board.tutorial': 'Tutorial',

    'radial.close': 'Close',
    'radial.enable': 'Enable',
    'radial.copyLink': 'Copy link',
    'radial.newLink': 'New link',
    'radial.delete': 'Delete',
    'radial.deleteN': 'Delete ({n})',
    'radial.playPause': 'Play / Pause',
    'radial.editText': 'Edit text',
    'radial.clickableLink': 'Clickable link',
    'radial.viewImage': 'View image',
    'radial.removeImage': 'Remove image',
    'update.title': 'Update available',
    'update.available': 'Version {version} is available.',
    'update.install': 'Install and restart',
    'update.later': 'Later',
    'update.installing': 'Downloading and installing…',
    'update.failed': 'Update failed. Try again later.',
    'radial.uploadImage': 'Upload image',
    'radial.camera': 'Camera',
    'radial.boardLink': 'Board link',
    'radial.voiceMemo': 'Voice memo',
    'radial.unlink': 'Unlink',
    'radial.color': 'Color',
    'radial.text': 'Text',
    'radial.rectangle': 'Rectangle',
    'radial.sign': 'Sign',
    'radial.circle': 'Circle',
    'radial.hexagon': 'Hexagon',
    'radial.liaison': 'Liaison',
    'radial.undo': 'Undo',
    'radial.selection': 'Selection',
    'radial.settings': 'Settings',
    'radial.lock': 'Lock',

    'boardPicker.title': 'LINK TO A BOARD',
    'boardPicker.newPlaceholder': 'New board…',
    'boardPicker.empty': '(no other board visited)',

    'linkbar.prefix': '↗ ',

    'liaisonBlock.copied': 'LINK COPIED!',
    'liaisonBlock.connected': 'CONNECTED - CLICK=COPY',
    'liaisonBlock.online': 'CLICK TO COPY LINK',
    'liaisonBlock.error': 'NETWORK ERROR',
    'liaisonBlock.connecting': 'CONNECTING...',

    'voiceBlock.loading': 'loading…',
    'voiceBlock.missing': 'unavailable',

    'video.close': 'Close',

    'record.stop': '■ STOP',
    'record.cancel': 'CANCEL',

    'alert.jsonInvalid': 'Invalid JSON',
    'alert.recordingUnsupported': 'Audio recording not supported by this browser.',
    'alert.micUnavailable': 'Microphone unavailable or refused.',
    'alert.recordingFailed': 'Recording failed.',
    'alert.memoStorageFailed': 'Could not save the memo.',

    'settings.title': 'SETTINGS',
    'settings.back': 'Back',
    'settings.audio': 'Audio',
    'settings.visual': 'Visual',
    'settings.theme': 'Theme',
    'settings.textSize': 'Text size',
    'settings.language': 'Language',
    'settings.liaisons': 'Liaisons',
    'settings.shareMode': 'Sharing',
    'settings.shareInternet': 'Internet',
    'settings.shareLan': 'Local network',
    'settings.shareMode.hint': 'Address embedded in links given to other people (liaison, board links). Internet: bete.usini.eu. Local network: this computer\'s LAN address (only reachable on the same Wi-Fi/network).',
    'settings.homeLocked': "🔒 Home is local: not connectable (protected from being overwritten).",
    'settings.connected': 'Connected',
    'settings.disconnect.title': 'Disconnect',
    'settings.noLiaisons': '(no saved liaison)',
    'settings.joinThis.title': 'Join this liaison',
    'settings.rename.title': 'Rename',
    'settings.rename.prompt': 'Liaison name:',
    'settings.remove.title': 'Remove',
    'settings.peerPlaceholder': 'peer id or link…',
    'settings.join': 'Join',
    'settings.user': 'User',
    'settings.namePlaceholder': 'Your name…',
    'settings.ok': 'OK',
    'settings.connectedCount': 'Connected ({n})',
    'settings.you': ' (you)',
    'settings.voice': 'Voice',
    'settings.micAlwaysOn': 'Always on (mobile)',
    'settings.micAlwaysOn.title': "Keeps the mic active continuously on mobile (screen stays on, auto-resume if the OS cuts the mic).",
    'settings.micAlwaysOn.hint': 'Turns on as soon as you speak (mic button).',
    'settings.micInput': 'Input microphone',
    'settings.loading': 'Loading…',
    'settings.noMic': '(no microphone detected — allow the mic then reopen this menu)',
    'settings.micDefault': 'Default microphone',
    'settings.micSystemAudio': '🖥 Computer sound (screen/tab share)',
    'settings.micN': 'Microphone {n}',
    'settings.navigation': 'Navigation',
    'settings.replayTutorial': '↻ Replay the tutorial',
    'settings.visitedBoards': 'Visited boards',
    'settings.data': 'Data',
    'settings.export': '⭳ Export (JSON)',
    'settings.import': '⭱ Import (JSON)',
    'settings.exportAll': '⭳ Export all boards',
    'settings.importAll': '⭱ Import all boards',
    'settings.currentBoard': 'Current board',
    'settings.clearBoard': 'Clear this board',
    'settings.clearConfirm': 'Confirm erase?',

    'debug.header': 'DEBUG · WOBBLE (²)',
    'debug.stiffness': 'Stiffness (spring)',
    'debug.damping': 'Damping',
    'debug.maxStretch': 'Max deformation',
    'debug.stretchK': 'Velocity sensitivity',
    'debug.reset': 'Reset',
  },

  fr: {
    'app.title': 'Bete',

    'hint.default': 'CLIC DROIT&nbsp;/&nbsp;APPUI LONG&nbsp;=&nbsp;MENU',
    'hint.active': 'INTERACTION ON · APPUI LONG = MENU',
    'hint.locked': 'VUE SEULE · APPUI LONG POUR ACTIVER',

    'button.settings': 'Paramètres',
    'button.mic.title': "Micro : parler (l'écoute est automatique)",
    'button.mic.aria': 'Micro parler',
    'button.listen.title': 'Écoute (haut-parleur)',
    'button.listen.aria': 'Écoute',

    'toast.connecting': 'CONNEXION A LA LIAISON...',
    'toast.noHost': "AUCUN HOTE : VOUS ETES L'HOTE",
    'toast.synced': 'SYNCHRONISE ✓',
    'toast.connectedReceiving': 'CONNECTE - RECEPTION...',
    'toast.unreachable': 'LIAISON INJOIGNABLE',
    'toast.hostDisconnected': 'HOTE DECONNECTE',
    'toast.homeLocal': 'HOME RESTE LOCAL (non connectable)',

    'reconnect.title': 'PROBLEME DE CONNEXION',
    'reconnect.loopMessage': "La liaison n'arrête pas de se déconnecter et se reconnecter. Rafraîchir la page résout généralement le problème.",
    'reconnect.refresh': '↻ Rafraîchir la page',
    'reconnect.dismiss': 'Ignorer',

    'net.relay': '● RELAIS (TURN)',
    'net.p2p': '● P2P DIRECT',
    'net.connecting': '● LIAISON…',

    'liaison.host': 'Hôte',
    'liaison.you': 'Toi',
    'liaison.guest': 'Invité',
    'liaison.manage': 'Gérer les liaisons',
    'liaison.disconnect': 'Déconnecter la liaison',

    'board.home': 'Home',
    'board.tutorial': 'Tutoriel',

    'radial.close': 'Fermer',
    'radial.enable': 'Activer',
    'radial.copyLink': 'Copier le lien',
    'radial.newLink': 'Nouveau lien',
    'radial.delete': 'Supprimer',
    'radial.deleteN': 'Supprimer ({n})',
    'radial.playPause': 'Lire / Pause',
    'radial.editText': 'Éditer le texte',
    'radial.clickableLink': 'Lien cliquable',
    'radial.viewImage': "Voir l'image",
    'radial.removeImage': "Retirer l'image",
    'update.title': 'Mise à jour disponible',
    'update.available': 'La version {version} est disponible.',
    'update.install': 'Installer et redémarrer',
    'update.later': 'Plus tard',
    'update.installing': 'Téléchargement et installation…',
    'update.failed': 'Échec de la mise à jour. Réessaie plus tard.',
    'radial.uploadImage': 'Importer une image',
    'radial.camera': 'Caméra',
    'radial.boardLink': 'Lien board',
    'radial.voiceMemo': 'Mémo vocal',
    'radial.unlink': 'Délier',
    'radial.color': 'Couleur',
    'radial.text': 'Texte',
    'radial.rectangle': 'Rectangle',
    'radial.sign': 'Pancarte',
    'radial.circle': 'Cercle',
    'radial.hexagon': 'Hexagone',
    'radial.liaison': 'Liaison',
    'radial.undo': 'Annuler',
    'radial.selection': 'Sélection',
    'radial.settings': 'Paramètres',
    'radial.lock': 'Verrouiller',

    'boardPicker.title': 'LIEN VERS UN BOARD',
    'boardPicker.newPlaceholder': 'Nouveau board…',
    'boardPicker.empty': '(aucun autre board visité)',

    'linkbar.prefix': '↗ ',

    'liaisonBlock.copied': 'LIEN COPIE !',
    'liaisonBlock.connected': 'CONNECTE - CLIC=COPIER',
    'liaisonBlock.online': 'CLIC = COPIER LIEN',
    'liaisonBlock.error': 'ERREUR RESEAU',
    'liaisonBlock.connecting': 'CONNEXION...',

    'voiceBlock.loading': 'chargement…',
    'voiceBlock.missing': 'indispo',

    'video.close': 'Fermer',

    'record.stop': '■ STOP',
    'record.cancel': 'ANNULER',

    'alert.jsonInvalid': 'JSON invalide',
    'alert.recordingUnsupported': 'Enregistrement audio non supporté par ce navigateur.',
    'alert.micUnavailable': 'Micro indisponible ou refusé.',
    'alert.recordingFailed': 'Enregistrement impossible.',
    'alert.memoStorageFailed': 'Stockage du mémo impossible.',

    'settings.title': 'PARAMETRES',
    'settings.back': 'Retour',
    'settings.audio': 'Audio',
    'settings.visual': 'Visuel',
    'settings.theme': 'Thème',
    'settings.textSize': 'Taille du texte',
    'settings.language': 'Langue',
    'settings.liaisons': 'Liaisons',
    'settings.shareMode': 'Partage',
    'settings.shareInternet': 'Internet',
    'settings.shareLan': 'Réseau local',
    'settings.shareMode.hint': "Adresse utilisée dans les liens donnés à d'autres personnes (liaison, liens vers un board). Internet : bete.usini.eu. Réseau local : l'adresse de cet ordinateur sur le réseau (accessible uniquement sur le même Wi-Fi/réseau).",
    'settings.homeLocked': "🔒 Home est local : non connectable (protégé contre l'écrasement).",
    'settings.connected': 'Connecté',
    'settings.disconnect.title': 'Déconnecter',
    'settings.noLiaisons': '(aucune liaison enregistrée)',
    'settings.joinThis.title': 'Rejoindre cette liaison',
    'settings.rename.title': 'Renommer',
    'settings.rename.prompt': 'Nom de la liaison :',
    'settings.remove.title': 'Retirer',
    'settings.peerPlaceholder': 'id de peer ou lien…',
    'settings.join': 'Rejoindre',
    'settings.user': 'Utilisateur',
    'settings.namePlaceholder': 'Ton nom…',
    'settings.ok': 'OK',
    'settings.connectedCount': 'Connectés ({n})',
    'settings.you': ' (toi)',
    'settings.voice': 'Voix',
    'settings.micAlwaysOn': 'Toujours actif (mobile)',
    'settings.micAlwaysOn.title': "Garde le micro actif en continu sur mobile (écran maintenu allumé, reprise auto si l'OS coupe le micro).",
    'settings.micAlwaysOn.hint': "S'active dès que tu parles (bouton micro).",
    'settings.micInput': "Micro d'entrée",
    'settings.loading': 'Chargement…',
    'settings.noMic': '(aucun micro détecté — autorise le micro puis rouvre ce menu)',
    'settings.micDefault': 'Micro par défaut',
    'settings.micSystemAudio': '🖥 Son du PC (partage écran/onglet)',
    'settings.micN': 'Micro {n}',
    'settings.navigation': 'Navigation',
    'settings.replayTutorial': '↻ Revoir le tutoriel',
    'settings.visitedBoards': 'Boards visités',
    'settings.data': 'Données',
    'settings.export': '⭳ Exporter (JSON)',
    'settings.import': '⭱ Importer (JSON)',
    'settings.exportAll': '⭳ Exporter toutes les boards',
    'settings.importAll': '⭱ Importer toutes les boards',
    'settings.currentBoard': 'Board courant',
    'settings.clearBoard': 'Effacer ce board',
    'settings.clearConfirm': "Confirmer l'effacement ?",

    'debug.header': 'DEBUG · WOBBLE (²)',
    'debug.stiffness': 'Raideur (ressort)',
    'debug.damping': 'Amortissement',
    'debug.maxStretch': 'Déformation max',
    'debug.stretchK': 'Sensibilité vitesse',
    'debug.reset': 'Réinitialiser',
  },
};

// Languages selectable in Settings. Adding a language = add its dictionary above
// (same keys as 'en') and one entry here — nothing else needs to change.
export const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

function detectLang() {
  const nav = (navigator.language || navigator.userLanguage || 'en').slice(0, 2).toLowerCase();
  return STRINGS[nav] ? nav : 'en';
}

let lang = detectLang();
try { const saved = localStorage.getItem(STORE_KEY); if (saved && STRINGS[saved]) lang = saved; } catch (e) { /* */ }

export function getLang() { return lang; }

export function setLang(code) {
  if (!STRINGS[code]) return;
  lang = code;
  try { localStorage.setItem(STORE_KEY, code); } catch (e) { /* */ }
  document.documentElement.lang = code;
  applyStaticI18n();
}

// Look up a string by key, with {placeholder} interpolation. Falls back to
// English, then to the raw key (never throws, never shows "undefined").
export function t(key, vars) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

// Applies translations to any static DOM element tagged with data-i18n*
// attributes (index.html chrome). Call once at boot and again on language change.
export function applyStaticI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  scope.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
  scope.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.getAttribute('data-i18n-title')); });
  scope.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
}

document.documentElement.lang = lang;
