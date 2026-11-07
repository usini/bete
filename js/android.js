import { initDrive } from './drive.js?v=mw6rq16y';
import { initApplications } from './applications.js?v=mw6rq16y';
import { initDesktopCalendar } from './calendar.js?v=mw6rq16y';
export async function initAndroid() {
  const native = window.__BETE_ANDROID_NATIVE__;
  document.getElementById('drive-status').closest('section').hidden = false;
  initDrive();
  await initDesktopCalendar();
  await initApplications({ core: native.core, event: { listen: async () => () => {} } });
}
