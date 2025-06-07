/**
 * logError_(where, error): 詳細なエラーログを出力
 */
function logError_(where, error) {
  Logger.log('[' + where + '] ' + error.message);
  if (error.stack) Logger.log(error.stack);
}

/**
 * createFolder_(parentId, name): Drive API でフォルダ作成
 */
function createFolder_(parentId, name) {
  try {
    const file = Drive.Files.insert({
      title: name,
      mimeType: MimeType.FOLDER,
      parents: [{ id: parentId }]
    });
    return DriveApp.getFolderById(file.id);
  } catch (e) {
    logError_('createFolder_' + name, e);
    throw e;
  }
}

/**
 * findSubFolder_(parentId, name): 親フォルダ内で名前一致する最新フォルダを返す
 */
function findSubFolder_(parentId, name) {
  const q = `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  try {
    const res = Drive.Files.list({ q, orderBy: 'createdTime desc', maxResults: 1 });
    const items = res.items || [];
    return items.length ? DriveApp.getFolderById(items[0].id) : null;
  } catch (e) {
    logError_('findSubFolder_', e);
    return null;
  }
}

function getOrCreateSubFolder_(parentFolder, name) {
  const found = findSubFolder_(parentFolder.getId(), name);
  return found || createFolder_(parentFolder.getId(), name);
}
/**
 * overwriteFile_(folder, name, content, mimeType):
 * 同名ファイルを削除して新規作成するユーティリティ
 */
function overwriteFile_(folder, name, content, mimeType) {
  const folderId = folder.getId();
  const q = `'${folderId}' in parents and name='${name}' and trashed=false`;
  try {
    const res = Drive.Files.list({ q });
    (res.items || []).forEach(f => Drive.Files.trash(f.id));
    Drive.Files.insert({ title: name, parents: [{ id: folderId }] },
      Utilities.newBlob(content, mimeType || MimeType.PLAIN_TEXT, name));
  } catch (e) {
    logError_('overwriteFile_', e);
  }
}

/**
 * readFileContent_(folder, name): 指定ファイルの内容を取得
 */
function readFileContent_(folder, name) {
  const folderId = folder.getId();
  const q = `'${folderId}' in parents and name='${name}' and trashed=false`;
  try {
    const res = Drive.Files.list({ q, maxResults: 1 });
    const item = (res.items || [])[0];
    if (item) {
      const file = DriveApp.getFileById(item.id);
      return file.getBlob().getDataAsString();
    }
  } catch (e) {
    logError_('readFileContent_', e);
  }
  return null;
}
function parseSettingsCsv_(csv) {
  const data = { apiKey: '', persona: '', classes: [] };
  if (!csv) return data;
  csv.split(/\r?\n/).forEach(line => {
    const parts = line.split(',');
    if (!parts.length) return;
    if (parts[0] === 'apiKey') {
      data.apiKey = parts[1] ? Utilities.newBlob(Utilities.base64Decode(parts[1])).getDataAsString() : '';
    } else if (parts[0] === 'persona') {
      data.persona = parts[1] || '';
    } else if (parts[0] === 'class' && parts.length >= 3) {
      data.classes.push([parts[1], parts[2]]);
    }
  });
  return data;
}
/**
 * convertRangeToCsv_(range): Range を CSV 文字列に変換
 */
function convertRangeToCsv_(range) {
  const values = range.getValues();
  return values
    .map(row =>
      row
        .map(val => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (/[,"\n]/.test(str)) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
}
/**
 * convertRangeToJson_(sheet): シートのデータを配列オブジェクト化
 */
function convertRangeToJson_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[i][j];
    }
    result.push(rowObj);
  }
  return result;
}
