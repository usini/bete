# Bibliothèques embarquées

Chargées uniquement à l’ouverture d’un QR ou à l’activation du partage, depuis ce site.
Aucun CDN n’est contacté pour les télécharger.

- `peerjs.min.js` : PeerJS **1.5.5**, distribution navigateur du paquet npm officiel `peerjs`.
  Licence MIT dans `peerjs.LICENSE`. [Sources](https://github.com/peers/peerjs).
- `qrcode.min.js` : **qrcode-generator 1.4.4** (fichier original `qrcode.js`, non minifié),
  Kazuhiko Arase. Licence MIT dans `qrcode.LICENSE`.
  [Sources](https://github.com/kazuhikoarase/qrcode-generator).

Le client remplace explicitement la configuration ICE par STUN uniquement, pour ne pas
utiliser les relais TURN présents dans les paramètres par défaut de PeerJS.

- ICAL.js 2.2.1, MPL-2.0. Source : https://github.com/kewisch/ical.js/tree/v2.2.1. Le calendrier Windows charge ce module localement.
