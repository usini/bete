# Bête

### Publications Facebook

Un rectangle contenant un lien direct vers un post Facebook charge automatiquement son intégration
officielle lorsqu’il est visible. Les formats `/nom/posts/id`, `permalink.php` et `story.php`
(avec `story_fbid` et `id`) sont reconnus. Les liens de groupes (`/groups/`) restent de simples liens,
sans tentative de chargement. Les liens courts `/share/`, profils et pages ne sont pas résolus. Seuls les posts publics autorisant
l’intégration peuvent fonctionner. Une image choisie manuellement prend la priorité.

Le module suit le zoom et la taille du bloc. Par défaut, les gestes traversent le post pour déplacer
ou redimensionner le rectangle normalement. « Interagir avec le post » active les liens et le
défilement Facebook ; « Manipuler le bloc », un clic en dehors ou Échap revient au tableau.
Le navigateur contacte directement Meta, également
pour les participants d’un groupe partagé ; le module est retiré hors écran. Aucun proxy,
SDK Meta, jeton ou récupération de contenu côté serveur n’est ajouté.

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
- **Lien glissé depuis le navigateur** : crée un rectangle à l’endroit du dépôt. Le titre ou texte du lien fourni par le navigateur est placé dans le bloc, et l’URL dans son champ lien. Aucune récupération du titre sur le réseau ; sans titre, le nom du site est affiché. YouTube et Amazon gardent leur présentation habituelle.
- **Lien collé dans un rectangle** : hors YouTube et Amazon, l’adresse passe dans le label et le nom du site apparaît dans le rectangle. Aucun favicon ni aperçu n’est demandé au site lié.
- **Liens** : chaque bloc peut avoir un lien, affiché dans une pastille au-dessus ; un double-clic l'ouvre.
- **Produits Amazon** : un lien Amazon est raccourci, et on peut y noter nom, prix et délai de livraison.
- **Actions du bloc sélectionné** : édition, palette de couleurs et corbeille directement à côté du bloc. La suppression demande une confirmation.
- **Édition** : une popup pour modifier le texte, le lien et l'image (choix d'un fichier ou collage).
- **Annuler / rétablir** : Ctrl+Z et Ctrl+Maj+Z (ou Ctrl+Y), boutons en haut à gauche, et une liste des
  60 dernières actions où l'on peut revenir à n'importe quel état (historique conservé dans la sauvegarde locale et les fichiers JSON, y compris sur Drive).
- **Double-clic dans le vide** : crée un rectangle à cet endroit.
- **Animation** : déplacement élastique des blocs, avec un léger étirement ; désactivé si le système demande moins d’animations.
- **Navigation** : déplacement, zoom (molette ou pincement), minimap, alignement automatique des blocs.
- **Sauvegarde** : enregistrement automatique dans le navigateur (localStorage et IndexedDB),
  export et import d'un fichier JSON.
- **Google Drive (facultatif)** : sauvegarde automatique du tableau dans un dossier caché de ton Drive
  (droit `drive.appdata` uniquement). Vérification toutes les 30 secondes et envoi uniquement si le tableau a changé,
  si le réseau et la session le permettent.
  Aucun envoi si le contenu est inchangé. Un conflit suspend la sauvegarde et affiche un message
  dans le panneau ; un clic sur la disquette permet de choisir la version sans interruption automatique.
  La disquette à côté de l’historique apparaît uniquement si Drive est configuré : rouge pendant la
  reconnexion, jaune pour les modifications en attente, verte quand tout est sauvegardé et rouge
  clignotante en cas d’échec. Un clic permet de sauvegarder, résoudre un conflit ou se reconnecter.
  La disquette s’anime pendant les opérations et au clic ; des notifications indiquent la connexion,
  la sauvegarde en cours, sa réussite ou un échec. Elles sont locales et disparaissent automatiquement.
  Le menu conserve seulement la connexion initiale, Restaurer et Déconnecter.
  Quitter la page avant que tout soit sauvegardé déclenche l'envoi immédiat et un avertissement du navigateur.

Les tableaux ne sont pas envoyés au serveur de Bête. Les appels réseau sont ceux de YouTube :
miniatures (`i.ytimg.com`), titres (oEmbed) et lecteur (`youtube-nocookie.com`) ; et, seulement si tu
actives la sauvegarde, ceux de Google et du service OAuth `auth-bete.usini.eu`. Ce service renouvelle
les autorisations sans stocker les tableaux. Le partage P2P facultatif contacte aussi
`peer-bete.usini.eu`, STUN Google et les participants autorisés. Le jeton de renouvellement reste chiffré dans un cookie
HttpOnly du navigateur ; le service le traite temporairement.

Déploiement VPS / Portainer / Cloudflare Tunnel : voir [auth/README.md](auth/README.md)
et le Compose autonome [auth/compose.portainer.yml](auth/compose.portainer.yml).

## Icônes des services connus

Certains liens affichent une icône intégrée au lieu du texte dans le rectangle. L’URL reste dans
le champ lien et le label. Le texte existant est conservé dans les données ; une image choisie
manuellement reste prioritaire. Aucun favicon, téléchargement d’icône tiers ou appel vers le service.

| Service | URL reconnue |
| --- | --- |
| Gmail | `mail.google.com` et `gmail.com`, tous chemins, paramètres et fragments |
| YouTube | `youtube.com` / `www.youtube.com`, accueil `/` uniquement |
| Facebook | `facebook.com` / `www.facebook.com`, accueil `/` uniquement |
| X | `x.com/home` uniquement (avec ou sans `www`) |
| Google | accueil `google.com` ou `google.fr` |
| Drive | accueil et `/drive[/u/N][/home ou /my-drive]` |
| Agenda | accueil et `/calendar[/u/N][/r]` |
| Maps | `maps.google.com` à l’accueil ou `google.com/maps` (aussi `.fr`) |
| Docs / Sheets / Slides | accueil du service sur `docs.google.com`, y compris `/u/N/` ; pas les fichiers `/d/…` |
| Outlook | accueil et `/mail[/N][/inbox]` sur `outlook.live.com`, `outlook.office.com` ou `outlook.office365.com` |
| Instagram | accueil uniquement |
| LinkedIn | accueil ou `/feed` |
| WhatsApp | accueil de `web.whatsapp.com` ou `whatsapp.com` |
| Discord | accueil, `/app` ou `/channels/@me` |
| GitHub | accueil ou `/dashboard` |
| Spotify | accueil ou `/home` |
| Reddit / Twitch | accueil uniquement |
| Telegram | accueil de `web.telegram.org`, `/a` ou `/k` |

Hors Gmail, la reconnaissance est volontairement limitée aux entrées de l’application **sans
paramètres ni fragment**, en HTTPS, sur les domaines exacts. Les vidéos, profils, publications,
recherches et fichiers précis conservent leur traitement habituel. Les liens ordinaires restent du texte.
Les icônes et leurs sources se trouvent dans [img/services](img/services/README.md).

## Mobile : lecture seule par défaut

À chaque ouverture sur un appareil tactile sans pointeur précis, le tableau est verrouillé.
Déplacement de la vue, pincement pour zoomer, lecture des liens/vidéos et réception des changements
partagés restent disponibles. Le bouton **Déverrouiller** du menu autorise les modifications ;
**Verrouiller** remet la lecture seule. Le verrouillage bloque création, déplacement, taille,
édition, couleurs, suppression, annuler/rétablir, collage, dépôt, import et restauration manuelle.
Il est local à cet appareil, non sauvegardé, et ne change pas les droits des autres participants.
Les fenêtres desktop étroites restent éditables normalement.

## Partager un groupe

Sélectionne un groupe puis clique sur l’icône **QR code**, sous 🎨. La fenêtre propose le QR,
le lien, **Activer / Désactiver le partage** et **Régénérer le lien** (sur l’appareil source).
Tous les participants peuvent modifier. Le lien ajoute ce groupe à leur tableau infini, dans
un espace libre, ou retrouve sa copie par ID ; les autres blocs et l’historique ne sont pas envoyés.
La position du groupe et la caméra restent propres à chaque appareil ; la disposition interne est partagée.
Sous la date, un indicateur affiche le partage actif et le nombre de participants connectés, toi inclus
(sans compter deux fois une personne présente dans plusieurs groupes).
Les curseurs des participants sont visibles uniquement à l’intérieur du groupe partagé, avec une couleur
et un identifiant temporaire. Ils ne sont pas enregistrés dans les sauvegardes.

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
