use serde::{Deserialize, Serialize};
use std::{fs, str::FromStr, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[derive(Clone, Deserialize, Serialize)]
pub struct Settings {
    shortcut: String,
    enabled: bool,
    #[serde(default)]
    active: bool,
    #[serde(default)]
    error: Option<String>,
}
impl Default for Settings {
    fn default() -> Self {
        Self { shortcut: "Ctrl+Alt+Space".into(), enabled: true, active: false, error: None }
    }
}
pub struct ShortcutSettings(pub Mutex<Settings>);
fn parse(value: &str) -> Result<Shortcut, String> {
    if value.len() > 100 { return Err("Raccourci trop long.".into()); }
    let shortcut = Shortcut::from_str(value).map_err(|_| "Raccourci invalide. Exemple : Ctrl+Alt+Space.".to_string())?;
    if !shortcut.mods.intersects(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SUPER) {
        return Err("Ajoute au moins Ctrl, Alt ou Win au raccourci.".into());
    }
    Ok(shortcut)
}
fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let folder = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    Ok(folder.join("global-shortcut.json"))
}
pub fn init(app: &AppHandle) {
    let mut settings = config_path(app).ok().and_then(|p| fs::read(p).ok())
        .and_then(|bytes| serde_json::from_slice::<Settings>(&bytes).ok()).unwrap_or_default();
    settings.active = false;
    settings.error = None;
    if settings.enabled {
        match parse(&settings.shortcut).and_then(|key| app.global_shortcut().register(key).map_err(|e| e.to_string())) {
            Ok(()) => settings.active = true,
            Err(_) => settings.error = Some("Raccourci indisponible ou invalide. Modifie-le dans le menu.".into()),
        }
    }
    app.manage(ShortcutSettings(Mutex::new(settings)));
}
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new().with_handler(|app, _, event| {
        if event.state != ShortcutState::Pressed { return; }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("bete-open-command-search", ());
        }
    }).build()
}
#[tauri::command]
pub fn get_global_shortcut(app: AppHandle) -> Result<Settings, String> {
    app.state::<ShortcutSettings>().0.lock().map(|s| s.clone()).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_global_shortcut(app: AppHandle, shortcut: String, enabled: bool) -> Result<Settings, String> {
    let new_key = parse(shortcut.trim())?;
    let state = app.state::<ShortcutSettings>();
    let mut current = state.0.lock().map_err(|e| e.to_string())?;
    let old_key = if current.active { parse(&current.shortcut).ok() } else { None };
    let same = old_key.as_ref().map(|key| key.id()) == Some(new_key.id());
    if enabled && !same {
        app.global_shortcut().register(new_key).map_err(|_| "Cette combinaison est indisponible. Choisis un autre raccourci.".to_string())?;
    }
    if let Some(old) = old_key {
        if !enabled || !same {
            if let Err(error) = app.global_shortcut().unregister(old) {
                if enabled && !same { let _ = app.global_shortcut().unregister(new_key); }
                return Err(error.to_string());
            }
        }
    }
    let next = Settings { shortcut: new_key.to_string(), enabled, active: enabled, error: None };
    let saved = config_path(&app).and_then(|path| {
        let bytes = serde_json::to_vec(&next).map_err(|e| e.to_string())?;
        fs::write(path, bytes).map_err(|e| e.to_string())
    });
    if let Err(error) = saved {
        if enabled && !same { let _ = app.global_shortcut().unregister(new_key); }
        if let Some(old) = old_key { if !enabled || !same { let _ = app.global_shortcut().register(old); } }
        return Err(format!("Impossible d’enregistrer le réglage : {error}"));
    }
    *current = next.clone();
    Ok(next)
}
