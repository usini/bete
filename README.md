# Bête

## Page de présentation

La landing page est accessible sur [bete.usini.eu/home](https://bete.usini.eu/home/), via
`home/index.html`. L’application reste à la racine `/`. La page utilise uniquement des fichiers
locaux, sans police distante, contenu social chargé, analyse d’audience ou accès aux données du
tableau. Les blocs de l’aperçu se déplacent à la souris, au toucher ou avec les flèches du clavier ;
ces déplacements ne sont pas enregistrés. GitHub Pages redirige `/home` vers `/home/`.

### Publications X et Instagram

Colle une URL de publication X (`x.com/nom/status/123…`, liens `twitter.com` également acceptés)
ou Instagram (`instagram.com/p/code/`, `instagram.com/reel/code/`) dans un rectangle.
Le module officiel apparaît automatiquement lorsque le bloc est visible, avec le bouton
« Interagir avec le post » et la manipulation normale du bloc par défaut. Une image personnalisée
prend la priorité ; les profils, stories et liens courts non résolus restent des liens.
Les publications doivent être publiques et autoriser l’intégration. Le fournisseur peut afficher
une demande de connexion ou un contenu indisponible. Aucun proxy, SDK dans la page Bête ou clé API
n’est ajouté. Pour X, l’URL du module comprend `dnt=true`, sans garantie d’absence de suivi.

### Cartes Google Maps

Colle dans un rectangle l’URL `https://www.google.com/maps/embed?pb=…`, ou le code `<iframe>`
copié depuis Google Maps → Partager → Intégrer une carte. Seule l’URL Maps reconnue est conservée,
jamais le HTML ni ses scripts ou attributs. Aucun compte développeur ni clé API Bête n’est ajouté.
Les liens Maps ordinaires et raccourcis restent des liens.

La carte visible se charge directement depuis Google. Les gestes déplacent et redimensionnent
le bloc par défaut ; « Interagir avec la carte » active ses commandes, puis « Manipuler le bloc »
ou un clic en dehors revient au tableau. Une image personnalisée prend la priorité. Les cartes
hors écran sont déchargées et leur URL suit les sauvegardes et le partage du groupe.

Les blocs contenant un lien Amazon affichent une petite étiquette avec le logo à gauche de leur
coin supérieur. Elle est accolée au bloc et sa taille suit ses dimensions. Le logo est embarqué
localement, sans requête vers Amazon.
Un double-clic sur un bloc Amazon sans image ouvre l’édition ; une fois l’image ajoutée, il ouvre
le lien produit. Le mode lecture seule sur mobile continue d’interdire l’édition.
Dans « Livraison », coller un texte comme « Livraison GRATUITE vendredi 6 novembre pour les
membres Prime » extrait la date française et la convertit en nombre de jours calendaires depuis
aujourd’hui. Le calcul est local, au collage ; le délai enregistré ne décrémente pas ensuite.
Sans année, la prochaine occurrence de la date est retenue. Un texte sans date reconnue reste libre.
Les étiquettes de texte au-dessus des blocs suivent également leurs dimensions : hauteur,
typographie, icônes et espacements restent proportionnels, avec une zone cliquable adaptée.

### Publications Facebook

Un rectangle contenant un lien direct vers un post Facebook charge automatiquement son intégration
officielle lorsqu’il est visible. Les formats `/nom/posts/id`, `permalink.php` et `story.php`
(avec `story_fbid` et `id`) et les reels `/reel/123456789/` sont reconnus. Les reels utilisent le
lecteur vidéo officiel, sans lecture automatique. Les liens de groupes (`/groups/`) restent de simples liens,
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
  Le redimensionnement automatique inclut le logo et l’étiquette produit des blocs Amazon.
  Chaque groupe a un lien dans le menu pour s'y rendre d'un clic.
- **Vidéos YouTube** : un lien YouTube dans le texte d'un bloc affiche la miniature et le titre ;
  un double-clic lance la vidéo.
- **Lien glissé depuis le navigateur** : crée un rectangle à l’endroit du dépôt. Le titre ou texte du lien fourni par le navigateur est placé dans le bloc, et l’URL dans son champ lien. Aucune récupération du titre sur le réseau ; sans titre, le nom du site est affiché. YouTube et Amazon gardent leur présentation habituelle.
- **Lien collé dans un rectangle** : hors YouTube et Amazon, l’adresse passe dans le label et le nom du site apparaît dans le rectangle. Aucun favicon ni aperçu n’est demandé au site lié.
- **Ctrl+V sur le tableau** : le texte du presse-papiers crée un rectangle au centre de la vue,
  en conservant les retours à la ligne (20 000 caractères maximum). Une URL sans rectangle
  sélectionné crée aussi son bloc. Dans les champs d’édition, le collage reste normal.
- **Liens** : chaque bloc peut avoir un lien, affiché dans une pastille au-dessus ; un double-clic l'ouvre.
- **Produits Amazon** : un lien Amazon est raccourci, et on peut y noter nom, prix et délai de livraison.
- **Actions du bloc sélectionné** : édition, palette de couleurs et corbeille directement à côté du bloc. La corbeille demande une confirmation ; les touches Suppr et Retour arrière suppriment immédiatement (annulable dans l’historique).
  La palette inclut le rouge et le transparent : fond et bordure du bloc transparents, label blanc
  avec texte noir. Le titre d’un groupe transparent reste sur fond blanc. Ces couleurs sont conservées
  dans les sauvegardes et les groupes partagés.
- **Édition** : une popup pour modifier le texte, le lien et l'image (choix d'un fichier ou collage).
- **Annuler / rétablir** : Ctrl+Z et Ctrl+Maj+Z (ou Ctrl+Y), boutons en haut à gauche, et une liste des
  60 dernières actions où l'on peut revenir à n'importe quel état (historique conservé dans la sauvegarde locale et les fichiers JSON, y compris sur Drive).
- **Double-clic dans le vide** : crée un rectangle à cet endroit.
- **Animation** : déplacement élastique des blocs, avec un léger étirement ; désactivé si le système demande moins d’animations.
- **Navigation** : déplacement, zoom (molette ou pincement), minimap, alignement automatique des blocs.
- **Sauvegarde** : enregistrement automatique dans IndexedDB pour toutes les données locales
  (tableau, historique, images, réglages, Drive et partages), export et import d'un fichier JSON.
  Les anciennes données `localStorage` sont migrées automatiquement puis retirées après validation
  de l’écriture, en conservant les images déjà présentes dans la base `bete2`.
  Une erreur de stockage affiche une alerte persistante demandant un export JSON et un avertissement
  avant de quitter lorsque le navigateur le permet. IndexedDB a aussi un quota, géré par le navigateur.
  Les exports JSON et les sauvegardes Drive utilisent un catalogue d’images unique (format 2) :
  l’historique référence les images au lieu de recopier leur base64 dans chaque état. Les anciens
  fichiers restent importables. « Vider l’historique » dans la liste des actions conserve le tableau
  courant et supprime les étapes annuler/rétablir après confirmation. Les fichiers exportés et la
  sauvegarde Drive existante ne sont mis à jour qu’au prochain export ou à la prochaine sauvegarde.
- **Google Drive (facultatif)** : sauvegarde manuelle du tableau dans un dossier caché de ton Drive
  (droit `drive.appdata` uniquement), en cliquant sur la disquette. Aucun transfert périodique,
  au retour sur l’onglet ou à la fermeture. La connexion initiale compare les versions ; à chaque ouverture,
  une nouvelle version Drive est restaurée si le tableau local est intact. En cas de conflit, Bête
  propose de restaurer ou de garder le tableau local. Aucun envoi vers Drive ne part à l’ouverture.
  En cas de conflit lors d’une sauvegarde, tu choisis la version à conserver.
  La disquette à côté de l’historique apparaît uniquement si Drive est configuré : rouge pendant la
  reconnexion, jaune pour les modifications en attente, verte quand tout est sauvegardé et rouge
  clignotante en cas d’échec. Un clic permet de sauvegarder, résoudre un conflit ou se reconnecter.
  La disquette s’anime pendant les opérations et au clic ; des notifications indiquent la connexion,
  la sauvegarde en cours, sa réussite ou un échec. Elles sont locales et disparaissent automatiquement.
  Le menu conserve seulement la connexion initiale, Restaurer et Déconnecter.
  À côté de la disquette, la taille du prochain JSON Drive inclut les images dédupliquées et
  l’historique. Elle est recalculée localement après les modifications, sans envoi réseau.
  Quitter ou recharger la page avec des modifications non sauvegardées sur Drive déclenche
  l’avertissement standard du navigateur, sans lancer d’envoi. La version locale reste enregistrée
  automatiquement. Certains navigateurs mobiles ne permettent pas cet avertissement à la fermeture.

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
**Verrouiller** protège les gestes sur le tableau : création dans le vide, déplacement, taille,
édition, couleurs, suppression, annuler/rétablir, collage et dépôt de fichiers/liens.
Le menu reste entièrement utilisable, notamment pour ajouter un bloc, importer un JSON ou
restaurer Drive. Un cadenas près de la disquette indique le verrouillage ; il disparaît dès
que le tableau est déverrouillé.
Il est local à cet appareil, non sauvegardé, et ne change pas les droits des autres participants.
Les fenêtres desktop étroites restent éditables normalement.

## Lire un tableau public depuis GitHub

Exporte un tableau Bête en JSON et place-le dans un dépôt public, à la racine de la branche `main`. Ouvre ensuite `https://bete.usini.eu/?github=COMPTE-DEPOT-FICHIER` avec le nom du fichier sans `.json`. Si le compte ou le dépôt contient un tiret, utilise `?github=COMPTE/DEPOT/FICHIER`.

Le tableau est en lecture seule. À chaque ouverture, Bête redemande le JSON à GitHub avec une URL horodatée pour contourner le cache. Le lien apparaît dans **Voir les groupes → Tableaux externes** sur ce navigateur. Publie uniquement un export dont tu souhaites rendre le contenu public, y compris son historique.

## Partager un groupe

Le menu permet de choisir un nom affiché. Sans nom, Bête conserve un nom local du type « Invité K7M2 ».
L’hôte accepte ou refuse chaque nouvel appareil avant que le contenu du groupe lui soit envoyé.
Les accords restent en mémoire pendant le partage et sont redemandés après rechargement de l’hôte.

Les groupes dont le partage est activé affichent une bordure bleue lumineuse en rotation,
inspirée de [CSS Glow Border Animation de liyrofx](https://codepen.io/liyrofx/pen/poVZeEG).
L’effet est dessiné localement dans le canvas, sans requête CodePen, sans modifier les sauvegardes
ni envoyer de messages de présence. Il reste fixe si la réduction des animations est activée,
et cesse d’animer lorsque les groupes sont hors écran ou le partage désactivé.
La bordure fait 10 pixels à l’écran, avec un halo de 32 pixels.
Les curseurs en mouvement sont transmis au plus toutes les 150 ms (environ 7 fois par seconde),
puis lissés localement entre les positions reçues. Un curseur immobile n’envoie qu’un maintien
de présence toutes les 2 secondes. Les positions sont abandonnées si le canal est encombré ;
elles ne s’accumulent pas derrière les images. Aucun état d’animation n’est sauvegardé.
Les images sont envoyées par morceaux de 12 Kio pour rester sous le seuil de fragmentation
PeerJS ; les morceaux de 32 Kio des anciennes versions et les vues binaires réassemblées sont
également acceptés. Une reconnexion permet de redemander immédiatement les images manquantes.

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

### Copier un produit Amazon depuis le navigateur

L’extension locale Chrome/Edge est dans `extension-amazon/` : voir son [guide](extension-amazon/README.md). Sur une fiche Amazon, clique sur **Copier le bloc**, puis fais **Ctrl+V** dans Bête web ou desktop (version contenant cette fonctionnalité). Un nouveau bloc est créé avec les champs trouvés et l’image intégrée. Le prix et la livraison sont une photographie des informations affichées, sans suivi automatique.

Au relâchement d’un bloc déplacé sur un autre, le bloc déplacé rejoint la position libre la plus proche, avec une marge. Les étiquettes et logos sont inclus. Un bloc déplacé au contact d’un groupe y est ajouté, à une position libre sans chevaucher les autres blocs ; le groupe s’agrandit si nécessaire. Un groupe déplacé sur un bloc extérieur est repoussé avec son contenu initial, sans intégrer ce bloc.

Pendant le déplacement d’un bloc, le groupe visé est surligné en vert avec « Ajouter au groupe ». L’indicateur disparaît au relâchement ou lorsque le bloc quitte le groupe.

Dans **Modifier le groupe → Aligner**, un aperçu propose une ligne, une colonne ou des rangées selon la disposition existante. Les proportions proches sont uniformisées dans une ligne/colonne ; les formats différents et les ensembles isolés sont conservés. **Valider** applique le rangement, **Annuler** ne change rien ; Ctrl+Z permet de revenir en arrière. Première version heuristique à ajuster à l’usage.

Raccourcis hors saisie : **R** crée un rectangle au curseur et ouvre son éditeur, **G** fait de même pour un groupe, **M** ouvre ou ferme le menu, **T** ouvre le tableau des groupes et **A** applique directement l’alignement du dernier groupe sélectionné (annulable avec Ctrl+Z). Sans position connue du curseur, la création se fait au centre de la vue.

Coller ou déposer un lien Amazon simple ouvre automatiquement l’éditeur du produit. Le bloc complet copié par l’extension conserve son import direct.

**Optimiser les images** vide aussi l’historique annuler/rétablir après traitement. Les images protégées restent intactes. Le lien d’accueil `https://chatgpt.com` affiche une icône ChatGPT embarquée.

Sur desktop, fermer Bête affiche **Sauvegarde en cours**, optimise les images, vide l’historique et attend la sauvegarde Google Drive si le compte est connecté, puis ferme la fenêtre. En cas d’erreur de sauvegarde ou de conflit Drive, l’application reste ouverte. Sans connexion Drive, seule la sauvegarde locale est effectuée.

Les liens d’accueil Google Agenda acceptent aussi les variantes de compte et de langue, par exemple `https://calendar.google.com/calendar/u/1/r?hl=fr`.

Les nouveaux blocs masquent par défaut l’étiquette de lien au-dessus du bloc. Décoche **Masquer le lien au-dessus du bloc** dans l’éditeur pour l’afficher. Les blocs existants et leurs réglages sont conservés.

Les liens de dépôts GitHub publics collés ou déposés affichent le nom, la description, le langage, la licence, les étoiles, la dernière version publiée et la date d’activité lorsque disponibles. Les informations sont demandées directement à l’API GitHub sans connexion, puis conservées avec le bloc. **Actualiser les informations GitHub** dans l’éditeur relance la récupération. Pour un dépôt privé, inexistant, une erreur réseau ou une limite API, seule l’icône GitHub et `compte/repo` sont affichés. Le lien d’accueil GitHub garde son icône. Aucun chargement automatique au simple affichage d’un tableau importé ou partagé.

Les produits Amazon collés depuis l’extension reprennent la taille de création des rectangles (dernière taille utilisée), au lieu des dimensions de l’image fournies par l’extension.

Dès l’ajout ou le remplacement d’une image (collage, dépôt, éditeur ou extension Amazon), le bloc conserve sa largeur de création et ajuste sa hauteur au ratio de l’image, en réservant la place du texte éventuel.

Sur Windows, **Ctrl+Alt+Espace** restaure Bête et ouvre sa barre de commande depuis une autre application. Le menu permet de modifier, activer ou désactiver le raccourci ; ces réglages sont conservés sur l’appareil. En cas de conflit, choisis une autre combinaison. Bête doit rester lancée, éventuellement réduite.

Dans **Voir les groupes → Tableaux externes**, ajoute manuellement un lien de tableau Bête (`?github=…`), un identifiant `COMPTE/DEPOT/FICHIER`, ou le lien GitHub/raw d’un JSON à la racine de la branche `main`. Le lien est enregistré sur cet appareil ; le téléchargement commence uniquement à l’ouverture du tableau. **Retirer** supprime seulement le raccourci local, jamais le fichier GitHub. La liste reste accessible même sans groupe local.

À la fermeture desktop, aucun envoi Drive n’est effectué si le tableau et son historique correspondent à la dernière sauvegarde. Vider un historique déjà vide ne modifie plus sa date ; une optimisation réelle ou un nettoyage effectif de l’historique reste une modification à sauvegarder.

**F**, lorsqu’un groupe est sélectionné, cadre la vue sur ce groupe. Ce raccourci reste inactif pendant la saisie.

**Ctrl+S** lance la sauvegarde Google Drive (connexion préalable nécessaire). **V** bascule le verrouillage du tableau sur mobile comme sur ordinateur ; le bouton du menu est aussi disponible sur ordinateur. Le verrouillage bloque les modifications locales mais permet toujours la navigation et la sauvegarde. Les tableaux externes restent toujours en lecture seule.

## Blocs d’applications Windows

Dépose un raccourci `.lnk` sans arguments, un `.exe` local ou un raccourci Steam `.url`. Les liens `steam://rungameid/123` et `steam://run/123` peuvent aussi être collés ou déposés. Les autres commandes Steam sont refusées. Un clic sur le bloc demande une autorisation Windows individuelle avant le premier lancement. L’ouverture globale est désactivée au départ ; le menu permet de la désactiver ou réactiver, toujours avec confirmation native.

Une croix rouge indique un bloc non autorisé, ou un lancement global désactivé. Sur le web, elle reste toujours affichée et aucun programme n’est lancé. Les chemins des exécutables et toutes les autorisations restent dans la configuration locale Windows, hors des tableaux, historiques, exports, sauvegardes Drive et partages. Supprimer le bloc révoque son autorisation ; Ctrl+Z, duplication et import nécessitent une nouvelle validation. Sur un autre ordinateur, un raccourci `.exe`/`.lnk` doit être déposé localement à nouveau.

Les chemins réseau/amovibles, les scripts, les interpréteurs usuels et les raccourcis avec arguments sont refusés. Un changement du contenu de l’exécutable exige une nouvelle confirmation. Voir [la note de sécurité](SECURITE-APPLICATIONS.md).

Depuis la barre de commande appelée par la hotkey Windows, l’ouverture réussie d’un lien ou d’une application réduit Bête. L’ouverture locale avec Espace conserve la fenêtre.

Déplacer ou zoomer la vue, déplacer ou redimensionner la fenêtre Windows ne déclenche pas de sauvegarde Drive. Si le contenu et l’historique sont déjà sauvegardés, la fermeture conserve uniquement la vue en local et ne lance pas un nettoyage automatique susceptible de créer une modification artificielle.

Sous Windows, **Menu → Applications sur cet ordinateur → Ajouter une application…** permet aussi de choisir un `.lnk`, `.exe` ou `.url` Steam via le sélecteur natif. Il crée un bloc non autorisé, à valider individuellement au premier clic. Si un dépôt ne transmet pas le fichier, Bête affiche désormais une erreur et propose ce parcours. Le tableau doit être déverrouillé (V).
