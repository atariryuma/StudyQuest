/**
 * deleteLegacyApiKeys:
 * `${teacherCode}_apiKey` 形式の旧スクリプトプロパティを削除します。
 */
function deleteLegacyApiKeys() {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys() || [];
  keys.forEach(k => {
    if (/\_apiKey$/.test(k) && k !== 'geminiApiKey') {
      props.deleteProperty(k);
    }
  });
}
