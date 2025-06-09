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
function getCacheValue_(key) {
  if (typeof CacheService === 'undefined') return null;
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function putCacheValue_(key, value, expSec) {
  if (typeof CacheService === 'undefined') return;
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), expSec || 300);
  } catch (e) {}
}

function removeCacheValue_(key) {
  if (typeof CacheService === 'undefined') return;
  try {
    CacheService.getScriptCache().remove(key);
  } catch (e) {}
}

//
// Database access helpers
//
function getGlobalDb_() {
  const cacheKey = 'GLOBAL_DB';
  const cached = typeof getCacheValue_ === 'function' ? getCacheValue_(cacheKey) : null;
  if (cached) return cached;
  const props = PropertiesService.getScriptProperties();
  const propName = (typeof PROP_GLOBAL_MASTER_DB !== 'undefined') ? PROP_GLOBAL_MASTER_DB : 'Global_Master_DB';
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
  if (cached) return cached;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ssId_' + teacherCode);
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
