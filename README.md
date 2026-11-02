# Bête

Un tableau libre pour organiser des idées : blocs de texte, images, groupes, vidéos YouTube
et liens, sur une grande zone que l'on déplace et que l'on zoome.

Client 100 % statique : JavaScript natif (modules ES) et canvas 2D, sans installation npm ni étape de build.
PeerJS et la génération des QR codes sont embarqués et chargés seulement pour le partage.

## Lancer en local

Les modules ES ne fonctionnent pas en `file://` : il faut un petit serveur statique.

```bash
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Fonctions

- **Blocs** : rectangle (texte, couleur, image facultative) et groupe.
  Le texte se redimensionne automatiquement pour remplir le bloc.
- **Groupe** : une zone colorée avec un titre ; déplacer le groupe déplace les blocs qu'il contient.
  Chaque groupe a un lien dans le menu pour s'y rendre d'un clic.
- **Vidéos YouTube** : un lien YouTube dans le texte d'un bloc affiche la miniature et le titre ;
  un double-clic lance la vidéo.
- **Liens** : chaque bloc peut avoir un lien, affiché dans une pastille au-dessus ; un double-clic l'ouvre.
- **Produits Amazon** : un lien Amazon est raccourci, et on peut y noter nom, prix et délai de livraison.
- **Édition** : une popup pour modifier le texte, le lien et l'image (choix d'un fichier ou collage).
- **Annuler / rétablir** : Ctrl+Z et Ctrl+Maj+Z (ou Ctrl+Y), boutons en haut à gauche, et une liste des
  60 dernières actions où l'on peut revenir à n'importe quel état (historique conservé dans la sauvegarde locale et les fichiers JSON, y compris sur Drive).
- **Double-clic dans le vide** : crée un rectangle à cet endroit.
- **Navigation** : déplacement, zoom (molette ou pincement), minimap, alignement automatique des blocs.
- **Sauvegarde** : enregistrement automatique dans le navigateur (localStorage et IndexedDB),
  export et import d'un fichier JSON.
- **Google Drive (facultatif)** : sauvegarde automatique du tableau dans un dossier caché de ton Drive
  (droit `drive.appdata` uniquement). Vérification toutes les 30 secondes et envoi uniquement si le tableau a changé,
  si le réseau et la session le permettent.
  Aucun envoi si le contenu est inchangé. Un conflit suspend la sauvegarde et affiche un message
  dans le panneau ; « Sauvegarder maintenant » permet de choisir la version sans interruption automatique.
  Quitter la page avant que tout soit sauvegardé déclenche l'envoi immédiat et un avertissement du navigateur.

Les tableaux ne sont pas envoyés au serveur de Bête. Les appels réseau sont ceux de YouTube :
miniatures (`i.ytimg.com`), titres (oEmbed) et lecteur (`youtube-nocookie.com`) ; et, seulement si tu
actives la sauvegarde, ceux de Google et du service OAuth `auth-bete.usini.eu`. Ce service renouvelle
les autorisations sans stocker les tableaux. Le partage P2P facultatif contacte aussi
`peer-bete.usini.eu`, STUN Google et les participants autorisés. Le jeton de renouvellement reste chiffré dans un cookie
HttpOnly du navigateur ; le service le traite temporairement.

Déploiement VPS / Portainer / Cloudflare Tunnel : voir [auth/README.md](auth/README.md)
et le Compose autonome [auth/compose.portainer.yml](auth/compose.portainer.yml).

## Partager un groupe

Sélectionne un groupe puis clique sur l’icône **QR code**, sous 🎨. La fenêtre propose le QR,
le lien, **Activer / Désactiver le partage** et **Régénérer le lien** (sur l’appareil source).
Tous les participants peuvent modifier. Le lien ajoute ce groupe à leur tableau infini, dans
un espace libre, ou retrouve sa copie par ID ; les autres blocs et l’historique ne sont pas envoyés.
La position du groupe et la caméra restent propres à chaque appareil ; la disposition interne est partagée.

L’appareil source doit rester ouvert. Les copies restent disponibles hors ligne et les modifications
sont fusionnées à la reconnexion. Toute personne ayant le lien peut copier et modifier le groupe ;
révoquer un lien ne peut pas effacer les copies déjà reçues. Deux modifications simultanées du même
bloc sont départagées par version, sans fusion du texte caractère par caractère.

Le serveur **peer-bete.usini.eu** ne fait que la signalisation WebRTC. Le contenu et les images
passent directement entre navigateurs, avec STUN et **sans relais TURN** : certains réseaux
ne permettront pas de connexion. Les groupes partagés indépendamment ne doivent pas se chevaucher.
Voir [la procédure VPS / Portainer et les limites](peer/README.md), et le
[Compose à copier](peer/compose.portainer.yml).

## Confidentialité

Voir [confidentialite.html](confidentialite.html) : quelles données sont stockées, où,
et comment les supprimer.

## Contribuer

Le navigateur garde volontiers d'anciennes versions des modules. Après toute modification de
`js/` ou `css/`, lancer :

```bash
node cachebust.mjs
```

Le script ajoute `?v=<version>` à la feuille de style, au script d'entrée et à tous les imports.
Tous les imports d'un même module doivent porter la même version.

## Licence

[MIT](LICENSE)
