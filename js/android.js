import { initDrive } from './drive.js?v=mwt1ps8b';
import { initApplications } from './applications.js?v=mwt1ps8b';
import { initDesktopCalendar } from './calendar.js?v=mwt1ps8b';
export async function initAndroid() {
  const native = window.__BETE_ANDROID_NATIVE__;
  document.getElementById('drive-status').closest('section').hidden = false;
  initDrive();
  await initDesktopCalendar();
  await initApplications({ core: native.core, event: { listen: async () => () => {} } });
}
