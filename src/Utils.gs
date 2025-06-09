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

/**
 * getGlobalDb_(): PropertiesService からグローバルマスターDBのスプレッドシートを取得
 * キャッシュサービスによりIDを保持する
 */
function getGlobalDb_() {
  const cacheKey = 'GLOBAL_DB_ID';
  let id = getCacheValue_(cacheKey);
  if (!id) {
    const props = PropertiesService.getScriptProperties();
    id = props.getProperty(typeof PROP_GLOBAL_MASTER_DB !== 'undefined' ? PROP_GLOBAL_MASTER_DB : 'Global_Master_DB');
    if (id) putCacheValue_(cacheKey, id, 3600);
  }
  if (!id) return null;
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    logError_('getGlobalDb_', e);
    return null;
  }
}

/**
 * getTeacherDb_(teacherCode): teacherCode から教師用DBを取得
 */
function getTeacherDb_(teacherCode) {
  teacherCode = String(teacherCode || '').trim();
  if (!teacherCode) return null;
  const cacheKey = 'TEACHER_DB_ID_' + teacherCode;
  let id = getCacheValue_(cacheKey);
  if (!id) {
    const props = PropertiesService.getScriptProperties();
    id = props.getProperty('ssId_' + teacherCode);
    if (id) putCacheValue_(cacheKey, id, 3600);
  }
  if (!id) return null;
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    logError_('getTeacherDb_', e);
    return null;
  }
}
