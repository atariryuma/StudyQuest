if (typeof Logger === 'undefined') {
  var Logger = { log: function() {} };
}

/**
 * logError_(where, error): 詳細なエラーログを出力
 */
function logError_(where, error) {
  Logger.log('[' + where + '] ' + error.message);
  if (error.stack) Logger.log(error.stack);
}

//
// Cache helpers
//
if (typeof getCacheValue_ !== 'function') {
  function getCacheValue_(key) {
    if (typeof CacheService === 'undefined') return null;
    try {
      const raw = CacheService.getScriptCache().get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}

if (typeof putCacheValue_ !== 'function') {
  function putCacheValue_(key, value, expSec) {
    if (typeof CacheService === 'undefined') return;
    try {
      CacheService.getScriptCache().put(key, JSON.stringify(value), expSec || 300);
    } catch (e) {}
  }
}

if (typeof removeCacheValue_ !== 'function') {
  function removeCacheValue_(key) {
    if (typeof CacheService === 'undefined') return;
    try {
      CacheService.getScriptCache().remove(key);
    } catch (e) {}
  }
}

//
// Database access helpers
//
function getGlobalDb_() {
  const cacheKey = 'GLOBAL_DB';
  const cached = typeof getCacheValue_ === 'function' ? getCacheValue_(cacheKey) : null;
  if (cached) {
    if (typeof cached.getSheetByName === 'function') return cached;
    try {
      const ss = SpreadsheetApp.openById(cached);
      if (typeof putCacheValue_ === 'function') putCacheValue_(cacheKey, ss, 300);
      return ss;
    } catch (e) {
      if (typeof logError_ === 'function') logError_('getGlobalDb_', e);
    }
  }
  const props = PropertiesService.getScriptProperties();
  const propName = (typeof CONSTS !== 'undefined' && CONSTS.PROP_GLOBAL_MASTER_DB) ? CONSTS.PROP_GLOBAL_MASTER_DB : 'Global_Master_DB';
  const id = props.getProperty(propName);
  if (!id) return null;
  try {
    const ss = SpreadsheetApp.openById(id);
    if (typeof putCacheValue_ === 'function') putCacheValue_(cacheKey, ss, 300);
    return ss;
  } catch (e) {
    if (typeof logError_ === 'function') logError_('getGlobalDb_', e);
    return null;
  }
}

function getTeacherDb_(teacherCode) {
  teacherCode = String(teacherCode || '').trim();
  if (!teacherCode) return null;
  const cacheKey = 'teacherdb_' + teacherCode;
  const cached = typeof getCacheValue_ === 'function' ? getCacheValue_(cacheKey) : null;
  if (cached) {
    if (typeof cached.getSheetByName === 'function') return cached;
    try {
      const ss = SpreadsheetApp.openById(cached);
      if (typeof putCacheValue_ === 'function') putCacheValue_(cacheKey, ss, 300);
      return ss;
    } catch (e) {
      if (typeof logError_ === 'function') logError_('getTeacherDb_', e);
    }
  }
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(CONSTS.PROP_TEACHER_SSID_PREFIX + teacherCode);
  if (!id) return null;
  try {
    const ss = SpreadsheetApp.openById(id);
    if (typeof putCacheValue_ === 'function') putCacheValue_(cacheKey, ss, 300);
    return ss;
  } catch (e) {
    if (typeof logError_ === 'function') logError_('getTeacherDb_', e);
    return null;
  }
}

function isAdminUser_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return false;
  var db = getGlobalDb_();
  if (!db) return false;
  var sheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!sheet) return false;
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var data = sheet.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      return String(data[i][2]).trim().toLowerCase() === 'admin';
    }
  }
  return false;
}
