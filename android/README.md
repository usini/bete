# Prototype Android de Bête

Application Tauri Android isolée (`eu.usini.bete2.android.proto`), nommée **Bête Proto**. Elle réutilise les sources web ; le code Rust et les composants Windows ne sont pas compilés pour Android.

Inclus : tableau local hors connexion, mode lecture au démarrage, édition tactile après déverrouillage, recherche via la loupe, agenda sauvegardé, sélecteur natif d’applications, icônes et lancement local via un bloc ou la recherche. Les URL web s’ouvrent avec Android.

Pour les applications, activer la fonction dans le menu, choisir une application puis valider individuellement son bloc au premier lancement. Accepter l’autorisation ne lance pas l’application ; un nouveau double appui ou une sélection dans la recherche lance l’application. La cible et les autorisations sont conservées dans les préférences privées Android, exclues des sauvegardes Android et des tableaux. Supprimer un bloc ou changer sa cible supprime son autorisation à la synchronisation locale. Les blocs Windows importés nécessitent de choisir une cible sur ce téléphone via l’éditeur.

## Compiler sur Windows

Prérequis : dépendances npm de `desktop`, Rust avec la cible `aarch64-linux-android`, Android Studio/JBR, SDK Android 36 et NDK `27.0.12077973`. Le script utilise le SDK de `%LOCALAPPDATA%/Android/Sdk` si `ANDROID_HOME` est absent.

```powershell
./android/build.ps1
```

Le script compile un APK de test ARM64, signé avec la clé debug locale. Sans mode développeur Windows, il remplace le lien symbolique Tauri par une copie de la bibliothèque compilée. Il ne modifie pas les paramètres système, ne transfère aucun fichier sur le téléphone et ne lance aucune installation.

APK : `android/src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`.

Le projet Gradle généré est ignoré par Git. `stage.mjs` recopie le frontend, le bootstrap et le plugin Kotlin versionnés, puis configure les outils Android stables. Aucun fichier du tableau personnel n’est embarqué.

## Limites du prototype

- Connexion Google Drive native via Google Play Services et le client OAuth Android correspondant au package et à la signature. Seul `drive.appdata` est demandé ; aucun secret client ni jeton de renouvellement n’est embarqué. Les jetons d’accès restent en mémoire. La reconnexion silencieuse ne présente jamais de consentement sans action explicite. Un échec réseau laisse le tableau local utilisable.
- La sauvegarde Drive reste manuelle, comme dans le frontend commun. La première connexion cherche la sauvegarde existante et demande confirmation avant de remplacer un tableau local non vide.
- Import d’un tableau JSON possible via le sélecteur de fichiers ; l’export Android reste à valider.
- Pas de réception depuis le menu Partager d’Android à ce stade.
- Pas de commande PC vers téléphone, pas d’exécution en arrière-plan.
- Pas de cible Windows et Android simultanée dans un même bloc pour le moment : changer la cible remplace sa référence.
- Les contrôles natifs et le lancement réel sont à tester sur téléphone après accord d’installation.
- APK de développement, destiné aux essais USB ; aucune publication Play Store ni mise à jour automatique.
