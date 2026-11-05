// Launch permissions and executable paths live only in native local settings.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    os::windows::fs::OpenOptionsExt,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;
use windows::{
    core::{Interface, PCWSTR, PWSTR},
    Win32::{
        Storage::FileSystem::GetDriveTypeW,
        System::Com::{CoCreateInstance, IPersistFile, CLSCTX_INPROC_SERVER, STGM_READ},
        UI::Shell::{IShellLinkW, ShellLink},
    },
};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Application {
    reference: String,
    label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    steam: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
enum Target {
    Exe { path: String },
    Steam { uri: String },
}
#[derive(Clone, Serialize, Deserialize)]
struct Approval {
    reference: String,
    fingerprint: String,
}
#[derive(Default, Clone, Serialize, Deserialize)]
struct Settings {
    enabled: bool,
    targets: HashMap<String, Target>,
    approvals: HashMap<String, Approval>,
}
#[derive(Default)]
pub struct ApplicationState {
    settings: Mutex<Settings>,
    live: Mutex<HashMap<String, Application>>,
    prompting: AtomicBool,
    generation: AtomicU64,
}
#[derive(Serialize)]
pub struct Status {
    enabled: bool,
    approved: HashMap<String, String>,
}
#[derive(Deserialize)]
pub struct LiveBlock {
    id: String,
    application: Application,
}
fn valid_ref(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|c| c.is_ascii_hexdigit())
}
fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}
fn steam_uri(value: &str) -> Option<String> {
    let url = tauri::Url::parse(value).ok()?;
    if url.scheme() != "steam"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return None;
    }
    if !matches!(url.host_str(), Some("rungameid" | "run")) {
        return None;
    }
    let id = url.path().trim_matches('/');
    if id.is_empty() || id.len() > 20 || !id.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(format!("steam://rungameid/{id}"))
}
fn local_path(path: &Path) -> Result<PathBuf, String> {
    let text = path.to_string_lossy();
    let text = text.strip_prefix(r"\\?\").unwrap_or(&text);
    let bytes = text.as_bytes();
    if bytes.len() < 3
        || !bytes[0].is_ascii_alphabetic()
        || bytes[1] != b':'
        || !matches!(bytes[2], b'\\' | b'/')
        || text[2..].contains(':')
    {
        return Err("Seuls les fichiers sur un disque local sont autorisés.".into());
    }
    let drive: Vec<u16> = format!("{}:\\", bytes[0] as char)
        .encode_utf16()
        .chain(Some(0))
        .collect();
    if unsafe { GetDriveTypeW(PCWSTR(drive.as_ptr())) } != 3 {
        return Err("Les chemins réseau et supports amovibles sont refusés.".into());
    }
    let canonical = fs::canonicalize(path).map_err(|e| e.to_string())?;
    let target = canonical.to_string_lossy();
    if target.starts_with(r"\\?\UNC\") || target.starts_with(r"\\") && !target.starts_with(r"\\?\")
    {
        return Err("Les chemins réseau sont refusés.".into());
    }
    let final_text = target.strip_prefix(r"\\?\").unwrap_or(&target);
    let final_bytes = final_text.as_bytes();
    if final_bytes.len() < 3
        || !final_bytes[0].is_ascii_alphabetic()
        || final_bytes[1] != b':'
        || final_text[2..].contains(':')
    {
        return Err("Chemin de périphérique refusé.".into());
    }
    Ok(canonical)
}
fn executable(path: &Path) -> Result<PathBuf, String> {
    let path = local_path(path)?;
    if !path
        .extension()
        .is_some_and(|v| v.eq_ignore_ascii_case("exe"))
    {
        return Err("Seuls les exécutables .exe sont acceptés.".into());
    }
    let name = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if [
        "cmd",
        "powershell",
        "pwsh",
        "wscript",
        "cscript",
        "mshta",
        "rundll32",
        "regsvr32",
        "msiexec",
        "reg",
        "control",
        "explorer",
        "conhost",
        "wt",
        "bash",
        "wsl",
        "python",
        "pythonw",
        "node",
        "csi",
        "vbc",
        "csc",
    ]
    .iter()
    .any(|n| name == *n)
    {
        return Err("Les interpréteurs et outils d’exécution de commandes sont refusés.".into());
    }
    Ok(path)
}
// Keep the executable open without sharing write/delete access during verification and launch.
fn fingerprint(target: &Target) -> Result<(String, Option<File>), String> {
    match target {
        Target::Steam { uri } => Ok((steam_uri(uri).ok_or("Lien Steam non autorisé.")?, None)),
        Target::Exe { path } => {
            let path = executable(Path::new(path))?;
            let mut file = OpenOptions::new()
                .read(true)
                .share_mode(1)
                .open(path)
                .map_err(|e| e.to_string())?;
            if file.metadata().map_err(|e| e.to_string())?.len() > 1024 * 1024 * 1024 {
                return Err("Exécutable trop volumineux.".into());
            }
            let mut magic = [0; 2];
            file.read_exact(&mut magic).map_err(|e| e.to_string())?;
            if magic != *b"MZ" {
                return Err("Ce fichier n’est pas un exécutable Windows.".into());
            }
            file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
            let mut hash = Sha256::new();
            let mut buffer = [0; 65536];
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hash.update(&buffer[..n]);
            }
            Ok((format!("{:x}", hash.finalize()), Some(file)))
        }
    }
}
fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let folder = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    Ok(folder.join("application-permissions.json"))
}
fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(settings).map_err(|e| e.to_string())?;
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&temporary)
        .map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(temporary, path).map_err(|e| e.to_string())
}

fn revoke_absent(s: &mut Settings, live: &HashMap<String, Application>) -> bool {
    let before = s.approvals.len();
    s.approvals
        .retain(|id, a| live.get(id).is_some_and(|b| b.reference == a.reference));
    before != s.approvals.len()
}
fn status(s: &Settings) -> Status {
    Status {
        enabled: s.enabled,
        approved: s
            .approvals
            .iter()
            .map(|(id, a)| (id.clone(), a.reference.clone()))
            .collect(),
    }
}
pub fn init(app: &AppHandle) {
    let settings = settings_path(app)
        .ok()
        .and_then(|p| fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    app.manage(ApplicationState {
        settings: Mutex::new(settings),
        ..Default::default()
    });
}
fn insert_target(app: &AppHandle, label: String, target: Target) -> Result<Application, String> {
    let mut bytes = [0; 32];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    let reference = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
    let steam = if let Target::Steam { uri } = &target {
        Some(uri.clone())
    } else {
        None
    };
    let state = app.state::<ApplicationState>();
    let mut s = state.settings.lock().map_err(|e| e.to_string())?;
    if s.targets.len() >= 10000 {
        return Err("Trop de raccourcis locaux enregistrés.".into());
    }
    s.targets.insert(reference.clone(), target);
    save(app, &s)?;
    Ok(Application {
        reference,
        label: label.chars().take(100).collect(),
        steam,
    })
}
fn target_from_file(path: &Path) -> Result<(String, Target), String> {
    let path = local_path(path)?;
    let label = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let extension = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    let target = match extension.as_str() {
        "exe" => Target::Exe {
            path: executable(&path)?.to_string_lossy().into_owned(),
        },
        "url" => {
            if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 65536 {
                return Err("Raccourci trop volumineux.".into());
            }
            let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
            let uri = text
                .lines()
                .find_map(|l| l.strip_prefix("URL="))
                .and_then(steam_uri)
                .ok_or("Seuls les raccourcis Steam de lancement sont acceptés.")?;
            Target::Steam { uri }
        }
        "lnk" => unsafe {
            if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 1024 * 1024 {
                return Err("Raccourci trop volumineux.".into());
            }
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| e.to_string())?;
            let persist: IPersistFile = link.cast().map_err(|e| e.to_string())?;
            let wide: Vec<u16> = path
                .as_os_str()
                .to_string_lossy()
                .encode_utf16()
                .chain(Some(0))
                .collect();
            persist
                .Load(PCWSTR(wide.as_ptr()), STGM_READ)
                .map_err(|e| e.to_string())?;
            let mut args = [0u16; 32768];
            link.GetArguments(&mut args).map_err(|e| e.to_string())?;
            if args[0] != 0 {
                return Err("Les raccourcis .lnk avec arguments sont refusés. Dépose directement le .exe, ou un lien Steam de lancement.".into());
            }
            let mut buffer = [0u16; 32768];
            link.GetPath(&mut buffer, std::ptr::null_mut(), 0)
                .map_err(|e| e.to_string())?;
            let value = String::from_utf16_lossy(
                &buffer[..buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len())],
            );
            Target::Exe {
                path: executable(Path::new(&value))?
                    .to_string_lossy()
                    .into_owned(),
            }
        },
        _ => return Err("Dépose un .lnk, un .exe ou un raccourci Steam .url.".into()),
    };
    Ok((label, target))
}
fn from_file(app: &AppHandle, path: &Path) -> Result<Application, String> {
    let (label, target) = target_from_file(path)?;
    insert_target(app, label, target)
}
#[tauri::command]
pub fn sync_application_blocks(app: AppHandle, blocks: Vec<LiveBlock>) -> Result<Status, String> {
    if blocks.len() > 5000 {
        return Err("Trop de blocs.".into());
    }
    let mut live = HashMap::new();
    let state = app.state::<ApplicationState>();
    let mut s = state.settings.lock().map_err(|e| e.to_string())?;
    for b in blocks {
        if !valid_id(&b.id) || !valid_ref(&b.application.reference) {
            continue;
        }
        if s.targets.len() < 10000 && !s.targets.contains_key(&b.application.reference) {
            if let Some(uri) = b.application.steam.as_deref().and_then(steam_uri) {
                s.targets
                    .insert(b.application.reference.clone(), Target::Steam { uri });
            }
        }
        live.insert(b.id, b.application);
    }
    let revoked = revoke_absent(&mut s, &live);
    let mut current = state.live.lock().map_err(|e| e.to_string())?;
    if *current != live {
        state.generation.fetch_add(1, Ordering::SeqCst);
    }
    *current = live;
    if revoked {
        save(&app, &s)?;
    }
    Ok(status(&s))
}
#[tauri::command]
pub fn revoke_all_application_permissions(app: AppHandle) -> Result<(), String> {
    let state = app.state::<ApplicationState>();
    let mut s = state.settings.lock().map_err(|e| e.to_string())?;
    s.approvals.clear();
    state.generation.fetch_add(1, Ordering::SeqCst);
    save(&app, &s)
}
#[tauri::command]
pub fn application_launch_status(app: AppHandle) -> Result<Status, String> {
    let state = app.state::<ApplicationState>();
    let s = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(status(&s))
}
#[tauri::command]
pub async fn set_application_launch_enabled(
    app: AppHandle,
    enabled: bool,
) -> Result<Status, String> {
    tauri::async_runtime::spawn_blocking(move||{
        let message=if enabled{"Activer l’ouverture d’applications sur cet ordinateur ? Chaque nouveau bloc devra aussi être autorisé individuellement."}else{"Désactiver l’ouverture des applications depuis Bête ?"};
        if app.dialog().message(message).title("Bête — Applications locales").kind(MessageDialogKind::Warning).buttons(MessageDialogButtons::OkCancel).blocking_show(){let state=app.state::<ApplicationState>();let mut s=state.settings.lock().map_err(|e|e.to_string())?;s.enabled=enabled;state.generation.fetch_add(1,Ordering::SeqCst);save(&app,&s)?;}
        application_launch_status(app)
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn launch_application(
    app: AppHandle,
    block_id: String,
    reference: String,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || launch(&app, &block_id, &reference))
        .await
        .map_err(|e| e.to_string())?
}
fn launch(app: &AppHandle, id: &str, reference: &str) -> Result<bool, String> {
    let state = app.state::<ApplicationState>();
    if state.prompting.swap(true, Ordering::SeqCst) {
        return Err("Une demande de lancement est déjà en cours.".into());
    }
    let result = (|| {
        let generation = state.generation.load(Ordering::SeqCst);
        let (target, label, enabled, previous) = {
            let s = state.settings.lock().map_err(|e| e.to_string())?;
            let live = state.live.lock().map_err(|e| e.to_string())?;
            let block = live
                .get(id)
                .filter(|b| b.reference == reference)
                .ok_or("Ce bloc application n’est plus présent.")?;
            (
                s.targets.get(reference).cloned().ok_or(
                    "Application inconnue sur cet ordinateur. Redépose son raccourci local.",
                )?,
                block.label.clone(),
                s.enabled,
                s.approvals.get(id).cloned(),
            )
        };
        let (hash, _file_guard) = fingerprint(&target)?;
        let approved = previous.is_some_and(|a| a.reference == reference && a.fingerprint == hash);
        let needs_consent = !enabled || !approved;
        if needs_consent {
            let destination = match &target {
                Target::Exe { path } => path.as_str(),
                Target::Steam { uri } => uri.as_str(),
            };
            let message=format!("Autoriser ce bloc à lancer cette application ?\n\n{label}\n{destination}\n\nCette autorisation est propre à ce bloc et à cet ordinateur. Elle sera supprimée avec le bloc.{}",if !enabled{"\nCela active aussi l’ouverture d’applications."}else{""});
            if !app
                .dialog()
                .message(message)
                .title("Bête — Autoriser cette application")
                .kind(MessageDialogKind::Warning)
                .buttons(MessageDialogButtons::OkCancelCustom(
                    "Autoriser ce bloc".into(),
                    "Annuler".into(),
                ))
                .blocking_show()
            {
                return Ok(false);
            }
        }
        {
            let mut s = state.settings.lock().map_err(|e| e.to_string())?;
            let live = state.live.lock().map_err(|e| e.to_string())?;
            if !live.get(id).is_some_and(|b| b.reference == reference) {
                return Err("Le bloc a été supprimé pendant la confirmation.".into());
            }
            if state.generation.load(Ordering::SeqCst) != generation {
                return Err(
                    "Les blocs applications ont changé. Réessaie pour confirmer le bloc actuel."
                        .into(),
                );
            }
            if !needs_consent
                && (!s.enabled
                    || !s
                        .approvals
                        .get(id)
                        .is_some_and(|a| a.reference == reference && a.fingerprint == hash))
            {
                return Err("Autorisation révoquée. Réessaie pour autoriser ce bloc.".into());
            }
            s.enabled = true;
            s.approvals.insert(
                id.into(),
                Approval {
                    reference: reference.into(),
                    fingerprint: hash,
                },
            );
            save(app, &s)?;
            match target {
                Target::Exe { path } => {
                    use std::os::windows::process::CommandExt;
                    std::process::Command::new(path)
                        .creation_flags(0x08000000)
                        .spawn()
                        .map_err(|e| e.to_string())?;
                }
                Target::Steam { uri } => {
                    app.opener()
                        .open_url(uri, None::<&str>)
                        .map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(true)
    })();
    state.prompting.store(false, Ordering::SeqCst);
    result
}
#[tauri::command]
pub async fn pick_application(app: AppHandle) -> Result<Option<Application>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .set_title("Ajouter une application Windows")
            .add_filter("Applications et raccourcis", &["exe", "lnk", "url"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file.into_path().map_err(|e| e.to_string())?;
        use windows::Win32::System::Com::{
            CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED,
        };
        let initialized = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok() };
        let result = from_file(&app, &path).map(Some);
        if initialized {
            unsafe {
                CoUninitialize();
            }
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
fn decode_drop_message(text: &str) -> Option<serde_json::Value> {
    if text.len() > 2048 {
        return None;
    }
    let mut value: serde_json::Value = serde_json::from_str(text).ok()?;
    // Wry's preceding IPC listener requires a string message, so accept its envelope.
    if let Some(inner) = value.as_str() {
        value = serde_json::from_str(inner).ok()?;
    }
    (value["type"] == "bete-application-drop").then_some(value)
}
// Get the actual dropped file from WebView2; JavaScript never supplies an executable path.
pub fn install_file_bridge(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use webview2_com::{
        take_pwstr,
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2,
        },
        WebMessageReceivedEventHandler,
    };
    let app = window.app_handle().clone();
    window.with_webview(move|webview|unsafe{
        let Ok(core)=webview.controller().CoreWebView2()else{return;};
        let mut token=0;
        let _=core.add_WebMessageReceived(&WebMessageReceivedEventHandler::create(Box::new(move|_,args|{
            let Some(args)=args else{return Ok(());};
            let mut source=PWSTR::null();args.Source(&mut source)?;let source=take_pwstr(source);
            let trusted=tauri::Url::parse(&source).ok().is_some_and(|u|(u.scheme()=="tauri"&&u.host_str()==Some("localhost"))||(u.scheme()=="http"&&u.host_str()==Some("tauri.localhost")&&u.port().is_none()));
            if !trusted{return Ok(());}
            let mut message=PWSTR::null();args.WebMessageAsJson(&mut message)?;
            let text=take_pwstr(message);
            let Some(value)=decode_drop_message(&text)else{return Ok(());};
            let result = (|| -> Result<Application,String> {
                let args2 = args.cast::<ICoreWebView2WebMessageReceivedEventArgs2>().map_err(|e| format!("WebView2 ne transmet pas le fichier : {e}"))?;
                let objects = args2.AdditionalObjects().map_err(|e| e.to_string())?;
                let mut count=0; objects.Count(&mut count).map_err(|e|e.to_string())?;
                if count!=1 { return Err("Aucun fichier reçu. Utilise Ajouter une application dans le menu.".into()); }
                let file=objects.GetValueAtIndex(0).and_then(|v|v.cast::<ICoreWebView2File>()).map_err(|e|format!("Fichier non reconnu par WebView2 : {e}"))?;
                let mut path=PWSTR::null();file.Path(&mut path).map_err(|e|e.to_string())?;
                let path=take_pwstr(path);
                if path.is_empty(){return Err("Le raccourci déposé n’a pas de chemin local. Utilise Ajouter une application dans le menu.".into());}
                from_file(&app,Path::new(&path))
            })();
            match result {
                Ok(application)=>{let _=app.emit_to("main","bete-application-dropped",serde_json::json!({"application":application,"x":value["x"],"y":value["y"],"requestId":value["requestId"]}));},
                Err(error)=>{let _=app.emit_to("main","bete-application-error",serde_json::json!({"message":error,"requestId":value["requestId"]}));}
            }
            Ok(())
        })),&mut token);
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn steam_is_limited_to_launching_a_numeric_game() {
        for v in ["steam://rungameid/123", "steam://run/456"] {
            assert!(steam_uri(v).is_some());
        }
        for v in [
            "steam://uninstall/123",
            "steam://install/123",
            "steam://run/123//-flag",
            "steam://run/123?args=bad",
            "steam://run/12%20bad",
            "https://example.com",
        ] {
            assert!(steam_uri(v).is_none(), "{v}");
        }
    }
    #[test]
    fn missing_blocks_or_fingerprints_cannot_match_approval() {
        assert!(!valid_ref("approved"));
        assert!(!valid_id("../../cmd"));
        let live: HashMap<String, Application> = HashMap::new();
        let a = Approval {
            reference: "a".repeat(64),
            fingerprint: "hash".into(),
        };
        assert!(!live
            .get("deleted")
            .is_some_and(|b| b.reference == a.reference));
    }
    #[test]
    fn removal_revokes_approval_and_undo_does_not_restore_it() {
        let reference = "a".repeat(64);
        let block = Application {
            reference: reference.clone(),
            label: "App".into(),
            steam: None,
        };
        let mut s = Settings::default();
        s.approvals.insert(
            "block".into(),
            Approval {
                reference: reference.clone(),
                fingerprint: "hash".into(),
            },
        );
        let mut live = HashMap::from([("block".into(), block.clone())]);
        assert!(!revoke_absent(&mut s, &live));
        live.clear();
        assert!(revoke_absent(&mut s, &live));
        assert!(s.approvals.is_empty());
        live.insert("block".into(), block);
        assert!(!revoke_absent(&mut s, &live));
        assert!(s.approvals.is_empty());
    }
    #[test]
    fn cloning_or_retargeting_a_block_does_not_inherit_an_approval() {
        let mut s = Settings::default();
        s.approvals.insert(
            "original".into(),
            Approval {
                reference: "a".repeat(64),
                fingerprint: "hash".into(),
            },
        );
        let clone = Application {
            reference: "a".repeat(64),
            label: "App".into(),
            steam: None,
        };
        let live = HashMap::from([("clone".into(), clone)]);
        assert!(revoke_absent(&mut s, &live));
        assert!(s.approvals.is_empty());
        s.approvals.insert(
            "original".into(),
            Approval {
                reference: "a".repeat(64),
                fingerprint: "hash".into(),
            },
        );
        let changed = Application {
            reference: "b".repeat(64),
            label: "App".into(),
            steam: None,
        };
        assert!(revoke_absent(
            &mut s,
            &HashMap::from([("original".into(), changed)])
        ));
    }

    #[test]
    fn executable_changes_invalidate_the_fingerprint_and_writes_are_blocked_while_checked() {
        let mut random = [0u8; 8];
        getrandom::fill(&mut random).unwrap();
        let name = random
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>();
        let path = std::env::temp_dir().join(format!("bete-security-test-{name}.exe"));
        fs::write(&path, b"MZ-test-first-version").unwrap();
        let target = Target::Exe {
            path: path.to_string_lossy().into_owned(),
        };
        let (first, guard) = fingerprint(&target).unwrap();
        assert!(OpenOptions::new().write(true).open(&path).is_err());
        drop(guard);
        fs::write(&path, b"MZ-test-second-version").unwrap();
        let (second, guard) = fingerprint(&target).unwrap();
        assert_ne!(first, second);
        drop(guard);
        fs::remove_file(&path).unwrap();
    }
    #[test]
    fn imported_descriptor_never_contains_native_permission_fields() {
        let input = serde_json::json!({"reference":"a".repeat(64),"label":"App","approved":true,"enabled":true,"path":"cmd.exe","fingerprint":"forged"});
        let descriptor: Application = serde_json::from_value(input).unwrap();
        let serialized = serde_json::to_value(descriptor).unwrap();
        assert!(serialized.get("approved").is_none());
        assert!(serialized.get("path").is_none());
        assert!(serialized.get("enabled").is_none());
    }

    #[test]
    fn shortcut_resolution_does_not_execute_and_rejects_arguments() {
        use windows::Win32::System::Com::{
            CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED,
        };
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap();
        }
        let mut bytes = [0; 8];
        getrandom::fill(&mut bytes).unwrap();
        let suffix = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
        let exe = std::env::temp_dir().join(format!("bete-shortcut-test-{suffix}.exe"));
        let lnk = exe.with_extension("lnk");
        fs::write(&exe, b"MZ-never-executed").unwrap();
        unsafe {
            let link: IShellLinkW =
                CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).unwrap();
            let target: Vec<u16> = exe
                .to_string_lossy()
                .encode_utf16()
                .chain(Some(0))
                .collect();
            link.SetPath(PCWSTR(target.as_ptr())).unwrap();
            let persist: IPersistFile = link.cast().unwrap();
            let file: Vec<u16> = lnk
                .to_string_lossy()
                .encode_utf16()
                .chain(Some(0))
                .collect();
            persist.Save(PCWSTR(file.as_ptr()), true).unwrap();
            let (_, resolved) = target_from_file(&lnk).unwrap();
            assert!(matches!(resolved, Target::Exe { .. }));
            let args: Vec<u16> = "--argument".encode_utf16().chain(Some(0)).collect();
            link.SetArguments(PCWSTR(args.as_ptr())).unwrap();
            persist.Save(PCWSTR(file.as_ptr()), true).unwrap();
            assert!(target_from_file(&lnk).is_err());
        }
        fs::remove_file(lnk).unwrap();
        fs::remove_file(exe).unwrap();
        unsafe {
            CoUninitialize();
        }
    }
    #[test]
    fn file_drop_messages_accept_the_wry_string_envelope() {
        let message =
            serde_json::json!({"type":"bete-application-drop","requestId":"test","x":10,"y":20});
        let plain = message.to_string();
        let wrapped = serde_json::to_string(&plain).unwrap();
        assert_eq!(decode_drop_message(&wrapped).unwrap()["requestId"], "test");
        assert!(decode_drop_message(&plain).is_some());
        assert!(decode_drop_message("{}").is_none());
        assert!(decode_drop_message(&"x".repeat(2049)).is_none());
    }
}
