# Bete — hôte headless (Raspberry Pi)

Petit serveur Node qui joue le rôle d'**hôte permanent** pour Bete, sans aucune
modification de l'app web. Tes appareils s'y connectent comme à n'importe quel hôte,
via `?peer=<id>`. Il détient le board de référence et le sauvegarde sur disque, donc
la synchro reste disponible même quand tous tes navigateurs sont fermés.

Le protocole est identique à celui de l'app : seul le **contenu** est synchronisé
(texte, image, couleur, description, liens, positions au drop, créations/suppressions),
jamais la caméra. En cas de conflit, l'hôte (= ce serveur) l'emporte.

## Prérequis

- **Node.js 18, 20 ou 22 LTS** (évite la toute dernière non-LTS : les binaires
  pré-compilés de `@roamhq/wrtc` peuvent manquer).
- **Raspberry Pi OS 64-bit** recommandé (binaires `wrtc` arm64 pré-compilés). En
  32-bit, `npm install` tentera une compilation longue (déconseillé).

## Installation express (Raspberry Pi)

En une commande (clone + dépendances + service systemd) :

```bash
curl -fsSL https://raw.githubusercontent.com/usini/bete/main/server/install-pi.sh | bash
```

Un **id de peer privé** est généré automatiquement au premier lancement et stocké
dans `server/data/peer-id` (jamais commité). Le script affiche alors ton lien
`…?peer=<id>` — garde-le pour toi. (Prérequis : `node` et `git` installés ; voir
ci-dessous. Pour forcer un id : `BETE_ID=… curl … | bash`.)

Si tu as forké le projet pour l'héberger ailleurs, passe aussi `BETE_REPO=<ton-fork>`
et `BETE_APP_URL=<ton-domaine>` — voir [Configuration](#configuration-variables-denvironnement).

## Installation manuelle

```bash
cd server
npm install
```

## Lancement

```bash
npm start
```

Au démarrage, il affiche l'id et le lien à partager, par exemple :

```
[bete] HÔTE EN LIGNE
  id    : p-ab12cd34ef
  lien  : <url-de-ton-instance>/?peer=p-ab12cd34ef
```

(Le lien complet ne s'affiche que si `BETE_APP_URL` est défini — voir plus bas.)

Ouvre ce lien (ou son QR) sur tes appareils : ils se synchronisent avec le Pi.

L'id est **stable** : il est mémorisé dans `data/peer-id` et réutilisé à chaque
redémarrage, donc le lien ne change pas. (Tu peux aussi l'imposer avec la variable
d'environnement `BETE_ID`.)

## Multi-board

Un seul serveur héberge **plusieurs boards**. Le board ciblé est choisi côté
client par l'URL : `?peer=<id>&id=<board>` (sans `id`, board par défaut du lien).
Chaque board est persisté dans `server/data/boards/<board>.json`.

- Se connecter à un board **vide** côté serveur : ton board local le **sème** (au lieu
  d'être écrasé). Se connecter à un board **déjà rempli** : tu adoptes celui du serveur.

## Amorcer avec un board existant

Pour partir d'un board existant plutôt que vide :

1. Dans l'app, menu radial → **Exporter** (télécharge un `.json`).
2. Copie-le vers `server/data/boards/<board>.json` (ex. `home.json`). Crée le dossier si besoin.
3. Démarre/redémarre le serveur : il détecte le format d'export et le charge.

(L'ancien `data/board.json` mono-board est migré automatiquement vers le board `home`.)

## Configuration (variables d'environnement)

| Variable          | Rôle                                | Défaut                     |
|-------------------|--------------------------------------|-----------------------------|
| `BETE_ID`         | Force l'id du peer                  | mémorisé dans `data/peer-id`|
| `BETE_DATA`       | Dossier de données                  | `./data`                    |
| `BETE_APP_URL`    | Base de l'URL affichée (facultatif) | (aucun — lien relatif générique) |
| `BETE_MAX_BOARDS` | Limite de boards en mémoire         | `300`                       |

## Lancer en service (systemd)

`/etc/systemd/system/bete.service` :

```ini
[Unit]
Description=Bete host
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/home/pi/bete/server
Environment=BETE_APP_URL=https://ton-domaine.example/
ExecStart=/usr/bin/node bete-host.js
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bete
journalctl -u bete -f   # voir les logs / l'id
```

## Notes

- Connexion **P2P chiffrée** (WebRTC) via le broker public PeerJS pour la mise en
  relation ; relais TURN PeerJS si la connexion directe échoue. Aucune donnée de board
  ne passe par le broker.
- Un seul hôte par id à la fois. Si l'id est déjà pris (autre instance, ou broker pas
  encore libéré), le serveur réessaie automatiquement.
- Sauvegarde simple dans un fichier JSON ; pour une sauvegarde versionnée, ajoute le
  dossier `data/` à une sauvegarde régulière (cron, git, rsync…).
