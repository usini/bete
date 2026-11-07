$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk/27.0.12077973'
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
$tauri = Join-Path $PSScriptRoot '../desktop/node_modules/.bin/tauri.cmd'
if (!(Test-Path 'src-tauri/gen/android/gradlew.bat')) {
    & $tauri android init --ci --skip-targets-install
    if ($LASTEXITCODE -ne 0) { throw 'Initialisation Android impossible.' }
}
& $tauri android build --debug --target aarch64 --apk --ci *> build-android.log
if ($LASTEXITCODE -ne 0) {
    # Windows without Developer Mode cannot create Tauri's native-library symlink.
    $log = Get-Content build-android.log -Raw
    if ($log -notmatch 'Creation symbolic link is not allowed') { throw 'Compilation impossible : consulter android/build-android.log.' }
    $library = 'src-tauri/target/aarch64-linux-android/debug/libbete_android_proto_lib.so'
    if (!(Test-Path $library)) { throw 'Bibliothèque Android absente.' }
    $jni = 'src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a'
    New-Item -ItemType Directory -Force $jni | Out-Null
    Copy-Item -LiteralPath $library -Destination "$jni/libbete_android_proto_lib.so" -Force
    & (Join-Path $env:NDK_HOME 'toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-strip.exe') --strip-debug "$jni/libbete_android_proto_lib.so"
    if ($LASTEXITCODE -ne 0) { throw 'Réduction de la bibliothèque impossible.' }
    Push-Location src-tauri/gen/android
    try {
        & ./gradlew.bat :app:assembleArm64Debug -x :app:rustBuildArm64Debug --console=plain *> ../../../build-gradle.log
        if ($LASTEXITCODE -ne 0) { throw 'Emballage APK impossible : consulter android/build-gradle.log.' }
    } finally { Pop-Location }
}
Get-Item src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk | Select-Object FullName, Length, LastWriteTime
Write-Host "APK prêt. Ce script ne transfère et n’installe rien sur le téléphone."
