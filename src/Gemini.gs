/**
 * Gemini APIを呼び出し、指定されたプロンプトに対する応答を返します。
 * @param {string} prompt - ユーザーが入力したプロンプト
 * @param {string} persona - 任意のペルソナ文（先頭に付与される）
 * @return {string} Geminiからの応答テキスト、またはエラーメッセージ
 */
if (typeof logError_ !== 'function') {
  function logError_() {}
}

function callGeminiAPI_GAS(prompt, persona) {
  const base = String(persona || '').trim();
  const finalPrompt = base ? base + '\n' + prompt : prompt;

  const apiKey = getGlobalGeminiApiKey(); // APIキーはPropertiesServiceから取得することを推奨
  if (!apiKey) {
    return 'APIキーが設定されていません';
  }

  // ★★★ 変更点：モデル名を gemini-2.0-flash に更新 ★★★
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  const payload = {
    contents: [{
      parts: [{
        text: finalPrompt
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let obj;
  try {
    const res = UrlFetchApp.fetch(url, options);
    obj = JSON.parse(res.getContentText());
  } catch (e) {
    if (e.message && e.message.indexOf('Service invoked too many times') !== -1) {
      return '現在、サーバーが混み合っています。しばらくしてから再度お試しください。';
    }
    logError_('callGeminiAPI_GAS', e);
    return 'AIからの応答がありませんでした。';
  }

  // レスポンスの解析部分は変更なし
  if (obj.candidates && obj.candidates[0] && obj.candidates[0].content) {
    return obj.candidates[0].content.parts.map(p => p.text).join('\n');
  }
  
  // エラーハンドリングを少し詳細化
  if (obj.error) {
    Logger.log('Gemini API Error: ' + JSON.stringify(obj.error));
    return 'AIからの応答がありませんでした。エラー: ' + obj.error.message;
  }
  
  return 'AIからの応答がありませんでした。';
}

/**
 * logToSpreadsheet(logData): AIフィードバックログを記録
 */
function logToSpreadsheet(logData) {
  const ss = getSpreadsheetByTeacherCode(logData.teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(SHEET_AI_FEEDBACK);
  if (!sheet) return;
  const logId = sheet.getLastRow();
  sheet.appendRow([
    logId,
    logData.submissionId || '',
    logData.feedback || '',
    new Date()
  ]);
}

/**
 * generateFollowupFromAnswer(answerText, persona):
 * 指定された回答を基に理解を深める質問例を生成
 */
function generateFollowupFromAnswer(answerText, persona) {
  answerText = String(answerText || '').trim();
  if (!answerText) return '';
  const prompt = `次の生徒の回答を基に理解を深めるための質問を2つ箇条書きで提示してください。\n回答:「${answerText}」`;
  return callGeminiAPI_GAS(prompt, persona);
}

/**
 * generateProblemPrompt(teacherCode, subject, question, persona):
 * 指定された教科とテーマから新しい問題文を生成
 */
function generateProblemPrompt(teacherCode, subject, question, persona) {
  subject = String(subject || '').trim();
  question = String(question || '').trim();
  if (!subject && !question) return '';
  const prompt = `教科「${subject}」で使用する課題として「${question}」に関する問題文を1つ提案してください。`;
  return callGeminiAPI_GAS(prompt, persona);
}

/**
 * generateChoicePrompt(teacherCode, question, type, count, persona):
 * 質問に対する選択肢例を生成
 */
function generateChoicePrompt(teacherCode, question, type, count, persona) {
  question = String(question || '').trim();
  type = String(type || '').trim();
  count = Number(count) || 1;
  if (!question) return '';
  const prompt = `「${question}」の回答例として${type}を${count}個箇条書きで提示してください。`;
  return callGeminiAPI_GAS(prompt, persona);
}

/**
 * generateDeepeningPrompt(teacherCode, question, persona):
 * 生徒に更なる考察を促す質問例を生成
 */
function generateDeepeningPrompt(teacherCode, question, persona) {
  question = String(question || '').trim();
  if (!question) return '';
  const prompt = `「${question}」について生徒へ更に考えさせる短い質問を2つ箇条書きで提案してください。`;
  return callGeminiAPI_GAS(prompt, persona);
}

/**
 * callGeminiAPI_(prompt, schema): Gemini API core wrapper returning JSON/text
 */
function callGeminiAPI_(prompt, schema) {
  const apiKey = (typeof getGlobalGeminiApiKey === 'function') ? getGlobalGeminiApiKey() : '';
  if (!apiKey) throw new Error('missing_api_key');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
  const payload = {
    contents: [{ parts: [{ text: String(prompt || '') }] }],
    generationConfig: { responseMimeType: schema ? 'application/json' : 'text/plain' }
  };
  if (schema) payload.generationConfig.responseSchema = schema;
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  const res = UrlFetchApp.fetch(url, options);
  const obj = JSON.parse(res.getContentText());
  const cand = obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts[0];
  if (!cand) throw new Error('no_response');
  if (schema) return JSON.parse(cand.text || '{}');
  return cand.text || '';
}

/**
 * generateTaskContent(subject, topic, type): AI assisted task content generation
 */
function generateTaskContent(subject, topic, type) {
  subject = String(subject || '').trim();
  topic = String(topic || '').trim();
  type = String(type || '').trim();
  const prompt = `Create a ${type} task for subject "${subject}" about "${topic}" and respond in JSON.`;
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      question: { type: 'string' },
      correctAnswer: { type: 'string' },
      explanation: { type: 'string' }
    },
    required: ['title','question','correctAnswer','explanation']
  };
  return callGeminiAPI_(prompt, schema);
}

/**
 * generateFollowUpQuestion(topic, originalQuestion):
 * 与えられたテーマと元の質問から深掘り質問を生成
 */
function generateFollowUpQuestion(topic, originalQuestion) {
  topic = String(topic || '').trim();
  originalQuestion = String(originalQuestion || '').trim();
  const prompt = `Provide a short follow up question about "${topic}" based on "${originalQuestion}".`;
  return callGeminiAPI_(prompt);
}
