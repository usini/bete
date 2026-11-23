import { initDrive } from './drive.js?v=mwt31xgb';
import { initApplications } from './applications.js?v=mwt31xgb';
import { initDesktopCalendar } from './calendar.js?v=mwt31xgb';
export async function initAndroid() {
  const native = window.__BETE_ANDROID_NATIVE__;
  document.getElementById('drive-status').closest('section').hidden = false;
  initDrive();
  await initDesktopCalendar();
  await initApplications({ core: native.core, event: { listen: async () => () => {} } });
}
