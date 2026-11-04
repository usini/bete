# Bête pour Windows

La version desktop utilise Tauri et WebView2. Elle embarque les fichiers de l’application web et utilise un stockage local séparé. Pour transférer un tableau depuis le navigateur, exporte son JSON puis importe-le dans l’application Windows.

## Tester et construire

Avec Node.js, Rust MSVC et les outils de compilation Visual Studio pour C++, depuis ce dossier :

```powershell
npm ci
npm run start
npm run build
```

L’installateur NSIS de test se trouve dans `src-tauri/target/release/bundle/nsis/`. Les liens HTTP et HTTPS s’ouvrent dans le navigateur par défaut. Tu peux aussi glisser une URL depuis ton navigateur vers le tableau pour créer un bloc. Pour rejoindre un groupe, colle son lien dans le champ du menu. La version Windows conserve la sauvegarde locale et l’import/export JSON.

## Calendrier iCal

Clique sur la date ou l’heure, colle ton lien iCal HTTPS ou webcal et clique sur **Enregistrer le lien**. Le calendrier affiche le mois et les événements du jour sélectionné. Le prochain événement s’affiche sous l’horloge. L’application recharge le flux au démarrage et à l’ouverture du calendrier. Le lien reste dans le Gestionnaire d’identifiants Windows. Il est possible de le remplacer ou de le retirer depuis le calendrier.

## Activer Google Drive dans le build Windows

Crée un client OAuth **Application de bureau** dans le même projet Google Cloud que Bête Web. Depuis le dossier `desktop`, dans ton PowerShell, lance :

```powershell
$env:BETE_GOOGLE_DESKTOP_CLIENT_ID = Read-Host 'ID du client OAuth Desktop'
$desktopSecret = Read-Host 'Secret du client OAuth Desktop' -AsSecureString
$env:BETE_GOOGLE_DESKTOP_CLIENT_SECRET = [System.Net.NetworkCredential]::new('', $desktopSecret).Password
try {
    npm.cmd run build
} finally {
    Remove-Item Env:BETE_GOOGLE_DESKTOP_CLIENT_ID, Env:BETE_GOOGLE_DESKTOP_CLIENT_SECRET
    Remove-Variable desktopSecret
}
```

Pour une release signée, utilise `npm.cmd run release:build` dans le même bloc. Les identifiants du client OAuth Desktop sont intégrés au binaire et extractibles. Utilise uniquement ceux du client Desktop dédié.

Après installation, ouvre **Menu → Google Drive → Connecter Google Drive**. Le navigateur demande l’autorisation, puis renvoie le code à Bête sur un port local temporaire. Le jeton de renouvellement est conservé dans le Gestionnaire d’identifiants Windows. Bête recherche la sauvegarde dès la connexion et la restaure si le tableau local est vide. Si le tableau contient déjà des blocs, Bête demande confirmation. À chaque ouverture, une nouvelle version Drive est restaurée si le tableau local est intact. En cas de conflit, Bête demande confirmation. La disquette lance une sauvegarde à la demande.

**Déconnecter** supprime le jeton de cet appareil. Tu peux révoquer l’accès pour tout Bête depuis ton compte Google. La révocation côté Google peut aussi déconnecter la version web si elle partage le projet OAuth.

## Publier une version avec mises à jour

Sous Windows, double-clique sur [Publier-Bete.cmd](Publier-Bete.cmd). Choisis le fichier de clé privée Tauri ou colle sa valeur depuis KeePass. Colle aussi la valeur **Public key**. Si un fichier `.pub` se trouve à côté de la clé privée, le champ est prérempli. La clé privée collée et le mot de passe sont masqués et transmis au processus de compilation sans fichier temporaire. Tu peux aussi cocher **Activer Google Drive** et coller les deux valeurs OAuth Desktop. L’outil propose la version mineure suivante (par exemple `0.1.0` → `0.2.0`) et te laisse modifier le numéro. Le bouton de compilation prépare les fichiers localement. La publication dans GitHub Releases reste manuelle.

Si tu n’as pas encore de clé, crée-la une fois avec `npx tauri signer generate -w <chemin-hors-du-dépôt>` depuis ce dossier et garde la même clé pour les prochaines versions. La clé publique est intégrée à l’application pour vérifier les mises à jour.

### En ligne de commande

1. Génère une paire de clés Tauri avec `npx tauri signer generate` et conserve la clé privée hors du dépôt. Utilise une clé dédiée à cette version de Bête et conserve-la pour les versions suivantes.
2. Renseigne `BETE_UPDATER_PUBLIC_KEY` avec le contenu de la clé publique, `TAURI_SIGNING_PRIVATE_KEY` avec la clé privée ou son chemin et, si nécessaire, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. Incrémente la version dans `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` et `package.json`, puis actualise les fichiers de verrouillage.
4. Lance `npm run release:build`. Le dossier `release-output/bete-desktop-v<VERSION>/` contient l’installateur, la signature et le manifeste. Joins les trois fichiers à une release publique de `usini/bete` avec ce tag exact et définis-la comme dernière release. Le manifeste contient déjà l’URL de téléchargement et la signature.
5. Teste la mise à jour depuis la version précédente avant d’annoncer la release. Au démarrage, l’application propose **Installer maintenant**, **Plus tard** ou **Installer à la fermeture**. **Plus tard** reporte la proposition au prochain lancement.

L’installateur de test désactive la recherche de mises à jour. La signature Tauri authentifie les mises à jour. Pour identifier l’éditeur dans Windows, configure aussi la signature Authenticode.

[Format du manifeste de mise à jour](https://v2.tauri.app/plugin/updater/#static-json-file) · [Signature Windows](https://v2.tauri.app/distribute/sign/windows/)

### Depuis GitHub Actions

Dans les paramètres du dépôt, crée un environnement **desktop-release** et limite-le à la branche `main`. Ajoute les valeurs suivantes dans cet environnement.

| Type | Nom | Valeur |
|---|---|---|
| Variable | `BETE_UPDATER_PUBLIC_KEY` | Clé publique Tauri utilisée par la version 0.2.0 |
| Secret | `TAURI_SIGNING_PRIVATE_KEY` | Texte de la clé privée correspondante |
| Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe de la clé, si elle est protégée |
| Variable | `BETE_GOOGLE_DESKTOP_CLIENT_ID` | ID du client OAuth Desktop |
| Secret | `BETE_GOOGLE_DESKTOP_CLIENT_SECRET` | Secret du client OAuth Desktop |

Dans **Actions → Publier Bête Windows → Run workflow**, sélectionne `main` et saisis une version supérieure à celle publiée. Le job de compilation signe les fichiers. Un job distinct vérifie le manifeste et la continuité de la clé de signature, puis publie la release. Chaque push sur `main` déclenche aussi une release Windows et incrémente la version publiée de `0.0.1`. Les publications passent une par une dans la file GitHub Actions.

Pour un changement réservé au web, ajoute `[skip windows]` au message du dernier commit poussé. GitHub Pages se déploie et le job de compilation Windows est ignoré.
