# Bête

Un tableau libre pour organiser des idées : blocs de texte, images, groupes, vidéos YouTube
et liens, sur une grande zone que l'on déplace et que l'on zoome.

100 % statique : JavaScript natif (modules ES) et canvas 2D, sans dépendance ni étape de build.

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
  60 dernières actions où l'on peut revenir à n'importe quel état (historique gardé en mémoire).
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
les autorisations sans stocker les tableaux. Le jeton de renouvellement reste chiffré dans un cookie
HttpOnly du navigateur ; le service le traite temporairement.

Déploiement VPS / Portainer / Cloudflare Tunnel : voir [auth/README.md](auth/README.md)
et le Compose autonome [auth/compose.portainer.yml](auth/compose.portainer.yml).

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
