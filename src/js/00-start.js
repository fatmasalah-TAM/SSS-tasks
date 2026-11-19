
(() => {
'use strict';
/* dates and times follow the app's language (Arabic month names, Western digits) */
var UI_LOC = (() => { try { return JSON.parse(localStorage.getItem('baton.lang') || '"en"') === 'ar' ? 'ar-EG-u-nu-latn' : undefined; } catch { return undefined; } })();
