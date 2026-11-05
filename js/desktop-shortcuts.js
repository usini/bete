export async function initDesktopShortcuts(desktop) {
  const section = document.getElementById('desktop-shortcuts');
  const enabled = document.getElementById('global-shortcut-enabled');
  const input = document.getElementById('global-shortcut-value');
  const save = document.getElementById('global-shortcut-save');
  const status = document.getElementById('global-shortcut-status');
  const { invoke } = desktop.core;
  let busy = false;
  let savedShortcut = 'Ctrl+Alt+Space';
  const render = settings => {
    savedShortcut = settings.shortcut;
    enabled.checked = settings.enabled;
    input.value = settings.shortcut;
    status.textContent = settings.error || (settings.active ? 'Raccourci global actif.' : 'Raccourci global désactivé.');
  };
  const persist = async (useSavedShortcut = false) => {
    if (busy) return;
    busy = true; save.disabled = true; enabled.disabled = true;
    try { render(await invoke('set_global_shortcut', { shortcut: useSavedShortcut ? savedShortcut : input.value, enabled: enabled.checked })); }
    catch (error) {
      const message = String(error);
      try { render(await invoke('get_global_shortcut')); } catch { /* Preserve the error below. */ }
      status.textContent = message;
    } finally { busy = false; save.disabled = false; enabled.disabled = false; }
  };
  try {
    await desktop.event.listen('bete-open-command-search', () => window.dispatchEvent(new Event('bete-open-command-search')));
    render(await invoke('get_global_shortcut'));
    section.hidden = false;
    save.addEventListener('click', () => persist());
    enabled.addEventListener('change', () => persist(true));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); persist(); } });
  } catch (error) { section.hidden = false; save.disabled = true; enabled.disabled = true; status.textContent = 'Raccourci global indisponible : ' + String(error); }
}
