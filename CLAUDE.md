# CLAUDE.md

Guide pour toute instance de Claude Code travaillant sur ce repo.

## Le projet

**Bete** : mindmap pixel art, 100 % statique. Vanilla JS (modules ES),
Canvas 2D, **aucune dépendance npm, aucun build**. Déployé tel quel sur GitHub Pages.

- Repo actif : `github.com/usini/bete`
- Site : https://bete.usini.eu/ (domaine personnalisé, voir `CNAME` — servi via GitHub Pages)
- Doc utilisateur (fonctionnalités, contrôles souris/tactile) : [README.md](README.md)

**⚠️ `github.com/remisarrailh/pensebete` est un dépôt ARCHIVÉ** (ancien nom du projet,
TODOMAPPA / pense-bête). Ne plus jamais y pousser — `origin` de ce dépôt local pointe
sur `usini/bete`. Si tu vois cette autre URL quelque part (config, doc externe, mémoire
d'une session précédente), c'est une trace obsolète à corriger, pas une destination valide.

## Convention de branding — pas de mention de l'ancien nom

Le projet s'appelle **Bete**, point. Ne (ré)introduis nulle part les anciens noms
(TODOMAPPA, pense-bête, pensebete) : ni dans le code, ni dans les identifiants
(clés localStorage, noms de base IndexedDB, variables d'env, noms de service), ni
dans la doc. Un rename a eu lieu (voir « Historique » plus bas) précisément pour
éliminer ces mentions — ne pas les faire réapparaître par copier-coller de code ancien.

## Convention — éviter les liens/URLs en dur

Le projet doit rester facilement re-déployable ailleurs (autre domaine, autre fork).
En conséquence :

- **Dans le code client** (`js/*`), ne jamais coder en dur le domaine de prod. Les
  liens de board/liaison utilisent déjà `location.origin`/`location.pathname`
  (`boards.js: buildBoardUrl/parseBoardUrl`) — continuer sur ce principe pour toute
  nouvelle fonctionnalité de lien interne.
- **Dans `server/bete-host.js`**, `APP_URL` n'a **aucun défaut codé en dur** (vide par
  défaut) : il se configure via la variable d'env `BETE_APP_URL`. Ne jamais y remettre
  un domaine par défaut.
- **Dans `server/install-pi.sh`**, le seul endroit où un domaine/dépôt a un défaut
  raisonnable est `REPO` (`BETE_REPO`, pointant sur `usini/bete`) — mais reste
  surchargeable par variable d'env pour quiconque fork le projet.
- La doc (`README.md`, `server/README.md`) peut mentionner l'URL réelle de prod
  (`bete.usini.eu`) à titre d'info humaine — ce n'est pas la même chose qu'un lien en
  dur dans le code exécuté.

## Aucune rétrocompatibilité de données (décision explicite)

Contrairement à d'anciennes migrations qui existaient (ancien board mono-fichier,
anciennes clés localStorage préfixées `todomappa:`), il a été explicitement décidé de
**ne pas migrer** les données de l'ancienne branding vers la nouvelle : repart à zéro.
Ne pas réintroduire de code de migration `todomappa* -> bete*` sans qu'on te le demande
explicitement — ce choix a été fait en connaissance de cause (perte assumée des boards/
mémos/images stockés sous l'ancien nommage dans les navigateurs des utilisateurs).

## Architecture

```
index.html               entrée : canvas + overlays HTML (menus, popups, boutons)
css/style.css             palette pixel, scanlines CRT, glow néon, thèmes
js/main.js                bootstrap, boucle RAF, câblage des boutons globaux
js/state.js               modèle de données, serialize()/load(), autosave localStorage
js/camera.js              transform monde<->écran, zoom/pan
js/physics.js             ressort d'inertie + wobble (déformation) par node
js/render.js              dessin (grille, cercles, hexagones, rectangles, curseurs)
js/input.js               souris/tactile, drag, menu radial, édition texte, D&D image
js/minimap.js             minimap + clic pour recentrer
js/io.js                  export/import JSON
js/sync.js                synchro P2P (PeerJS/WebRTC) : hôte/client, delta, merge, présence
js/audio.js               IndexedDB : blobs audio (mémos vocaux) + images
js/images.js              offload images -> IndexedDB (réf 'idb:<hash>'), migration, export
js/voice.js               mémos vocaux : enregistrement, lecture, partage P2P
js/voicechat.js           chat vocal live (mesh WebRTC), Always On, choix micro
js/settings.js            panneau Paramètres (thème, liaisons, voix, données...)
js/boards.js, liaisons.js gestion multi-board + liaisons nommées
js/theme.js               thèmes (pixel/classic/classic-dark), taille de texte
js/users.js               identité locale (uid, nom affiché)
js/yt.js, video.js         intégration miniature/lecteur YouTube inline
js/fx.js                  explosion de particules à la suppression
js/tutorial.js             board de démo intégré (lecture seule)
cachebust.mjs             ajoute ?v=<version> aux imports avant chaque déploiement
CNAME                     domaine personnalisé GitHub Pages (bete.usini.eu)
server/                   hôte headless Node (Raspberry Pi) — voir server/README.md
```

Pas de bundler : les modules s'importent directement (`import ... from './x.js?v=...'`).
Le `?v=` est un cache-buster, pas une vraie version — voir plus bas.

## Modèle de données (`state.js`)

```js
{
  version, camera: { x, y, zoom },
  nodes:    [ { id, x, y, w, h, text, image?, link?, kind?, ref?, dur? } ],
  circles:  [ { id, x, y, r, color, description } ],
  hexagons: [ { id, x, y, r, color, description } ],
}
```

- `nodes` = rectangles / pancartes / blocs mémo vocal (`kind:'voice'`) / liens (`ref` = id
  de la source, hérite texte/image/link).
- Couleur effective d'un rectangle = dernier cercle/hexagone (z-order) contenant son centre,
  jamais stockée (recalculée au rendu).
- `image` : soit une data URL héritée, soit `'idb:<hash>'` (référence IndexedDB, voir plus bas).

## Stockage local — préfixes actuels

Toutes les clés localStorage sont préfixées `bete:` (ex. `bete:boards`, `bete:liaisons`,
`bete:theme`, `bete:<boardId>`), sauf `bete:peer` (id de peer local) et `bete:uid`/
`bete:username` (identité). La base IndexedDB s'appelle `bete` (stores `audio` et
`images`). Le debug console est exposé sur `window.bete`.

## Synchro P2P (`sync.js`) — points importants

- **Contenu uniquement** synchronisé (texte, image, couleur, description, liens,
  créations/suppressions, positions **au drop seulement**). La caméra reste locale à
  chaque écran.
- Élection hôte/client (`joinOrHost`) : le premier à réclamer l'id de peer devient hôte,
  les suivants deviennent clients. Heartbeat hôte (3 s) + watchdog client (8 s) pour
  détecter la perte de connexion. Reconnexion **prudente** : le client retente d'abord
  en client (3 essais) avant de tenter une élection d'hôte, pour ne pas voler l'id d'un
  hôte permanent (Pi) en cours de redémarrage.
- **Synchro en DELTA** : seules les entrées de contenu modifiées + les suppressions sont
  redistribuées à chaque tick (800 ms), pas tout le board. Le tout premier envoi après
  connexion reste complet (semence). Ce point a une histoire — voir plus bas.
- Merge par id, conflit résolu en **LWW + priorité host** (à égalité de timestamp).
- Audio et images ne transitent JAMAIS en base64 dans le payload de sync : ils sont
  envoyés en binaire à la demande (protocoles `audioReq`/`audioRes`, `imgReq`/`imgRes`)
  et mis en cache local (IndexedDB) + côté hôte (mémoire, borné pour les images).

## Images : offload IndexedDB (`images.js`, `audio.js`)

Les images ne sont **plus** stockées en base64 inline dans `node.image` : elles sont
rangées dans IndexedDB, indexées par le **hash SHA-256 de leur contenu**, et le nœud ne
garde qu'une réf `'idb:<hash>'`. Pourquoi : sur une board avec beaucoup d'images, rediffuser
du base64 à chaque tick de sync saturait la connexion P2P (jusqu'à faire planter l'hôte Pi).

- `storeImage(dataUrl)` → écrit en IndexedDB, renvoie la réf.
- `getImageEl(ref)` (render.js l'utilise via `getImg`) → résout la réf en `<img>`,
  demande l'octet aux pairs si absent localement (`requestImage`/`imgReq`).
- `migrateImages()` : convertit en tâche de fond les images héritées (data URL) en
  réfs IndexedDB — appelé au boot (`main.js`) et après un import JSON.
- `inlineImages()` : ré-inline les réfs en data URL pour un **export JSON auto-contenu**
  (le fichier doit rester ouvrable sans les pairs / IndexedDB d'origine).
- Toute nouvelle fonctionnalité qui touche à `node.image` doit passer par ce module,
  jamais écrire une data URL brute dans `node.image` sans l'offloader.

## Workflow de déploiement (à chaque changement de JS/HTML)

```bash
node cachebust.mjs          # 1. bump ?v= sur tous les imports + index.html
git add -A && git commit -m "..."   # 2. commit (message SANS guillemets, cf. conventions)
git push                    # 3. push -> déclenche le déploiement GitHub Pages
```

Puis **attendre le déploiement** (poller `https://bete.usini.eu/index.html` en prod
jusqu'à voir le nouveau `?v=`) avant de considérer le travail terminé — GitHub Pages
met de 30 s à quelques minutes à propager.

**Si le changement touche `server/bete-host.js`**, il faut aussi mettre à jour l'hôte
permanent (Raspberry Pi, service systemd `bete`) :

```bash
ssh maison 'cd ~/pensebete && git pull --ff-only && sudo -n systemctl restart bete'
```

(SSH passwordless configuré vers l'hôte `maison` ; `sudo -n` fonctionne sans mot de passe
pour ce service. Le dossier cloné sur le Pi s'appelle encore `~/pensebete` — c'est
juste un nom de dossier local, sans conséquence ; pas la peine de le renommer sauf si
demandé.) Vérifier ensuite les logs : `sudo -n journalctl -u bete -n 20`.

## Conventions de ce repo

- **Aucune dépendance de build** : ne pas introduire de bundler, TypeScript, npm côté
  client. Le `server/` (Node sur le Pi) est le seul endroit avec un `package.json`.
- **Commits sans guillemets** dans le message (contrainte de l'environnement shell de
  l'utilisateur) ; terminer par `Co-Authored-By: Claude ... <noreply@anthropic.com>`.
- Ne jamais committer l'id de peer privé du Pi (`server/data/peer-id`) ni des secrets.
- Le board `home` est **sanctuarisé** : jamais connecté en P2P (protection contre
  l'écrasement accidentel).
- Tester une synchro P2P avec **deux onglets du même navigateur donne de faux négatifs**
  (même `localStorage` → même uid → collisions de curseur/voix/présence). Préférer deux
  appareils réels, ou au moins deux navigateurs différents.
- Commentaires : uniquement quand le POURQUOI n'est pas évident (contrainte cachée,
  raison d'un contournement) — pas de commentaires qui décrivent juste le code.
- Voir aussi les deux conventions dédiées plus haut : pas de mention de l'ancien nom,
  éviter les liens en dur.

## Historique utile (pourquoi certaines choses sont ainsi)

- La synchro **full-board à chaque tick** a été remplacée par du **delta** après un
  incident : sur une board riche en images, le trafic répété faisait planter le serveur
  Pi (`WebSocket was closed before the connection was established`, exception non
  gérée dans peerjs/ws faisant crasher le process Node). Le serveur a aussi gagné des
  gardes `process.on('uncaughtException'/'unhandledRejection')` et un `disconnected`
  qui fait `destroy()` + redémarrage planifié plutôt que `peer.reconnect()` (buggy sur
  la stack wrtc/ws).
- L'offload images IndexedDB a suivi immédiatement, pour la même raison (le delta seul
  ne suffisait pas : les grosses images inline restaient énormes dès qu'elles changeaient).
- **Rebrand (juillet 2026)** : le projet s'appelait TODOMAPPA (dépôt `remisarrailh/pensebete`,
  GitHub Pages `remisarrailh.github.io/pensebete`). Il a été renommé **Bete**, transféré vers
  `usini/bete`, et redéployé sous domaine personnalisé `bete.usini.eu`. L'ancien dépôt est
  archivé (figé, ne plus y toucher). Décision assumée : aucune rétrocompatibilité de données
  entre les deux noms (voir plus haut).
