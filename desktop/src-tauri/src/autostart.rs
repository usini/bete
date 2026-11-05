use windows::{
    core::{w, PCWSTR},
    Win32::System::Registry::*,
};
const KEY: PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
const NAME: PCWSTR = w!("BeteDesktop");
#[tauri::command]
pub fn get_autostart() -> bool {
    unsafe {
        let mut size = 0;
        RegGetValueW(
            HKEY_CURRENT_USER,
            KEY,
            NAME,
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut size),
        )
        .is_ok()
    }
}
#[tauri::command]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    unsafe {
        let mut key = HKEY::default();
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            KEY,
            None,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            None,
            &mut key,
            None,
        )
        .ok()
        .map_err(|e| e.to_string())?;
        let result = if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let command = format!("\"{}\" --background", exe.display());
            let data: Vec<u8> = command
                .encode_utf16()
                .chain(Some(0))
                .flat_map(u16::to_le_bytes)
                .collect();
            RegSetValueExW(key, NAME, None, REG_SZ, Some(&data))
                .ok()
                .map_err(|e| e.to_string())
        } else {
            let code = RegDeleteValueW(key, NAME);
            if code.0 == 2 {
                Ok(())
            } else {
                code.ok().map_err(|e| e.to_string())
            }
        };
        let _ = RegCloseKey(key);
        result
    }
}
