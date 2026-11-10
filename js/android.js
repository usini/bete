import { initDrive } from './drive.js?v=mwag82om';
import { initApplications } from './applications.js?v=mwag82om';
import { initDesktopCalendar } from './calendar.js?v=mwag82om';
export async function initAndroid() {
  const native = window.__BETE_ANDROID_NATIVE__;
  document.getElementById('drive-status').closest('section').hidden = false;
  initDrive();
  await initDesktopCalendar();
  await initApplications({ core: native.core, event: { listen: async () => () => {} } });
}
