# TODOMAPPA — hôte headless (Raspberry Pi)

Petit serveur Node qui joue le rôle d'**hôte permanent** pour TODOMAPPA, sans aucune
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
curl -fsSL https://raw.githubusercontent.com/remisarrailh/pensebete/main/server/install-pi.sh | bash
```

Un **id de peer privé** est généré automatiquement au premier lancement et stocké
dans `server/data/peer-id` (jamais commité). Le script affiche alors ton lien
`…?peer=<id>` — garde-le pour toi. (Prérequis : `node` et `git` installés ; voir
ci-dessous. Pour forcer un id : `TODOMAPPA_ID=… curl … | bash`.)

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
[todomappa] HÔTE EN LIGNE
  id    : tm-ab12cd34ef
  lien  : https://remisarrailh.github.io/pensebete/?peer=tm-ab12cd34ef
```

Ouvre ce lien (ou son QR) sur tes appareils : ils se synchronisent avec le Pi.

L'id est **stable** : il est mémorisé dans `data/peer-id` et réutilisé à chaque
redémarrage, donc le lien ne change pas. (Tu peux aussi l'imposer avec la variable
d'environnement `TODOMAPPA_ID`.)

## Multi-board

Un seul serveur héberge **plusieurs pense-bêtes**. Le board ciblé est choisi côté
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

| Variable             | Rôle                                      | Défaut                                   |
|----------------------|-------------------------------------------|------------------------------------------|
| `TODOMAPPA_ID`       | Force l'id du peer                         | mémorisé dans `data/peer-id`             |
| `TODOMAPPA_DATA`     | Dossier de données                        | `./data`                                 |
| `TODOMAPPA_APP_URL`  | Base de l'URL affichée                     | `https://remisarrailh.github.io/pensebete/` |

## Lancer en service (systemd)

`/etc/systemd/system/todomappa.service` :

```ini
[Unit]
Description=TODOMAPPA host
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/home/pi/TODOMAPPA/server
ExecStart=/usr/bin/node todomappa-host.js
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todomappa
journalctl -u todomappa -f   # voir les logs / l'id
```

## Notes

- Connexion **P2P chiffrée** (WebRTC) via le broker public PeerJS pour la mise en
  relation ; relais TURN PeerJS si la connexion directe échoue. Aucune donnée de board
  ne passe par le broker.
- Un seul hôte par id à la fois. Si l'id est déjà pris (autre instance, ou broker pas
  encore libéré), le serveur réessaie automatiquement.
- Sauvegarde simple dans un fichier JSON ; pour une sauvegarde versionnée, ajoute le
  dossier `data/` à une sauvegarde régulière (cron, git, rsync…).
