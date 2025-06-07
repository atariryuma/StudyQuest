// ================================================
// StudyQuest – バックエンド全コード（最終版）
// ================================================

// シート名定数
const SHEET_TOC        = '📜 目次';
const SHEET_TASKS      = 'Tasks';
const SHEET_SUBMISSIONS = 'Submissions';
const SHEET_STUDENTS   = 'Students';
const SHEET_DASHBOARD  = 'Dashboard';
const SHEET_AI_FEEDBACK = 'AIフィードバックログ';
const SHEET_SETTINGS  = 'Settings';
const STUDENT_SHEET_PREFIX  = '生徒_'; // 生徒_<ID> 形式の個別シートを想定
const FOLDER_NAME_PREFIX    = 'StudyQuest_';
const SQ_VERSION           = 'v1.0.55';
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
  module.exports = { getSqVersion };
}
