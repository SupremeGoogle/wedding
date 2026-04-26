const SHEET_NAME = 'Responses';
const HEADERS = [
  'rowId',
  'responseId',
  'fingerprint',
  'status',
  'timestamp',
  'name',
  'attendance',
  'drinks',
  'music',
  'sourceClientId',
  'createdAt',
  'updatedAt',
  'deletedAt'
];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'list') {
    return json_({ ok: true, responses: listActive_() });
  }

  return json_({ ok: true, status: 'alive' });
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
    if (status === 'deleted') {
      return { ok: true, status: 'skipped_deleted', responseId: responseId };
    }

    const rowValues = buildRowValues_(responseId, fingerprint, response, clientId, now, false, rowIndex);
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
    return { ok: true, status: 'updated', responseId: responseId };
  }

  const rowValues = buildRowValues_(responseId, fingerprint, response, clientId, now, false, 0);
  sheet.appendRow(rowValues);
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

  const tombstone = [
    Utilities.getUuid(),
    responseId || ('deleted_' + now),
    fingerprint,
    'deleted',
    '',
    '',
    '',
    '',
    '',
    '',
    now,
    now,
    now
  ];
  sheet.appendRow(tombstone);
  return { ok: true, status: 'deleted_tombstone' };
}

function buildRowValues_(responseId, fingerprint, response, clientId, now, deleted, rowIndex) {
  const createdAt = rowIndex > 0 ? String(getSheet_().getRange(rowIndex, 11).getValue() || now) : now;
  return [
    rowIndex > 0 ? String(getSheet_().getRange(rowIndex, 1).getValue() || Utilities.getUuid()) : Utilities.getUuid(),
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
    if ((responseId && rowResponseId === responseId) || (fingerprint && rowFingerprint === fingerprint)) {
      return i + 2;
    }
  }
  return -1;
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

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  return sheet;
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
