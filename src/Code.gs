// ================================================
// StudyQuest – バックエンド全コード（最終版）
// ================================================

// シート名定数
const SHEET_TOC        = '📜 目次';
const SHEET_TASKS      = 'Tasks';
const SHEET_SUBMISSIONS = 'Submissions';
const SHEET_STUDENTS   = 'Students';
const SHEET_TROPHIES   = 'Trophies';
const SHEET_ITEMS      = 'Items';
// 以前は日本語名 "AIフィードバックログ" を使用していましたが、
// README の表記に合わせて英語名に変更
const SHEET_AI_FEEDBACK = 'AI_Log';
const SHEET_SETTINGS  = 'Settings';
const STUDENT_SHEET_PREFIX  = '生徒_'; // 生徒_<ID> 形式の個別シートを想定
const FOLDER_NAME_PREFIX    = 'StudyQuest_';
const PROP_GLOBAL_MASTER_DB = 'Global_Master_DB';
const SQ_VERSION           = 'v1.0.209';
// Global DB sheet names
const SHEET_GLOBAL_USERS        = 'Global_Users';
const SHEET_GLOBAL_TROPHIES_LOG = 'Global_Trophies_Log';
const SHEET_GLOBAL_ITEMS        = 'Global_Items_Inventory';
/**
 * doGet(e): テンプレートにパラメータを埋め込んで返す
 */
function doGet(e) {
  console.time('doGet');
  if (e && e.parameter && e.parameter.download === 'student_template.csv') {
    const csv = getStudentTemplateCsv();
    console.timeEnd('doGet');
    return ContentService
      .createTextOutput(csv)
      .downloadAsFile('student_template.csv')
      .setMimeType(ContentService.MimeType.CSV);
  }
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'login';
  const template = HtmlService.createTemplateFromFile(page);
  template.scriptUrl   = ScriptApp.getService().getUrl();
  template.teacher     = (e && e.parameter && e.parameter.teacher)   ? e.parameter.teacher   : '';
  template.grade       = (e && e.parameter && e.parameter.grade)     ? e.parameter.grade     : '';
  template.classroom   = (e && e.parameter && e.parameter['class'])  ? e.parameter['class']  : '';
  template.number      = (e && e.parameter && e.parameter.number)    ? e.parameter.number    : '';
  template.version     = getSqVersion();
  const result = template
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('StudyQuest');
  console.timeEnd('doGet');
  return result;
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

/**
 * 現在ログイン中のユーザー情報を返す
 */
function getCurrentUser() {
  const email = Session.getEffectiveUser().getEmail();
  return { email: email };
}

/**
 * CSVテンプレート文字列を返す
 */
function getStudentTemplateCsv() {
  return 'Email,Name,Grade,Class,Number\n';
}

// Export for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getSqVersion, getStudentTemplateCsv };
}
