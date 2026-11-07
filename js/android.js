import { initDrive } from './drive.js?v=mw6xpxbq';
import { initApplications } from './applications.js?v=mw6xpxbq';
import { initDesktopCalendar } from './calendar.js?v=mw6xpxbq';
export async function initAndroid() {
  const native = window.__BETE_ANDROID_NATIVE__;
  document.getElementById('drive-status').closest('section').hidden = false;
  initDrive();
  await initDesktopCalendar();
  await initApplications({ core: native.core, event: { listen: async () => () => {} } });
}
