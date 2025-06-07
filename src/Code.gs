// ================================================
// StudyQuest – バックエンド全コード（最終版）
// ================================================

// シート名定数
const SHEET_TOC             = '📜 目次';
const SHEET_TASKS           = '課題一覧';
const SHEET_STUDENTS        = '生徒一覧';
const SHEET_GLOBAL_ANSWERS  = '回答ログ（全体ボード用）';
const SHEET_AI_FEEDBACK     = 'AIフィードバックログ';
const STUDENT_SHEET_PREFIX  = '生徒_'; // 生徒_<ID> 形式の個別シートを想定
const FOLDER_NAME_PREFIX    = 'StudyQuest_';
const SQ_VERSION           = 'v1.0.18';
/**
 * doGet(e): テンプレートにパラメータを埋め込んで返す
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'login';
  const template = HtmlService.createTemplateFromFile(page);
  template.scriptUrl   = ScriptApp.getService().getUrl();
  template.teacher     = (e && e.parameter && e.parameter.teacher)   ? e.parameter.teacher   : '';
  template.grade       = (e && e.parameter && e.parameter.grade)     ? e.parameter.grade     : '';
  template.classroom   = (e && e.parameter && e.parameter['class'])  ? e.parameter['class']  : '';
  template.number      = (e && e.parameter && e.parameter.number)    ? e.parameter.number    : '';
  template.version     = getSqVersion();
  return template
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('StudyQuest');
}
/**
 * exportCacheToTabs(teacherCode):
 * 各クラスのデータシートをキャッシュタブに複製し summary を更新
 * @param {string} teacherCode
 */
function exportCacheToTabs(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;

  const classIdMap = getClassIdMap_(teacherCode);
  const classIds = Object.keys(classIdMap);

  classIds.forEach(id => {
    const sheetName = `_cache_data_${id}`;
    const cacheSheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    cacheSheet.clear();
    const src = ss.getSheetByName(classIdMap[id]);
    if (!src) return;
    const values = src.getDataRange().getValues();
    if (values.length && values[0].length) {
      cacheSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    }
    cacheSheet.hideSheet();
  });

  // summary タブ更新
  const summarySheet = ss.getSheetByName('summary') || ss.insertSheet('summary');
  summarySheet.clear();
  let header = null;
  const rows = [];
  classIds.forEach(id => {
    const cache = ss.getSheetByName(`_cache_data_${id}`);
    if (!cache) return;
    const values = cache.getDataRange().getValues();
    if (!values.length) return;
    if (!header) {
      header = ['classId'].concat(values[0]);
    }
    for (let i = 1; i < values.length; i++) {
      rows.push([id, ...values[i]]);
    }
  });
  if (header) {
    rows.unshift(header);
    summarySheet.getRange(1, 1, rows.length, header.length).setValues(rows);
  }
  summarySheet.hideSheet();
}

/**
 * getCacheData(teacherCode, classId):
 * キャッシュシートからデータを取得
 * @param {string} teacherCode
 * @param {string} classId
 * @return {Array[]} 値配列
 */
function getCacheData(teacherCode, classId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(`_cache_data_${classId}`);
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

/**
 * include(filename):
 * HTML テンプレートを埋め込むためのヘルパー
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
/**
 * 現在の バージョンを返す
 */
function getSqVersion() {
  return SQ_VERSION;
}

// Export for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getSqVersion, exportCacheToTabs, getCacheData };
}
