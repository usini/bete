# Partage de groupes et PeerServer sur le VPS

Bête reste une seule page infinie. On partage **un groupe**, jamais le tableau complet.
PeerServer sert uniquement à établir les connexions WebRTC : il ne stocke pas et ne relaie pas
les blocs, les images ou les sauvegardes. Il ne remplace pas un appareil qui possède le groupe.

## Portainer et Cloudflare Tunnel

1. Dans Portainer, crée une nouvelle stack Docker Standalone et colle **tout**
   [compose.portainer.yml](compose.portainer.yml).
2. Optionnel : définis `PEER_PORT` pour changer le port local, `3200` par défaut.
3. Déploie. Le conteneur écoute sur `127.0.0.1:3200` du VPS. Aucun réseau Docker spécial,
   fichier à monter, secret, volume de données ou build n’est nécessaire.
4. Dans ton service Cloudflare Tunnel existant, ajoute une application publiée :
   - Domaine : **peer-bete.usini.eu**.
   - Type : **HTTP**.
   - Service : **127.0.0.1:3200** (ou ton `PEER_PORT`).
5. Autorise les WebSockets sur ce domaine. Pas de Cloudflare Access ni de challenge interactif
   devant le serveur, et pas de mise en cache. Évite la journalisation des URL complètes :
   les requêtes de signalisation contiennent des identifiants de connexion et des jetons PeerJS.
6. Ouvre `https://peer-bete.usini.eu/` : une réponse JSON de PeerServer confirme que la route
   HTTP fonctionne. Cela ne valide pas encore WebSocket ni une connexion entre deux réseaux.
7. Après publication du front, sélectionne un groupe, clique sur son icône QR puis
   **Activer le partage**. Ouvre le lien dans un autre navigateur ou scanne le QR sur un téléphone.
   Clique sur **Rejoindre le groupe**. Vérifie une modification dans chaque sens et une image.

Le Compose utilise Node 24 et le paquet serveur `peer@1.0.2` épinglé, installé au démarrage
dans `/tmp`, sans reprendre l’ancienne image serveur basée sur Node 18. L’installation exige
un accès sortant à npm à chaque recréation/redémarrage ; un échec empêche le démarrage et
apparaît dans les logs. Les dépendances transitives suivent les contraintes de cette version.
Le programme affiche seulement son démarrage, sans ajouter de journal par client connecté.
Il ne publie pas de liste des identifiants connectés (`allow_discovery: false`). La clé `bete`
est un paramètre de routage public de PeerJS, **pas** un mot de passe.

Le tunnel Cloudflare transporte uniquement HTTP/WebSocket de **signalisation** : aucun TURN
n’est configuré. `cloudflared` ne relaie pas le contenu des groupes. Le client utilise explicitement
un serveur STUN Google (`stun.l.google.com:19302`) pour découvrir son adresse réseau publique.
STUN n’est pas un relais de contenu. Certains NAT symétriques, pare-feux d’entreprise ou réseaux
mobiles rendent une connexion directe impossible ; dans ce cas, les copies restent locales et
l’interface signale l’échec. Il n’y a aucun basculement caché vers le TURN public de PeerJS.

## Comportement

- Un groupe a un identifiant stable (`shareId`, initialement son `id`). Le QR et le lien
  désignent ce groupe et un point de rendez-vous, avec une capacité d’accès aléatoire.
- Le lien ne remplace pas le tableau. Si le groupe est absent, il est ajouté dans un espace libre,
  en réservant aussi la place des blocs qui débordent de ses bords. Si son identifiant existe
  déjà, il est réutilisé. Les collisions d’identifiants avec des blocs privés sont remappées.
- Le groupe et les blocs dont le centre est dedans sont partagés, y compris les sous-groupes
  non partagés indépendamment. Les positions internes sont relatives au groupe. Déplacer
  l’ensemble ou la caméra sur un appareil ne change pas sa position dans le tableau des autres.
- Tous les participants peuvent modifier. Les mises à jour passent par l’appareil source,
  qui les retransmet aux invités. Elles sont envoyées après sauvegarde locale, pas à chaque frame.
  Seuls les blocs modifiés et les suppressions circulent après l’échange initial.
- Glisser un bloc dans le groupe l’ajoute au partage. Le sortir le retire chez les autres,
  mais conserve le bloc sorti sur ton tableau. Supprimer un membre se propage aux participants.
  Un agrandissement reçu d’un autre appareil n’inclut pas silencieusement des blocs privés voisins :
  il faut déplacer ces blocs pour les ajouter explicitement.
- Les curseurs sont transmis uniquement dans le groupe partagé (coordonnées relatives), au plus
  environ 20 mises à jour par seconde. Un curseur coloré porte un identifiant temporaire de participant.
  Il disparaît à la sortie du groupe, à la déconnexion ou après environ 6 secondes sans mise à jour.
  Cette présence reste en mémoire, sans historique ni sauvegarde. Les déplacements hors groupe
  ne sont pas envoyés.
- Les blocs retrouvent un déplacement élastique et un léger étirement. La géométrie logique reste
  inchangée ; les animations sont respectueuses de la préférence système de réduction des mouvements.
- Les images sont identifiées par SHA-256, transférées à la demande en morceaux de 32 Kio,
  vérifiées à réception et gardées dans IndexedDB. Elles ne sont pas renvoyées à chaque mise à jour.
  Une sauvegarde/export attend les images manquantes plutôt que les supprimer silencieusement.
- L’historique global du tableau **n’est pas partagé par P2P**. Les modifications reçues
  font partie de l’historique local, qui peut aussi être sauvegardé dans Drive selon tes réglages.
- Désactiver le partage coupe les connexions de la source. Les invités gardent leur copie.
  Pour un invité, le bouton désactive uniquement sa propre connexion. Réactiver conserve le lien.
- **Régénérer le lien**, uniquement sur l’appareil source, change le rendez-vous et la capacité
  d’accès : l’ancien lien ne rejoint plus ce partage. Les copies déjà reçues ne sont pas effaçables
  à distance. Distribue le nouveau lien aux personnes que tu veux reconnecter.
- Sans source ouverte, la copie reste utilisable hors ligne. Les modifications locales sont
  enregistrées et fusionnées à la reconnexion. Il n’y a ni serveur permanent de contenu ni
  élection automatique d’un nouvel hôte. Un navigateur en veille, notamment sur mobile,
  ne garantit pas la disponibilité du partage en arrière-plan.
- Les conflits sont résolus **par bloc entier**, avec une horloge logique et un identifiant
  de participant pour départager deux versions simultanées. Deux personnes modifiant le même bloc
  au même moment ne disposent pas d’une fusion caractère par caractère ; une version gagne.
  Les suppressions sont mémorisées pour éviter qu’une ancienne copie ressuscite un bloc.
- Limites : 1 000 éléments par groupe, 8 invités par source, 10 Mio par image (PNG, JPEG,
  WebP, GIF, AVIF ou BMP) et un journal
  de synchronisation borné. Les groupes partagés indépendamment ne doivent pas se chevaucher.

## Accès et conservation

Le lien est une autorisation de lecture **et** d’écriture. Toute personne qui le reçoit peut
le transférer et copier le contenu. Il n’y a ni liste nominative, ni compte, ni mot de passe.
La capacité reste dans le fragment `#` du lien, non envoyé dans la requête HTTP, et est retirée
de la barre d’adresse après lecture. Une authentification mutuelle HMAC lie la preuve d’accès
aux empreintes DTLS du canal WebRTC ; la capacité brute n’est pas envoyée au serveur de liaison.

Les paramètres privés de partage, les capacités et les versions/tombstones sont conservés
localement sous `bete2:groupShares`. Ils ne sont pas exportés dans le JSON ni envoyés à Drive.
Seuls les identifiants publics du groupe et son contenu le sont. Copier un JSON sur un nouvel
appareil ne lui donne donc pas les commandes de l’hôte : utilise son lien pour rejoindre le groupe.
Après effacement de toutes les données du navigateur source, il faut créer et distribuer un
nouveau lien. Deux onglets source ne peuvent pas réclamer simultanément le même rendez-vous.

## Validation

Tests sans dépendance :

```powershell
node --test tests/group-model.test.mjs auth/history.test.mjs auth/client.test.mjs auth/server.test.mjs
```

Le test navigateur `tests/group-share.browser.cjs` utilise **deux profils isolés**, un vrai
PeerServer local et Edge headless. Ses paquets de QA se trouvent dans un dossier externe
au dépôt (variable `BETE_QA_MODULES`, avec `peer@1.0.2` et `playwright`). Le client statique
n’a toujours aucun paquet npm à installer. Ces essais locaux ne valident pas le DNS, le tunnel,
le WebSocket public ni le franchissement NAT entre tes appareils réels.

Références : [PeerJS](https://peerjs.com/client/getting-started),
[PeerServer](https://github.com/peers/peerjs-server).
