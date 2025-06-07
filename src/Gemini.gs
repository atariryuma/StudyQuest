function callGeminiAPI_GAS(teacherCode, prompt, persona) {
  const personaMap = {
    '小学生向け': 'あなたは小学校高学年以上向けの優しい先生です。',
    '中学生向け': 'あなたは中学生向けの適切な言葉遣いをする先生です。',
    '教師向け':   'あなたは現役教師が使用するプロンプト形式です。'
  };
  const base = personaMap[persona] || '';
  const finalPrompt = base + '\n' + prompt;
  const apiKey = getGlobalGeminiApiKey();
  if (!apiKey) return 'APIキーが設定されていません';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
  const payload = { contents: [{ parts: [{ text: finalPrompt }] }] };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const obj = JSON.parse(res.getContentText());
  if (obj.candidates && obj.candidates[0] && obj.candidates[0].content) {
    return obj.candidates[0].content.parts.map(p => p.text).join('\n');
  }
  return 'No response';
}

/**
 * logToSpreadsheet(logData): AIフィードバックログを記録
 */
function logToSpreadsheet(logData) {
  const ss = getSpreadsheetByTeacherCode(logData.teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(SHEET_AI_FEEDBACK);
  if (!sheet) return;
  sheet.appendRow([
    new Date(),
    logData.studentId,
    logData.taskId,
    logData.attempt,
    logData.aiCalls,
    logData.answer || '',
    logData.feedback || ''
  ]);
}

/**
 * generateFollowupFromAnswer(teacherCode, answerText, persona):
 * 指定された回答を基に理解を深める質問例を生成
 */
function generateFollowupFromAnswer(teacherCode, answerText, persona) {
  answerText = String(answerText || '').trim();
  if (!answerText) return '';
  const prompt = `次の生徒の回答を基に理解を深めるための質問を2つ箇条書きで提示してください。\n回答:「${answerText}」`;
  return callGeminiAPI_GAS(teacherCode, prompt, persona);
}
