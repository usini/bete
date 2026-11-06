#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod calendar;
mod drive;
mod shortcuts;
mod applications;
mod tray;
mod autostart;

use std::time::Duration;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
fn open_calculator() -> Result<(), String> {
    let root = std::env::var_os("SystemRoot").ok_or("Dossier Windows introuvable")?;
    std::process::Command::new(std::path::Path::new(&root).join("System32").join("calc.exe")).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn capture_screen(app: AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())?;
    app.opener().open_url("ms-screenclip:", None::<&str>).map_err(|error| error.to_string())
}

fn switch_display(mode: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    let root = std::env::var_os("SystemRoot").ok_or("Dossier Windows introuvable")?;
    std::process::Command::new(std::path::Path::new(&root).join("System32").join("DisplaySwitch.exe"))
        .arg(mode).creation_flags(0x08000000).spawn().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn extend_desktop() -> Result<(), String> {
    switch_display("/extend")
}

#[tauri::command]
fn pc_screen_only() -> Result<(), String> {
    switch_display("/internal")
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
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init()).plugin(shortcuts::plugin()).plugin(tauri_plugin_dialog::init());
    if option_env!("BETE_UPDATER_PUBLIC_KEY").is_some() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }
    builder
        .invoke_handler(tauri::generate_handler![
            open_browser,
            autostart::get_autostart,
            autostart::set_autostart,
            tray::get_close_to_tray,
            tray::set_close_to_tray,
            tray::hide_on_close,
            open_calculator,
            capture_screen,
            extend_desktop,
            pc_screen_only,
            applications::sync_application_blocks,
            applications::revoke_all_application_permissions,
            applications::application_launch_status,
            applications::set_application_launch_enabled,
            applications::launch_application,
            applications::pick_application,
            applications::application_icon,
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
            applications::init(app.handle());
            let main_window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                // Let WebView2 deliver HTML5 URL and file drops to the board.
                .disable_drag_drop_handler()
                .visible(!std::env::args().any(|arg| arg == "--background"))
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
            applications::install_file_bridge(&main_window)?;
            shortcuts::init(app.handle());
            tray::init(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Impossible de démarrer Bête");
}
