#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod calendar;
mod drive;
mod shortcuts;

use std::time::Duration;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn open_browser(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Adresse invalide.")?;
    if !matches!(parsed.scheme(), "https" | "http")
        || parsed.host().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Seuls les liens web HTTP et HTTPS sont autorisés.".into());
    }
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_update(app: AppHandle) -> Result<Option<String>, String> {
    if option_env!("BETE_UPDATER_PUBLIC_KEY").is_none() {
        return Ok(None);
    }
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(update) => Ok(update.map(|update| update.version)),
        Err(tauri_plugin_updater::Error::ReleaseNotFound) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
async fn install_update(app: AppHandle, version: String, restart: bool) -> Result<(), String> {
    if option_env!("BETE_UPDATER_PUBLIC_KEY").is_none() {
        return Err("Mises à jour désactivées dans cette compilation.".into());
    }
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(120))
        .restart_after_install(restart)
        .build()
        .map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .filter(|update| update.version == version)
        .ok_or("La mise à jour a changé. Relance Bête pour vérifier la nouvelle version.")?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())
}

fn main() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init()).plugin(shortcuts::plugin());
    if option_env!("BETE_UPDATER_PUBLIC_KEY").is_some() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }
    builder
        .invoke_handler(tauri::generate_handler![
            open_browser,
            minimize_window,
            shortcuts::get_global_shortcut,
            shortcuts::set_global_shortcut,
            check_update,
            install_update,
            calendar::calendar_feed,
            drive::drive_configured,
            drive::drive_login,
            drive::drive_token,
            drive::drive_logout
        ])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                // Let WebView2 deliver HTML5 URL and file drops to the board.
                .disable_drag_drop_handler()
                .title("Bête")
                .inner_size(1280.0, 850.0)
                .min_inner_size(520.0, 360.0)
                .on_navigation(|url| {
                    url.scheme() == "tauri" && url.host_str() == Some("localhost")
                        || url.scheme() == "http"
                            && url.host_str() == Some("tauri.localhost")
                            && url.port().is_none()
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            shortcuts::init(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Impossible de démarrer Bête");
}
