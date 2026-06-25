# TODOMAPPA

Mindmap pense-bête pixel art. Site 100 % statique, zéro dépendance, zéro build.

## Lancer en local

Les modules ES ne marchent pas en `file://`, il faut un petit serveur :

```bash
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Déployer sur GitHub Pages

1. Pousser le repo sur GitHub.
2. `Settings → Pages → Build and deployment → Source: Deploy from a branch`.
3. Branche `main`, dossier `/ (root)`. Le site est servi tel quel.

## Utilisation

- **Clic droit** : menu radial (créer rectangle/pancarte/cercle/hexagone/liaison, couleur, texte, suppr, export/import).
- **Pancarte** : un rectangle plus grand à texture bois, pour les titres/panneaux.
- **Supprimer** un objet le fait **exploser en morceaux** (animation, synchronisée avec les clients).
- **Molette** : zoom · **glisser le fond** : déplacer la vue.
- **Glisser un rectangle** : déplacement élastique.
- **Glisser le bord d'un cercle/hexagone** : redimensionner · **glisser son intérieur** : déplacer.
- **Double-clic** : éditer le texte (Échap pour valider). Sur un **rectangle-image** : ouvre l'image en grand.
- **Glisser-déposer une image** (ou **Ctrl-V** une image du presse-papier) : sur un rectangle pour la mettre dedans, sur le vide pour créer un rectangle-image (« Img ✕ » pour la retirer). L'image est toujours affichée **en entier** ; le rectangle garde une taille à peu près constante.
- **Lien** (menu radial sur un rectangle) : associe une URL ; un badge ↗ apparaît et un **clic** ouvre le lien dans un nouvel onglet.
- **Suppr** : effacer l'élément sélectionné.
- **Ctrl-C / Ctrl-V** : copier-coller l'élément sélectionné (collé à la position de la souris).
- Un rectangle dont le centre est dans un cercle/hexagone prend sa couleur.

### Hexagones & liens

Un **hexagone** (ex. « Aujourd'hui ») agrège des **liens** vers des rectangles rangés ailleurs.
Glisse un rectangle (d'un cercle) dans un hexagone : un **lien** (bordure pointillée) est créé,
l'original revient à sa place. Le lien garde la **couleur du cercle source** et reflète son texte/image ;
renommer ou supprimer la source met à jour (ou retire) le lien. Les liens se placent librement dans l'hexagone.

### Synchro entre appareils (P2P)

Pour recopier ton board d'un appareil à l'autre (ex. desktop → téléphone) :

1. Sur l'appareil **source** (HOST) : menu radial → **« + Liaison »**. Un bloc QR code apparaît.
2. Sur l'autre appareil (CLIENT) : **scanne le QR** (ou ouvre le lien — clic sur le bloc le copie).
3. À la connexion, le board du client est remplacé par celui du host, puis les deux restent **synchronisés en direct, dans les deux sens**, tant que la fenêtre du host reste ouverte.

**Synchronisé** : le contenu (texte, image, couleur, description, liens, créations/suppressions) et la **position des objets** — mais celle-ci seulement **au lâcher** (pas pendant le glissement), et l'autre écran l'**anime**. **La caméra reste indépendante** : chaque écran garde son zoom/cadrage (ex. un écran en vue large, un autre zoomé sur un cercle). En cas de modification simultanée du même élément, **l'hôte l'emporte**.

Connexion **P2P chiffrée** (WebRTC via PeerJS) ; seuls des identifiants transitent par le broker de signalisation, le contenu passe en direct entre les deux navigateurs. Les libs PeerJS / QR sont chargées à la demande (CDN), l'app reste sans dépendance au repos.

**Hôte permanent (optionnel)** : pour garder la synchro disponible même tous navigateurs fermés, on peut faire tourner un petit serveur Node sur un Raspberry Pi qui joue l'hôte en continu — voir [`server/`](server/README.md). L'app n'a pas besoin d'être modifiée : les appareils s'y connectent via `?peer=<id-du-pi>`.

L'id de liaison est **stable** (mémorisé) : rafraîchir la page du host et recréer la liaison redonne **le même lien/QR**. En cas de coupure réseau, le host se reconnecte automatiquement au broker (même id) et les clients retentent la connexion — pas besoin de rescanner. Si le lien fuite, **« Nouveau lien »** (menu du bloc Liaison) régénère un id : l'ancienne URL devient invalide, le board est conservé.

Côté confidentialité : le contenu transite en WebRTC chiffré (DTLS), en direct entre pairs dans le cas normal ; si une connexion directe est impossible, il est relayé (chiffré) par les serveurs TURN de PeerJS. Le broker ne voit que des identifiants de connexion.

### Mobile / tactile

- **Interaction verrouillée par défaut** (pour ne pas déplacer un bloc par accident) : seuls le pan (1 doigt) et le zoom (pince) marchent. L'**appui long** propose alors uniquement **« Activer »**. Une fois activé, le menu radial standard revient (avec **« Désactiver »** pour reverrouiller).
- **1 doigt** : glisser le fond (pan) ou, une fois activé, déplacer un élément.
- **2 doigts** : pincer pour zoomer.
- **Appui long** : menu radial · **double-tap** : éditer / voir l'image (interaction activée).

Sauvegarde automatique dans le navigateur (localStorage). Export/Import JSON via le menu radial.

## Ouvrir un board depuis une URL

Ajouter `?file=<url>` à l'adresse charge ce JSON au lieu du localStorage, sans écraser ton board perso :

```
https://remisarrailh.github.io/pensebete/?file=https://exemple.com/board.json
```

Le fichier doit être accessible en CORS (même origine, raw.githubusercontent.com, gist…). Un chemin relatif fonctionne aussi : `?file=boards/demo.json`.
