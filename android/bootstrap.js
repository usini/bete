// Android-only bootstrap, included by the prototype staging script before shared modules.
window.__BETE_ANDROID_NATIVE__ = window.__TAURI__;
window.__TAURI__ = undefined;
document.documentElement.classList.add('bete-android');
