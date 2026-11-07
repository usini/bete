use serde_json::{json, Value};
use tauri::{Manager, State, plugin::PluginHandle};
struct Mobile(PluginHandle<tauri::Wry>);
fn call(m: &Mobile, command: &str, args: Value) -> Result<Value, String> {
    m.0.run_mobile_plugin(command, args).map_err(|e| e.to_string())
}
#[tauri::command]
async fn sync_application_blocks(m: State<'_, Mobile>, blocks: Value) -> Result<Value, String> { call(&m,"syncBlocks",json!({"blocks":blocks})) }
#[tauri::command]
async fn application_launch_status(m: State<'_, Mobile>) -> Result<Value, String> { call(&m,"status",json!({})) }
#[tauri::command]
async fn set_application_launch_enabled(m: State<'_, Mobile>, enabled: bool) -> Result<Value, String> { call(&m,"setEnabled",json!({"enabled":enabled})) }
#[tauri::command]
async fn revoke_all_application_permissions(m: State<'_, Mobile>) -> Result<Value, String> { call(&m,"revokeAll",json!({})) }
#[tauri::command]
async fn pick_application(m: State<'_, Mobile>) -> Result<Value, String> { call(&m,"pickApp",json!({})) }
#[tauri::command]
async fn launch_application(m: State<'_, Mobile>, block_id: String, reference: String) -> Result<bool, String> {
    let result=call(&m,"launchApp",json!({"blockId":block_id,"reference":reference}))?;
    Ok(result["opened"].as_bool().unwrap_or(false))
}
#[tauri::command]
async fn open_browser(m: State<'_, Mobile>, url: String) -> Result<Value, String> { call(&m,"openBrowser",json!({"url":url})) }
#[tauri::command]
async fn drive_login(m: State<'_, Mobile>) -> Result<Value, String> { call(&m,"driveLogin",json!({})) }
#[tauri::command]
async fn drive_token(m: State<'_, Mobile>) -> Result<Value, String> { call(&m,"driveToken",json!({})) }
#[tauri::command]
async fn drive_logout(m: State<'_, Mobile>) -> Result<Value, String> { call(&m,"driveLogout",json!({})) }
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri::plugin::Builder::<tauri::Wry>::new("bete-mobile").setup(|app,api| {
            #[cfg(target_os="android")]
            app.manage(Mobile(api.register_android_plugin("eu.usini.bete2.android.proto","BetePlugin")?));
            Ok(())
        }).build())
        .invoke_handler(tauri::generate_handler![sync_application_blocks,application_launch_status,set_application_launch_enabled,revoke_all_application_permissions,pick_application,launch_application,open_browser,drive_login,drive_token,drive_logout])
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("Bête Proto")
                .on_navigation(|url| matches!(url.host_str(), Some("tauri.localhost") | Some("localhost")) && matches!(url.scheme(), "http" | "https" | "tauri"))
                .on_new_window(|_,_| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!()).expect("Impossible de démarrer Bête Android");
}
