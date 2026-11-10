import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const dist = new URL('./dist/', import.meta.url);
mkdirSync(dist, {recursive:true});
for (const name of ['index.html','js','css','img']) cpSync(new URL('../'+name,import.meta.url),new URL(name,dist),{recursive:true});
cpSync(new URL('./bootstrap.js',import.meta.url),new URL('android-bootstrap.js',dist));
let html=readFileSync(new URL('index.html',dist),'utf8');
html=html.replace('<head>','<head>\n<script src="./android-bootstrap.js"></script>');
writeFileSync(new URL('index.html',dist),html);
const gen=new URL('./src-tauri/gen/android/',import.meta.url);
cpSync(new URL('./native/BetePlugin.kt',import.meta.url),new URL('app/src/main/java/eu/usini/bete2/android/proto/BetePlugin.kt',gen));
const manifest=new URL('app/src/main/AndroidManifest.xml',gen);
let xml=readFileSync(manifest,'utf8');
if(!xml.includes('android:allowBackup=')) xml=xml.replace('<application','<application android:allowBackup="false"');
if(!xml.includes('<queries>'))xml=xml.replace('<application','<queries><intent><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent></queries>\n<application');
xml = xml.replace(/android:label="@string\/(?:app_name|main_activity_title)"/g, 'android:label="${beteAppName}"');
writeFileSync(manifest,xml);
// Use the installed stable Android toolchain for this isolated prototype.
const rootGradle=new URL('build.gradle.kts',gen);
writeFileSync(rootGradle,readFileSync(rootGradle,'utf8').replace(/gradle:[^"]+/, 'gradle:8.11.0'));
const wrapper=new URL('gradle/wrapper/gradle-wrapper.properties',gen);
writeFileSync(wrapper,readFileSync(wrapper,'utf8').replace(/gradle-[\d.]+-bin.zip/,'gradle-8.14.3-bin.zip'));
const appGradle=new URL('app/build.gradle.kts',gen);
let gradle=readFileSync(appGradle,'utf8').replace('compileSdk = 37','compileSdk = 36').replace('targetSdk = 37','targetSdk = 35').replace(/optimization\s*\{\s*enable = true\s*\}/,'isMinifyEnabled = true');
// Keep the Kotlin/JNI namespace fixed. Only the installed app identity changes.
const distribution = 'providers.environmentVariable("BETE_ANDROID_RELEASE").orNull == "1"';
gradle = gradle.replace(
  'applicationId = "eu.usini.bete2.android.proto"',
  `applicationId = if (${distribution}) "eu.usini.bete2.android" else "eu.usini.bete2.android.proto"`,
);
if (!gradle.includes('manifestPlaceholders["beteAppName"]')) {
  gradle = gradle.replace('defaultConfig {', `defaultConfig {
        manifestPlaceholders["beteAppName"] = if (${distribution}) "Bête" else "Bête Proto"`);
}
writeFileSync(appGradle,gradle);

// The Rust bridge loads the Kotlin plugin by its class name.
const proguard = new URL('app/proguard-rules.pro', gen);
const keepPlugin = '-keep class eu.usini.bete2.android.proto.BetePlugin { *; }';
const rules = readFileSync(proguard, 'utf8');
if (!rules.includes(keepPlugin)) writeFileSync(proguard, rules + '\n' + keepPlugin + '\n');

const buildSrc=new URL('buildSrc/build.gradle.kts',gen);
writeFileSync(buildSrc,readFileSync(buildSrc,'utf8').replace(/gradle:[^"]+/, 'gradle:8.11.0'));

// The generated Gradle task runs Node from android/src-tauri. Resolve the shared CLI from there.
const buildTask = new URL('buildSrc/src/main/java/eu/usini/bete2/android/proto/kotlin/BuildTask.kt', gen);
const task = readFileSync(buildTask, 'utf8');
writeFileSync(buildTask, task.replace(
  'listOf("tauri", "android", "android-studio-script")',
  'listOf("../../desktop/node_modules/@tauri-apps/cli/tauri.js", "android", "android-studio-script")',
));

const props=new URL('gradle.properties',gen);
let properties=readFileSync(props,'utf8');
if(!properties.includes('android.useAndroidX=true')) properties+='\nandroid.useAndroidX=true\norg.gradle.configuration-cache=false\n';
writeFileSync(props,properties);

cpSync(new URL('./native/MainActivity.kt',import.meta.url),new URL('app/src/main/java/eu/usini/bete2/android/proto/MainActivity.kt',gen));

cpSync(new URL('./native/DriveAuthorization.kt',import.meta.url),new URL('app/src/main/java/eu/usini/bete2/android/proto/DriveAuthorization.kt',gen));
let dependencies=readFileSync(appGradle,'utf8');
if(!dependencies.includes('play-services-auth:')) dependencies=dependencies.replace('dependencies {','dependencies {\n    implementation("com.google.android.gms:play-services-auth:22.0.0")');
writeFileSync(appGradle,dependencies);

cpSync(new URL('./native/launcher/',import.meta.url),new URL('app/src/main/res/',gen),{recursive:true});
console.log('Sources Android préparées.');
