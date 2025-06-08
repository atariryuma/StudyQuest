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
