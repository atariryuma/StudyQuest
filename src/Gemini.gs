/**
 * Gemini APIを呼び出し、指定されたプロンプトに対する応答を返します。
 * @param {string} prompt - ユーザーが入力したプロンプト
 * @param {string} persona - 任意のペルソナ文（先頭に付与される）
 * @return {string} Geminiからの応答テキスト、またはエラーメッセージ
 */
if (typeof logError_ !== 'function') {
  function logError_() {}
}

function callGeminiAPI_GAS(prompt, persona, teacherCode) {
  var base = String(persona || '').trim();
  var finalPrompt = base ? base + '\n' + prompt : prompt;
  teacherCode = teacherCode || '';

  if (teacherCode) {
    var props = PropertiesService.getScriptProperties();
    var key = 'geminiUsage_' + teacherCode;
    var info = props.getProperty(key) || '';
    var today = String(new Date().toDateString());
    var usage;
    try { usage = JSON.parse(info || '{}'); } catch (_) { usage = {}; }
    if (usage.date !== today) {
      usage.date = today;
      usage.count = 0;
    }
    if (usage.count >= 20) {
      return 'AI使用回数が上限に達しました';
    }
    usage.count = (usage.count || 0) + 1;
    props.setProperty(key, JSON.stringify(usage));
    try { logToSpreadsheet({ teacherCode: teacherCode, feedback: finalPrompt }); } catch (e) {}
  }

  var apiKey = getGlobalGeminiApiKey(); // APIキーはPropertiesServiceから取得することを推奨
  if (!apiKey) {
    return 'APIキーが設定されていません';
  }

  // ★★★ 変更点：モデル名を gemini-2.0-flash に更新 ★★★
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  var payload = {
    contents: [{
      parts: [{
        text: finalPrompt
      }]
    }]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var obj;
  try {
    var res = UrlFetchApp.fetch(url, options);
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
    return obj.candidates[0].content.parts.map(function(p) { return p.text; }).join('\n');
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
  var ss = getSpreadsheetByTeacherCode(logData.teacherCode);
  if (!ss) return;
  var sheet = ss.getSheetByName(CONSTS.SHEET_AI_FEEDBACK);
  if (!sheet) return;
  var logId = sheet.getLastRow();
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
function generateFollowupFromAnswer(answerText, persona, teacherCode) {
  answerText = String(answerText || '').trim();
  if (!answerText) return '';
  var prompt = `次の生徒の回答を基に理解を深めるための質問を2つ箇条書きで提示してください。\n回答:「${answerText}」`;
  return callGeminiAPI_GAS(prompt, persona, teacherCode);
}

/**
 * generateProblemPrompt(teacherCode, subject, question, persona):
 * 指定された教科とテーマから新しい問題文を生成
 */
function generateProblemPrompt(teacherCode, subject, question, persona) {
  subject = String(subject || '').trim();
  question = String(question || '').trim();
  if (!subject && !question) return '';
  var prompt = `教科「${subject}」で使用する課題として「${question}」に関する問題文を1つ提案してください。`;
  return callGeminiAPI_GAS(prompt, persona, teacherCode);
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
  var prompt = `「${question}」の回答例として${type}を${count}個箇条書きで提示してください。`;
  return callGeminiAPI_GAS(prompt, persona, teacherCode);
}

/**
 * generateDeepeningPrompt(teacherCode, question, persona):
 * 生徒に更なる考察を促す質問例を生成
 */
function generateDeepeningPrompt(teacherCode, question, persona) {
  question = String(question || '').trim();
  if (!question) return '';
  var prompt = `「${question}」について生徒へ更に考えさせる短い質問を2つ箇条書きで提案してください。`;
  return callGeminiAPI_GAS(prompt, persona, teacherCode);
}

/**
 * callGeminiAPI_(prompt, schema): Gemini API core wrapper returning JSON/text
 */
function callGeminiAPI_(prompt, schema) {
  var apiKey = (typeof getGlobalGeminiApiKey === 'function') ? getGlobalGeminiApiKey() : '';
  if (!apiKey) throw new Error('missing_api_key');
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
  var payload = {
    contents: [{ parts: [{ text: String(prompt || '') }] }],
    generationConfig: { responseMimeType: schema ? 'application/json' : 'text/plain' }
  };
  if (schema) payload.generationConfig.responseSchema = schema;
  var options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  var res = UrlFetchApp.fetch(url, options);
  var obj = JSON.parse(res.getContentText());
  var cand = obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts[0];
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
  var prompt = `Create a ${type} task for subject "${subject}" about "${topic}" and respond in JSON.`;
  var schema = {
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
  var prompt = `Provide a short follow up question about "${topic}" based on "${originalQuestion}".`;
  return callGeminiAPI_(prompt);
}
