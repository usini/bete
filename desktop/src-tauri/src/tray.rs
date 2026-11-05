use std::{fs, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState}};
pub struct CloseMode(Mutex<bool>);
fn path(app:&AppHandle)->Result<std::path::PathBuf,String>{let dir=app.path().app_config_dir().map_err(|e|e.to_string())?;fs::create_dir_all(&dir).map_err(|e|e.to_string())?;Ok(dir.join("close-to-tray.json"))}
fn show(app:&AppHandle){if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.unminimize();let _=w.set_focus();}}
#[tauri::command]
pub fn get_close_to_tray(app:AppHandle)->Result<bool,String>{let s=app.state::<CloseMode>();let value=*s.0.lock().map_err(|e|e.to_string())?;Ok(value)}
#[tauri::command]
pub fn set_close_to_tray(app:AppHandle,enabled:bool)->Result<(),String>{fs::write(path(&app)?,serde_json::to_vec(&enabled).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;*app.state::<CloseMode>().0.lock().map_err(|e|e.to_string())?=enabled;Ok(())}
#[tauri::command]
pub fn hide_on_close(app:AppHandle)->Result<bool,String>{if !get_close_to_tray(app.clone())?{return Ok(false);}let w=app.get_webview_window("main").ok_or("Fenêtre absente")?;w.hide().map_err(|e|e.to_string())?;Ok(true)}
pub fn init(app:&AppHandle)->tauri::Result<()>{
 let enabled=path(app).ok().and_then(|p|fs::read(p).ok()).and_then(|v|serde_json::from_slice::<bool>(&v).ok()).unwrap_or(true);
 app.manage(CloseMode(Mutex::new(enabled)));
 let open=MenuItem::with_id(app,"open","Ouvrir Bête",true,None::<&str>)?;
 let quit=MenuItem::with_id(app,"quit","Quitter Bête",true,None::<&str>)?;
 let menu=Menu::with_items(app,&[&open,&quit])?;
 let mut tray=TrayIconBuilder::with_id("bete-tray").tooltip("Bête").menu(&menu).show_menu_on_left_click(false)
 .on_menu_event(|app,event|match event.id.as_ref(){"open"=>show(app),"quit"=>{show(app);let _=app.emit_to("main","bete-quit-requested",());},_=>{}})
 .on_tray_icon_event(|tray,event|{if matches!(event,TrayIconEvent::Click{button:MouseButton::Left,button_state:MouseButtonState::Up,..}){show(tray.app_handle());}});
 if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone());}
 tray.build(app)?;Ok(())
}
