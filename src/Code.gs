
// 共通定数は consts.gs に移動
const SQ_VERSION = 'v1.0.213';

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
