# Sécurité des blocs applications

## Autorisations

- Autorisation globale désactivée à la première utilisation et réglable avec une confirmation native Windows.
- Autorisation individuelle liée à l’identifiant du bloc, à une référence opaque locale et à l’empreinte SHA-256 de l’exécutable (ou au lien Steam normalisé). Aucune valeur `approved` provenant du tableau n’est acceptée.
- Les commandes natives de lancement ne prennent ni chemin, ni arguments, ni commande libre : elles retrouvent une destination enregistrée localement et exigent la présence du bloc dans l’ensemble courant synchronisé depuis le modèle de l’application.
- La synchronisation révoque les autorisations des blocs disparus ou dont la référence a changé. Les transitions suppression/rétablissement sont traitées dans l’ordre. Un import de tableau contenant des applications révoque les autorisations natives avant de remplacer le tableau.
- Les validations sont stockées uniquement dans `application-permissions.json`, dans le dossier de configuration Windows de Bête. Elles ne font pas partie du modèle de tableau ni de son historique.

## Surface de lancement

Le dépôt de fichier utilise l’objet File de WebView2 et récupère son chemin côté natif, sans autoriser une chaîne de chemin fournie par un tableau. La source du message doit être l’origine locale Tauri de la fenêtre. Le `.lnk` est lu par COM sans `Resolve`, ne peut avoir d’arguments et sa destination est figée comme chemin d’exécutable. Aucun shell ni interprétation de commande n’est utilisé.

Les fichiers doivent résider sur un disque fixe local. Les chemins UNC, périphériques, flux alternatifs, supports amovibles et extensions autres que `.exe` pour la cible sont refusés. Les noms d’interpréteurs et d’outils système usuels sont refusés. Une poignée de fichier interdit les écritures/suppressions pendant le calcul d’empreinte, la confirmation et le démarrage. Un binaire modifié nécessite une nouvelle validation.

Steam est limité à `steam://rungameid/<identifiant numérique>` et à l’équivalent `steam://run/<identifiant numérique>`, normalisé vers le premier. Les paramètres, commandes d’installation/désinstallation et arguments supplémentaires sont refusés. Le schéma Steam utilise le gestionnaire enregistré dans Windows.

Les pages HTTP restent ouvertes par une commande native séparée limitée à HTTP/HTTPS. La navigation de la fenêtre principale est restreinte à l’origine locale. Aucun lancement n’est disponible sur le web ou depuis le lecteur externe en lecture seule.

## Limites

Cette protection empêche un tableau d’importer ses propres autorisations et oblige à valider chaque destination. Elle n’analyse pas le comportement du programme autorisé : un exécutable malveillant explicitement approuvé reste dangereux et s’exécute avec les droits de Bête. Elle ne protège pas contre un autre programme local pouvant modifier la configuration de Bête, ni contre une compromission du code de l’application. Le modèle des blocs reste côté interface ; la couche native vérifie sa synchronisation, pas une seconde copie indépendante du tableau.
