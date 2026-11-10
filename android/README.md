# Bête sur Android

Les deux applications Android réutilisent les sources web et peuvent cohabiter sur le même téléphone.

| Application | Identifiant Android | Usage |
| --- | --- | --- |
| **Bête Proto** | `eu.usini.bete2.android.proto` | APK de développement local, signé avec la clé debug |
| **Bête** | `eu.usini.bete2.android` | APK ARM64 signé avec la clé de distribution, téléchargeable sur GitHub |

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

## Publier un APK sur GitHub

La clé de distribution est créée une seule fois. Depuis un dossier hors du dépôt, exécute cette commande et choisis un mot de passe à l’invite.

```powershell
keytool -genkeypair -keystore bete-android.p12 -storetype PKCS12 -alias bete-android -keyalg RSA -keysize 3072 -validity 10000
```

Pour afficher les empreintes de la clé existante, force la langue anglaise. Certaines versions de `keytool` échouent à afficher le certificat en français avec l’erreur `MissingFormatArgumentException`.

```powershell
keytool '-J-Duser.language=en' '-J-Duser.country=US' -list -v -keystore bete-android.p12 -alias bete-android
```

Garde une copie privée du fichier et de son mot de passe. Dans GitHub, configure l’environnement **android-release**, limité à `main`. Ajoute les secrets `ANDROID_KEYSTORE_BASE64` (contenu du fichier encodé en Base64), `ANDROID_STORE_PASSWORD` et `ANDROID_KEY_PASSWORD` (même mot de passe pour ce fichier PKCS12). Renseigne l’empreinte publique SHA-256 du certificat dans la variable ou le secret `ANDROID_CERT_SHA256`.

Crée aussi un client OAuth Android pour `eu.usini.bete2.android` avec l’empreinte **SHA-1** du certificat de distribution dans le même projet Google que le prototype. Fais un export JSON du tableau avant la première installation de Bête. La nouvelle application a son propre stockage et peut importer ce fichier.

Dans **Actions → Publier Bête Android**, lance le workflow sur `main` et saisis une version `X.Y.Z` supérieure à la dernière version Android. Le workflow compile, signe et vérifie l’APK ARM64. Pour un essai, récupère l’archive **bete-android-release** dans les artefacts du run. Coche **Publier la préversion sur GitHub Releases** pour publier `bete-android-vX.Y.Z`. Les préversions Android sont séparées de la dernière release Windows.

Sur le téléphone, ouvre [les releases GitHub](https://github.com/usini/bete/releases) et télécharge l’APK de la préversion Android souhaitée. Android propose de l’installer. Répète l’opération avec une version plus récente pour mettre Bête à jour en gardant ses données locales. Chaque préversion contient aussi un manifeste avec le numéro de version et le SHA-256 de l’APK, prévu pour la future vérification des mises à jour depuis Bête.

## Limites du prototype

- Connexion Google Drive native via Google Play Services et le client OAuth Android correspondant au package et à la signature. Seul `drive.appdata` est demandé ; aucun secret client ni jeton de renouvellement n’est embarqué. Les jetons d’accès restent en mémoire. La reconnexion silencieuse ne présente jamais de consentement sans action explicite. Un échec réseau laisse le tableau local utilisable.
- La sauvegarde Drive reste manuelle, comme dans le frontend commun. La première connexion cherche la sauvegarde existante et demande confirmation avant de remplacer un tableau local non vide.
- Import d’un tableau JSON possible via le sélecteur de fichiers ; l’export Android reste à valider.
- Pas de réception depuis le menu Partager d’Android à ce stade.
- Pas de commande PC vers téléphone, pas d’exécution en arrière-plan.
- Pas de cible Windows et Android simultanée dans un même bloc pour le moment : changer la cible remplace sa référence.
- Les contrôles natifs et le lancement réel sont à tester sur téléphone après accord d’installation.
- Le prototype reste destiné aux essais USB. La version GitHub se met à jour par téléchargement de l’APK.
