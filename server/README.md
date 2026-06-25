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

(Prérequis : `node` et `git` installés ; voir ci-dessous. Id de peer par défaut :
`tm-ee69hfhp`, modifiable via `TODOMAPPA_ID=… curl … | bash`.)

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

## Amorcer avec un board existant

Quand un appareil se connecte, **son board local est remplacé** par celui du serveur
(comportement client normal). Pour partir de ton board actuel plutôt que d'un board vide :

1. Dans l'app, menu radial → **Export** (télécharge un `.json`).
2. Copie ce fichier vers `server/data/board.json` (crée le dossier `data/` si besoin).
3. Démarre le serveur : il détecte le format d'export et le charge.

Ensuite, le serveur sauvegarde dans `data/board.json` (format interne) à chaque modif.

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
