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

- **Clic droit** : menu radial (créer rectangle/cercle, couleur, texte, suppr, export/import).
- **Molette** : zoom · **glisser le fond** : déplacer la vue.
- **Glisser un rectangle** : déplacement élastique.
- **Glisser le bord d'un cercle** : redimensionner · **glisser son intérieur** : déplacer.
- **Double-clic** : éditer le texte (Échap pour valider).
- **Glisser-déposer une image** : sur un rectangle pour la mettre dedans, sur le vide pour créer un rectangle-image. (« Img ✕ » dans le menu radial pour la retirer.)
- **Suppr** : effacer l'élément sélectionné.
- Un rectangle dont le centre est dans un cercle prend la couleur du cercle.

Sauvegarde automatique dans le navigateur (localStorage). Export/Import JSON via le menu radial.
