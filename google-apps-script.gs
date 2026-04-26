const SHEET_NAME = 'Responses';
const HEADERS = [
  'rowId', 'responseId', 'fingerprint', 'status', 'timestamp', 'name', 'attendance', 'drinks', 'music', 'sourceClientId', 'createdAt', 'updatedAt', 'deletedAt'
];

const QUIZ_SHEET_NAME = 'QuizResults';
const QUIZ_HEADERS = [
  'rowId', 'sessionId', 'playerId', 'fingerprint', 'status', 'playerName', 'correctCount', 'bouquetHits', 'timeMs', 'totalScore', 'finishedAt', 'createdAt', 'updatedAt', 'deletedAt'
];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'list') {
    return json_({ ok: true, responses: listActive_() });
  }
  if (action === 'quiz_list') {
    return json_({ ok: true, results: listQuizActive_() });
  }
  if (action === 'quiz_leaderboard') {
    return json_({ ok: true, leaderboard: quizLeaderboard_() });
  }

  const ss = getSpreadsheet_();
  return json_({ ok: true, status: 'alive', spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = body.action;

    if (action === 'submit' || action === 'migrate') {
      return json_(upsertResponse_(body));
    }
    if (action === 'delete') {
      return json_(deleteResponse_(body));
    }
    if (action === 'quiz_submit') {
      return json_(upsertQuizResult_(body));
    }
    if (action === 'quiz_delete') {
      return json_(deleteQuizResult_(body));
    }

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function listActive_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if ((row[3] || 'active') !== 'active') continue;

    rows.push({
      responseId: String(row[1] || ''),
      fingerprint: String(row[2] || ''),
      timestamp: String(row[4] || ''),
      name: String(row[5] || ''),
      attendance: String(row[6] || ''),
      drinks: String(row[7] || ''),
      music: String(row[8] || '')
    });
  }

  rows.sort(function(a, b) {
    return b.timestamp.localeCompare(a.timestamp, 'ru');
  });
  return rows;
}

function upsertResponse_(payload) {
  const sheet = getSheet_();
  const now = new Date().toISOString();
  const response = payload.response || {};
  const clientId = String(payload.clientId || '');
  const responseId = String(response.id || ('generated_' + now));
  const fingerprint = String(payload.fingerprint || buildFingerprint_(response));

  const rowIndex = findRowIndex_(sheet, responseId, fingerprint);
  if (rowIndex > 0) {
    const status = String(sheet.getRange(rowIndex, 4).getValue() || 'active');
    if (status === 'deleted') return { ok: true, status: 'skipped_deleted', responseId: responseId };

    const rowValues = buildRowValues_(responseId, fingerprint, response, clientId, now, false, rowIndex);
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
    return { ok: true, status: 'updated', responseId: responseId };
  }

  sheet.appendRow(buildRowValues_(responseId, fingerprint, response, clientId, now, false, 0));
  return { ok: true, status: 'created', responseId: responseId };
}

function deleteResponse_(payload) {
  const sheet = getSheet_();
  const now = new Date().toISOString();
  const responseId = String(payload.responseId || '');
  const fingerprint = String(payload.fingerprint || '');

  const rowIndex = findRowIndex_(sheet, responseId, fingerprint);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 4).setValue('deleted');
    sheet.getRange(rowIndex, 12).setValue(now);
    sheet.getRange(rowIndex, 13).setValue(now);
    return { ok: true, status: 'deleted', responseId: responseId };
  }

  sheet.appendRow([Utilities.getUuid(), responseId || ('deleted_' + now), fingerprint, 'deleted', '', '', '', '', '', '', now, now, now]);
  return { ok: true, status: 'deleted_tombstone' };
}

function buildRowValues_(responseId, fingerprint, response, clientId, now, deleted, rowIndex) {
  const sheet = getSheet_();
  const createdAt = rowIndex > 0 ? String(sheet.getRange(rowIndex, 11).getValue() || now) : now;
  const rowId = rowIndex > 0 ? String(sheet.getRange(rowIndex, 1).getValue() || Utilities.getUuid()) : Utilities.getUuid();

  return [
    rowId,
    responseId,
    fingerprint,
    deleted ? 'deleted' : 'active',
    String(response.timestamp || ''),
    String(response.name || ''),
    String(response.attendance || ''),
    String(response.drinks || ''),
    String(response.music || ''),
    clientId,
    createdAt,
    now,
    deleted ? now : ''
  ];
}

function findRowIndex_(sheet, responseId, fingerprint) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowResponseId = String(row[1] || '');
    const rowFingerprint = String(row[2] || '');
    if ((responseId && rowResponseId === responseId) || (fingerprint && rowFingerprint === fingerprint)) return i + 2;
  }
  return -1;
}

function upsertQuizResult_(payload) {
  const sheet = getQuizSheet_();
  const now = new Date().toISOString();
  const result = payload.result || {};
  const sessionId = String(result.sessionId || ('quiz_' + now));
  const playerId = String(result.playerId || '');
  const fingerprint = String(payload.fingerprint || result.fingerprint || buildQuizFingerprint_(result));

  const rowIndex = findQuizRowIndex_(sheet, sessionId, fingerprint);
  if (rowIndex > 0) {
    const status = String(sheet.getRange(rowIndex, 5).getValue() || 'active');
    if (status === 'deleted') return { ok: true, status: 'skipped_deleted', sessionId: sessionId };

    const rowValues = buildQuizRowValues_(sessionId, playerId, fingerprint, result, now, false, rowIndex);
    sheet.getRange(rowIndex, 1, 1, QUIZ_HEADERS.length).setValues([rowValues]);
    return { ok: true, status: 'updated', sessionId: sessionId };
  }

  sheet.appendRow(buildQuizRowValues_(sessionId, playerId, fingerprint, result, now, false, 0));
  return { ok: true, status: 'created', sessionId: sessionId };
}

function deleteQuizResult_(payload) {
  const sheet = getQuizSheet_();
  const now = new Date().toISOString();
  const sessionId = String(payload.sessionId || '');
  const fingerprint = String(payload.fingerprint || '');

  const rowIndex = findQuizRowIndex_(sheet, sessionId, fingerprint);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 5).setValue('deleted');
    sheet.getRange(rowIndex, 13).setValue(now);
    sheet.getRange(rowIndex, 14).setValue(now);
    return { ok: true, status: 'deleted', sessionId: sessionId };
  }

  sheet.appendRow([Utilities.getUuid(), sessionId || ('deleted_' + now), '', fingerprint, 'deleted', '', 0, 0, 0, 0, '', now, now, now]);
  return { ok: true, status: 'deleted_tombstone' };
}

function listQuizActive_() {
  const sheet = getQuizSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, QUIZ_HEADERS.length).getValues();
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if ((row[4] || 'active') !== 'active') continue;
    rows.push({
      sessionId: String(row[1] || ''),
      playerId: String(row[2] || ''),
      fingerprint: String(row[3] || ''),
      playerName: String(row[5] || ''),
      correctCount: Number(row[6] || 0),
      bouquetHits: Number(row[7] || 0),
      timeMs: Number(row[8] || 0),
      totalScore: Number(row[9] || 0),
      finishedAt: String(row[10] || '')
    });
  }

  rows.sort(function(a, b) {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.timeMs - b.timeMs;
  });
  return rows;
}

function quizLeaderboard_() {
  const rows = listQuizActive_();
  const bestByName = {};
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = String(row.playerName || '').trim().toLowerCase() || ('player_' + row.sessionId);
    const prev = bestByName[key];
    if (!prev || row.totalScore > prev.totalScore || (row.totalScore === prev.totalScore && row.timeMs < prev.timeMs)) {
      bestByName[key] = row;
    }
  }

  const best = Object.keys(bestByName).map(function(k) { return bestByName[k]; });
  best.sort(function(a, b) {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.timeMs - b.timeMs;
  });
  return best.slice(0, 20);
}

function buildQuizRowValues_(sessionId, playerId, fingerprint, result, now, deleted, rowIndex) {
  const sheet = getQuizSheet_();
  const createdAt = rowIndex > 0 ? String(sheet.getRange(rowIndex, 12).getValue() || now) : now;
  const rowId = rowIndex > 0 ? String(sheet.getRange(rowIndex, 1).getValue() || Utilities.getUuid()) : Utilities.getUuid();

  return [
    rowId,
    sessionId,
    playerId,
    fingerprint,
    deleted ? 'deleted' : 'active',
    String(result.playerName || ''),
    Number(result.correctCount || 0),
    Number(result.bouquetHits || 0),
    Number(result.timeMs || 0),
    Number(result.totalScore || 0),
    String(result.finishedAt || ''),
    createdAt,
    now,
    deleted ? now : ''
  ];
}

function findQuizRowIndex_(sheet, sessionId, fingerprint) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const values = sheet.getRange(2, 1, lastRow - 1, QUIZ_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowSessionId = String(row[1] || '');
    const rowFingerprint = String(row[3] || '');
    if ((sessionId && rowSessionId === sessionId) || (fingerprint && rowFingerprint === fingerprint)) return i + 2;
  }
  return -1;
}

function buildQuizFingerprint_(result) {
  return 'qf_' + hash_([
    result.sessionId || '',
    result.playerId || '',
    result.playerName || '',
    result.totalScore || '',
    result.timeMs || ''
  ].join('|'));
}

function buildFingerprint_(response) {
  const base = [
    response.id || '',
    response.name || '',
    response.attendance || '',
    response.drinks || '',
    response.music || '',
    response.timestamp || ''
  ].join('|');
  return 'fp_' + hash_(base);
}

function hash_(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash));
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function getQuizSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(QUIZ_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(QUIZ_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(QUIZ_HEADERS);
  return sheet;
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }

  const created = SpreadsheetApp.create('Wedding RSVP Responses');
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
