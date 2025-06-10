/**
 * Student CSV template utilities
 */

/**
 * Returns the header row for the student CSV template.
 * @return {string} CSV header row
 */
function getStudentTemplateCsv() {
  return 'Email,Name,Grade,Class,Number\n';
}

/**
 * Creates the student_template.csv file in the given folder and
 * stores its file ID using the teacher code.
 * @param {Folder} folder Google Drive folder
 * @param {string} teacherCode teacher code used for property key
 * @return {string|null} Created file ID or null on failure
 */
function createStudentTemplateFile_(folder, teacherCode) {
  try {
    var csv = getStudentTemplateCsv();
    var file = folder.createFile('student_template.csv', csv, MimeType.CSV);
    var props = PropertiesService.getScriptProperties();
    props.setProperty('templateCsv_' + teacherCode, file.getId());
    return file.getId();
  } catch (e) {
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStudentTemplateCsv, createStudentTemplateFile_ };
}
