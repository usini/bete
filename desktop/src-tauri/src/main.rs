#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::thread;

use tauri::Manager;

// Fixed port for the local (LAN) static file server — only used when the user
// picks "Local network" sharing in Settings. Arbitrary, just needs to be
// unlikely to collide with anything else running on the machine.
const LAN_PORT: u16 = 47821;

// Where the static web app (index.html, css/, js/, assets/) lives at runtime:
// in dev it's the desktop/dist/ folder next to src-tauri; once bundled it's
// shipped as a resource (see tauri.conf.json's bundle.resources).
fn dist_dir(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist")
    } else {
        app.path()
            .resource_dir()
            .expect("resource dir")
            .join("dist")
    }
}

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("svg") => "image/svg+xml",
        Some("wav") => "audio/wav",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    }
}

// Minimal static file server so other people on the same network can open
// this machine's address in a normal browser and reach the same web app the
// desktop window is showing (needed for the "Local network" sharing mode:
// tauri://localhost isn't reachable by anyone but this window).
fn serve_lan(dist: PathBuf) {
    let server = match tiny_http::Server::http(("0.0.0.0", LAN_PORT)) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("LAN server: failed to bind 0.0.0.0:{LAN_PORT}: {e}");
            return;
        }
    };
    for request in server.incoming_requests() {
        let url_path = request.url().split('?').next().unwrap_or("/");
        // The app is a single-page static site: any path without a real file
        // extension (i.e. the board routes driven by ?id=/?peer= query
        // params) falls back to index.html.
        let rel = if url_path == "/" || !url_path.contains('.') {
            "index.html".to_string()
        } else {
            url_path.trim_start_matches('/').to_string()
        };
        let file_path = dist.join(&rel);
        let response = match fs::read(&file_path) {
            Ok(bytes) => {
                let header = tiny_http::Header::from_bytes(
                    &b"Content-Type"[..],
                    content_type(&file_path).as_bytes(),
                )
                .unwrap();
                tiny_http::Response::new(
                    tiny_http::StatusCode(200),
                    vec![header],
                    Cursor::new(bytes.clone()),
                    Some(bytes.len()),
                    None,
                )
            }
            Err(_) => tiny_http::Response::new(
                tiny_http::StatusCode(404),
                vec![],
                Cursor::new(Vec::new()),
                Some(0),
                None,
            ),
        };
        let _ = request.respond(response);
    }
}

#[tauri::command]
fn get_lan_url() -> Result<String, String> {
    let ip = local_ip_address::local_ip().map_err(|e| e.to_string())?;
    Ok(format!("http://{ip}:{LAN_PORT}/"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_lan_url])
        .setup(|app| {
            let dist = dist_dir(app.handle());
            thread::spawn(move || serve_lan(dist));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Bete desktop app");
}
