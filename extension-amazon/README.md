# Extension Amazon pour Bête

## Installation locale (Chrome ou Edge)

1. Ouvre `chrome://extensions` ou `edge://extensions`.
2. Active le **Mode développeur**.
3. Clique sur **Charger l’extension non empaquetée**, puis choisis ce dossier `extension-amazon`.
4. Épingle l’extension pour retrouver son bouton.

## Utilisation

Ouvre une fiche produit Amazon et attends son chargement. Choisis la variante souhaitée. Clique sur l’extension, puis **Copier le bloc**. Dans Bête web ou desktop à jour, ferme les fenêtres de modification et fais **Ctrl+V** sur le tableau. Un nouveau bloc est créé, même si un autre bloc est sélectionné. Les champs restent modifiables dans Bête.

L’image est intégrée au presse-papiers : aucun accès Amazon n’est nécessaire au collage. Si elle est indisponible, le bloc est copié sans image avec un message. Les champs absents restent vides. Le prix et la livraison ne sont pas actualisés automatiquement. Les pages peuvent varier et nécessiter une adaptation des sélecteurs. Cette première version vise Chrome et Edge ; Firefox n’a pas été validé.

## Permissions et données

`activeTab` et `scripting` permettent la lecture de l’onglet après ton clic ; `clipboardWrite` permet la copie. Les autorisations limitées aux trois domaines d’images Amazon permettent d’intégrer l’image. Aucun serveur, compte Bête, cookie ou accès aux commandes. Seule la zone de livraison produit est extraite, pas l’adresse du compte. Le presse-papiers contient du texte préfixé `BETE_BLOCK_V1` suivi d’un JSON ; ailleurs que dans Bête, le collage affichera ce texte.

Après modification des fichiers de l’extension, clique sur **Actualiser** dans la page des extensions. Après modification de Bête, recharge l’application locale.
