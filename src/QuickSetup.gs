function quickStudyQuestSetup() {
  var root = DriveApp.getRootFolder();
  var folder = null;
  var it = root.getFoldersByName('StudyQuest');
  if (it.hasNext()) {
    folder = it.next();
  } else {
    folder = root.createFolder('StudyQuest');
  }

  try {
    DriveApp.getFileById(ScriptApp.getScriptId()).moveTo(folder);
  } catch (e) {}

  var res = initGlobalDb();

  var doc = DocumentApp.create('StudyQuest_Setup_Guide');
  var body = doc.getBody();
  body.appendParagraph('StudyQuest セットアップガイド').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('このフォルダにはアプリのスクリプトとグローバルデータベースが保存されます。');
  body.appendParagraph('教師は初回ログイン時に自動で教師用データベースが作成されます。');
  body.appendParagraph('グローバルデータベースは全教師で共有し、生徒は読み取り専用で利用します。');

  DriveApp.getFileById(doc.getId()).moveTo(folder);

  return res;
}
