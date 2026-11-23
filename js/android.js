import { initDrive } from './drive.js?v=mwt2c0kj';
import { initApplications } from './applications.js?v=mwt2c0kj';
import { initDesktopCalendar } from './calendar.js?v=mwt2c0kj';
export async function initAndroid() {
  const native = window.__BETE_ANDROID_NATIVE__;
  document.getElementById('drive-status').closest('section').hidden = false;
  initDrive();
  await initDesktopCalendar();
  await initApplications({ core: native.core, event: { listen: async () => () => {} } });
}
