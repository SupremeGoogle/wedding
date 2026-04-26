/* ================================================================
   СВАДЕБНОЕ ПРИГЛАШЕНИЕ — SCRIPT.JS
   ================================================================ */

(function() {
  'use strict';

  /* ---------- ENVELOPE OPEN ---------- */
  const cover       = document.getElementById('cover');
  const mainContent = document.getElementById('mainContent');
  const coverVideo  = document.getElementById('coverVideo');
  const coverHint   = document.getElementById('coverHint');
  const coverStatus = document.getElementById('coverStatus');
  const questGame   = document.getElementById('questGame');
  const questContent = document.getElementById('questContent');
  const questSpeech = document.getElementById('questSpeech');
  const questCharacter = document.getElementById('questCharacter');
  const questCharacterWrap = document.querySelector('.quest-character-wrap');
  const questTimer  = document.getElementById('questTimer');
  const questLeaderboard = document.getElementById('questLeaderboard');
  const questBoard = document.getElementById('questBoard');
  const API_URL     = (window.WEDDING_API_URL || '').trim();
  const PAGE_PARAMS = new URLSearchParams(window.location.search);
  const GAME_MODE = PAGE_PARAMS.get('mode') === 'game';
  const GAME_AUTOSTART = PAGE_PARAMS.get('autostart') === '1';
  var siteOpened    = false;
  var introStarted  = false;
  var flashTriggered = false;

  const STORAGE_KEY_RESPONSES = 'wedding_responses';
  const STORAGE_KEY_CLIENT_ID = 'wedding_client_id';
  const STORAGE_KEY_MIGRATED = 'wedding_migrated_fingerprints_v1';
  const STORAGE_KEY_QUIZ_RESULTS = 'wedding_quiz_results';
  const DRINK_LABELS = {
    wine: 'Вино',
    sparkling: 'Игристое',
    vodka: 'Водка',
    whiskey: 'Виски',
    cognac: 'Коньяк',
    soft: 'Безалкогольные'
  };

  function getClientId() {
    var existing = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
    if (existing) return existing;
    var created = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, created);
    return created;
  }

  function readLocalResponses() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_RESPONSES) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Не удалось прочитать локальные ответы:', err);
      return [];
    }
  }

  function writeLocalResponses(responses) {
    localStorage.setItem(STORAGE_KEY_RESPONSES, JSON.stringify(responses));
  }

  function readMigratedFingerprints() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_MIGRATED) || '[]');
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      return new Set();
    }
  }

  function persistMigratedFingerprints(set) {
    localStorage.setItem(STORAGE_KEY_MIGRATED, JSON.stringify(Array.from(set)));
  }

  function normalizeDrinkValues(values) {
    return values.map(function(v) {
      return DRINK_LABELS[v] || v;
    });
  }

  function makeHash(input) {
    var hash = 0;
    for (var i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return String(Math.abs(hash));
  }

  function buildFingerprint(response) {
    var base = [
      response.id || '',
      response.name || '',
      response.attendance || '',
      response.drinks || '',
      response.music || '',
      response.timestamp || ''
    ].join('|');
    return 'fp_' + makeHash(base);
  }

  async function postApi(action, payload) {
    if (!API_URL) return { ok: false, offline: true };
    var res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    });
    if (!res.ok) throw new Error('API ' + res.status);
    var contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.indexOf('application/json') === -1) {
      throw new Error('API returned non-JSON. Check Apps Script access/deploy settings.');
    }
    return res.json();
  }

  async function getApi(action) {
    if (!API_URL) return { ok: false, offline: true };
    var res = await fetch(API_URL + '?action=' + encodeURIComponent(action), { method: 'GET' });
    if (!res.ok) throw new Error('API ' + res.status);
    var contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.indexOf('application/json') === -1) {
      throw new Error('API returned non-JSON. Check Apps Script access/deploy settings.');
    }
    return res.json();
  }

  async function migrateLocalResponsesOnce() {
    if (!API_URL) return;
    var responses = readLocalResponses();
    if (!responses.length) return;

    var clientId = getClientId();
    var migrated = readMigratedFingerprints();

    for (var i = 0; i < responses.length; i++) {
      var item = responses[i] || {};
      if (!item.id) {
        item.id = clientId + '_legacy_' + i;
      }
      item.music = item.music || '';
      item.drinks = item.drinks || '';

      var fingerprint = buildFingerprint(item);
      if (migrated.has(fingerprint)) continue;

      try {
        var result = await postApi('migrate', {
          clientId: clientId,
          fingerprint: fingerprint,
          response: item
        });

        if (result && result.ok) {
          migrated.add(fingerprint);
          persistMigratedFingerprints(migrated);
        }
      } catch (err) {
        console.warn('Миграция локальных данных не завершена:', err);
        break;
      }
    }

    writeLocalResponses(responses);
  }

  const QUEST_STAGES = [
    {
      type: 'question',
      character: 'Жених1.png',
      speech: 'Первая загадка уже здесь. Справишься?',
      question: 'Если вдруг сбылась мечта: рядом галстук и фата, если гости ждут в усадьбе, значит, это ваша…',
      options: ['Брак', 'Дружба', 'Свадьба', 'Вечеринка'],
      correct: 2
    },
    {
      type: 'question',
      character: 'Жених1.png',
      speech: 'Следующая загадка приведет нас ближе.',
      question: 'Как расшифровывается ЗАГС?',
      options: ['Зона Активных Гостей Свадьбы', 'Зал Ароматов, Гостей и Смеха', 'Запись Актов Гражданского Состояния', 'Заявление о Активной Годовщине Свадьбы'],
      correct: 2
    },
    {
      type: 'question',
      character: 'Жених1.png',
      speech: 'Давай еще один шаг..',
      question: 'Кто сделал первый шаг?',
      options: ['Виктор', 'Диана'],
      correct: 0
    },
    {
      type: 'champagne',
      character: 'Жених1.png',
      speech: 'Смотри, шампанское! Нажимай на бокал как можно больше раз за 10 секунд.',
      duration: 10
    },
    {
      type: 'bouquet',
      miniGame: 'bouquet',
      character: 'Жених1.png',
      speech: 'Финальное испытание! Лови букет - он телепортируется, успей нажать как можно больше раз за 10 секунд.',
      duration: 10
    }
  ];

  const questState = {
    started: false,
    finished: false,
    stageIndex: -1,
    correctCount: 0,
    champagneHits: 0,
    champagnePoints: 0,
    bouquetHits: 0,
    bouquetPoints: 0,
    playerName: '',
    playerId: '',
    sessionId: '',
    startedAt: 0,
    timerHandle: null,
    speechHandle: null,
    bouquetMoveHandle: null,
    bouquetTickHandle: null
  };

  function formatMs(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function calcChampagnePoints(clicks) {
    if (clicks < 5) return 0;
    if (clicks <= 10) return 1;
    if (clicks <= 20) return 2;
    if (clicks <= 30) return 3;
    if (clicks <= 40) return 4;
    if (clicks <= 50) return 5;
    if (clicks <= 60) return 6;
    if (clicks <= 70) return 7;
    if (clicks <= 80) return 8;
    if (clicks <= 90) return 9;
    if (clicks <= 100) return 10;
    return 12;
  }

  function calcBouquetPoints(clicks) {
    if (clicks < 4) return 0;
    if (clicks <= 8) return 1;
    if (clicks <= 12) return 2;
    if (clicks <= 16) return 3;
    if (clicks <= 20) return 4;
    if (clicks <= 24) return 5;
    if (clicks <= 28) return 6;
    if (clicks <= 32) return 7;
    if (clicks <= 36) return 8;
    if (clicks <= 40) return 9;
    return 10;
  }

  function setQuestCharacter(src) {
    if (!questCharacter) return;
    var fallback = 'Невеста1.png';
    questCharacter.onerror = function() {
      if (questCharacter.getAttribute('src') !== fallback) questCharacter.setAttribute('src', fallback);
    };
    questCharacter.classList.remove('quest-character-enter');
    void questCharacter.offsetWidth;
    questCharacter.classList.add('quest-character-enter');
    questCharacter.setAttribute('src', src || fallback);
  }

  function setQuestCharacterVisible(visible) {
    if (!questCharacterWrap) return;
    questCharacterWrap.style.display = visible ? '' : 'none';
  }

  function typeSpeech(text) {
    if (!questSpeech) return;
    if (questState.speechHandle) window.clearInterval(questState.speechHandle);
    questSpeech.classList.add('typing');
    questSpeech.textContent = '';
    var i = 0;
    questState.speechHandle = window.setInterval(function() {
      i += 1;
      questSpeech.textContent = text.slice(0, i);
      if (i >= text.length) {
        window.clearInterval(questState.speechHandle);
        questState.speechHandle = null;
        questSpeech.classList.remove('typing');
      }
    }, 24);
  }

  function writeQuestResultsLocal(result) {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY_QUIZ_RESULTS) || '[]');
      if (!Array.isArray(raw)) raw = [];
      raw.push(result);
      localStorage.setItem(STORAGE_KEY_QUIZ_RESULTS, JSON.stringify(raw.slice(-120)));
    } catch (err) {
      console.warn('Не удалось сохранить локальный результат квеста:', err);
    }
  }

  function readQuestResultsLocal() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY_QUIZ_RESULTS) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      return [];
    }
  }

  function bestQuestResults(rows) {
    var bestByName = {};
    rows.forEach(function(row) {
      var key = String((row && row.playerName) || '').trim().toLowerCase() || ('player_' + ((row && row.sessionId) || ''));
      var prev = bestByName[key];
      var score = Number((row && row.totalScore) || 0);
      var timeMs = Number((row && row.timeMs) || 0);
      if (!prev || score > Number(prev.totalScore || 0) || (score === Number(prev.totalScore || 0) && timeMs < Number(prev.timeMs || 0))) {
        bestByName[key] = row;
      }
    });
    return Object.keys(bestByName).map(function(k) { return bestByName[k]; }).sort(function(a, b) {
      var scoreDiff = Number((b && b.totalScore) || 0) - Number((a && a.totalScore) || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return Number((a && a.timeMs) || 0) - Number((b && b.timeMs) || 0);
    });
  }

  function renderQuestLeaderboard(rows, notice) {
    if (!questLeaderboard) return;
    if (!rows || !rows.length) {
      questLeaderboard.textContent = notice || 'Пока нет результатов';
      return;
    }
    questLeaderboard.innerHTML = rows.slice(0, 10).map(function(r, idx) {
      return '<div class="quest-row"><strong>' + (idx + 1) + '</strong><span>' + ((r && r.playerName) || 'Гость') + '</span><span>' + (Number((r && r.totalScore) || 0) || 0) + ' очков</span><span>' + formatMs(Number((r && r.timeMs) || 0)) + '</span></div>';
    }).join('');
  }

  function extractQuizFallbackRowsFromResponses(rows) {
    var out = [];
    (rows || []).forEach(function(r) {
      if (!r || r.attendance !== 'QUIZ') return;
      if (typeof r.music !== 'string' || r.music.indexOf('__QUIZ__') !== 0) return;
      try {
        var payload = JSON.parse(r.music.slice('__QUIZ__'.length));
        out.push(payload);
      } catch (err) {
      }
    });
    return bestQuestResults(out);
  }

  async function saveQuizViaRsvpFallback(result) {
    if (!API_URL) return;
    try {
      await postApi('submit', {
        clientId: getClientId(),
        fingerprint: 'qrf_' + makeHash(result.sessionId + '|' + result.playerName),
        response: {
          id: 'quizfb_' + result.sessionId,
          timestamp: new Date().toLocaleString('ru-RU'),
          name: '[QUIZ] ' + result.playerName,
          attendance: 'QUIZ',
          drinks: 'quiz-fallback',
          music: '__QUIZ__' + JSON.stringify(result)
        }
      });
    } catch (err) {
      console.warn('Fallback сохранение квиза не удалось:', err);
    }
  }

  function updateQuestTimer() {
    if (!questTimer || !questState.startedAt) return;
    questTimer.textContent = formatMs(Date.now() - questState.startedAt);
  }

  function startQuestTimer() {
    if (questState.timerHandle) window.clearInterval(questState.timerHandle);
    questState.startedAt = Date.now();
    updateQuestTimer();
    questState.timerHandle = window.setInterval(updateQuestTimer, 250);
  }

  function stopQuestTimer() {
    if (questState.timerHandle) window.clearInterval(questState.timerHandle);
    questState.timerHandle = null;
  }

  function renderQuestStartCard() {
    if (!questContent) return;
    if (questBoard) questBoard.classList.add('is-hidden');
    setQuestCharacterVisible(false);
    if (questSpeech) {
      questSpeech.classList.remove('typing');
      questSpeech.textContent = '';
    }
    questContent.innerHTML = '' +
      '<div class="quest-card">' +
      '  <p class="quest-question">Ваше имя</p>' +
      '  <input class="fi" id="questPlayerName" type="text" placeholder="Введите имя" style="padding:12px 6px;border-bottom:1px solid #bfa38a;" />' +
      '  <div class="quest-actions" style="margin-top:10px;"><button class="quest-btn primary" id="questStartBtn">Продолжить</button></div>' +
      '</div>';

    var startBtn = document.getElementById('questStartBtn');
    var input = document.getElementById('questPlayerName');
    if (GAME_AUTOSTART && input) {
      setTimeout(function() { input.focus(); }, 180);
    }
    if (startBtn) {
      startBtn.addEventListener('click', async function() {
        var name = (input && input.value ? input.value : '').trim();
        if (!name) {
          if (input) input.focus();
          return;
        }
        await migrateLocalResponsesOnce();
        questState.playerName = name;
        questState.playerId = getClientId();
        questState.sessionId = 'quiz_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        questState.correctCount = 0;
        questState.champagneHits = 0;
        questState.champagnePoints = 0;
        questState.bouquetHits = 0;
        questState.bouquetPoints = 0;
        questState.stageIndex = -1;
        questState.started = false;
        questState.finished = false;
        renderQuestIntroStepOne();
      });
    }
  }

  function renderQuestIntroStepOne() {
    setQuestCharacterVisible(true);
    setQuestCharacter('Жених2.png');
    renderDialogueContinue(
      'Привет, ' + questState.playerName + '. Меня зовут Виктор, я бы хотел попросить тебя о помощи. Диана пропала.... Ты можешь мне помочь?',
      renderQuestIntroStepTwo,
      'Да'
    );
  }

  function renderQuestIntroStepTwo() {
    setQuestCharacter('Жених2.png');
    renderDialogueContinue(
      'Я нашёл записку. В ней сказано: чтобы найти невесту, тебе нужно пройти 5 заданий на время. Справишься?',
      renderQuestIntroStepThree,
      'Да'
    );
  }

  function renderQuestIntroStepThree() {
    setQuestCharacter('Жених1.png');
    renderDialogueContinue('Удачи!', function() {
      questState.started = true;
      startQuestTimer();
      runQuestNextStage();
    }, 'Начать');
  }

  function renderDialogueContinue(speechText, onContinue, buttonText) {
    typeSpeech(speechText);
    questContent.innerHTML = '' +
      '<div class="quest-card">' +
      '  <p class="quest-note">Когда будешь готов(а), продолжим.</p>' +
      '  <div class="quest-actions"><button class="quest-btn primary" id="questContinueBtn">' + (buttonText || 'Продолжить') + '</button></div>' +
      '</div>';
    var btn = document.getElementById('questContinueBtn');
    if (btn) btn.addEventListener('click', onContinue);
  }

  function runQuestNextStage() {
    questState.stageIndex += 1;
    if (questState.stageIndex >= QUEST_STAGES.length) {
      finishQuest();
      return;
    }

    var stage = QUEST_STAGES[questState.stageIndex];
    if (stage.type === 'question') {
      renderQuestionStage(stage);
      return;
    }
    if (stage.type === 'bouquet' || stage.type === 'champagne') {
      renderBouquetStage(stage);
    }
  }

  function renderQuestionStage(stage) {
    if (!questContent) return;
    setQuestCharacter(stage.character);
    renderDialogueContinue(stage.speech, function() {
      renderQuestionCard(stage);
    }, 'Перейти к вопросу');
  }

  function renderQuestionCard(stage) {
    if (!questContent) return;

    var optionsHtml = stage.options.map(function(opt, idx) {
      return '<button class="quest-option" data-idx="' + idx + '">' + opt + '</button>';
    }).join('');

    questContent.innerHTML = '' +
      '<div class="quest-card">' +
      '  <p class="quest-question">' + stage.question + '</p>' +
      '  <div class="quest-options" id="questOptions">' + optionsHtml + '</div>' +
      '  <p class="quest-note" id="questFeedback" style="margin-top:10px;"></p>' +
      '</div>';

    var opts = questContent.querySelectorAll('.quest-option');
    var feedback = document.getElementById('questFeedback');
    var answered = false;

    opts.forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (answered) return;
        answered = true;
        var pick = Number(btn.getAttribute('data-idx'));
        if (pick === stage.correct) {
          questState.correctCount += 1;
          btn.classList.add('correct');
          if (feedback) feedback.textContent = 'Верно! Это приближает нас к встрече.';
        } else {
          btn.classList.add('wrong');
          var correctBtn = questContent.querySelector('.quest-option[data-idx="' + stage.correct + '"]');
          if (correctBtn) correctBtn.classList.add('correct');
          if (feedback) feedback.textContent = 'Почти! Верный ответ подсвечен.';
        }
        opts.forEach(function(optionBtn) { optionBtn.disabled = true; });
        window.setTimeout(runQuestNextStage, 850);
      });
    });
  }

  function moveBouquet(btn, zone) {
    if (!btn || !zone) return;
    var maxX = Math.max(0, zone.clientWidth - btn.clientWidth - 8);
    var maxY = Math.max(0, zone.clientHeight - btn.clientHeight - 8);
    var x = Math.floor(Math.random() * (maxX + 1));
    var y = Math.floor(Math.random() * (maxY + 1));
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
  }

  function clearBouquetTimers() {
    if (questState.bouquetMoveHandle) window.clearInterval(questState.bouquetMoveHandle);
    if (questState.bouquetTickHandle) window.clearInterval(questState.bouquetTickHandle);
    questState.bouquetMoveHandle = null;
    questState.bouquetTickHandle = null;
  }

  function renderBouquetStage(stage) {
    if (!questContent) return;
    setQuestCharacter(stage.character);
    renderDialogueContinue(stage.speech, function() {
      runBouquetStage(stage);
    }, stage.type === 'champagne' ? 'Жать шампанское' : 'Ловить букет');
  }

  function runBouquetStage(stage) {
    if (!questContent) return;

    var isChampagne = stage.type === 'champagne';
    var hitsKey = isChampagne ? 'champagneHits' : 'bouquetHits';
    var pointsKey = isChampagne ? 'champagnePoints' : 'bouquetPoints';
    var emoji = isChampagne ? '🥂' : '💐';
    var actionLabel = isChampagne ? 'Нажимай на шампанское' : 'Лови букет';
    var hitsLabel = isChampagne ? 'Нажатий' : 'Поймано букетов';

    var left = stage.duration;
    questContent.innerHTML = '' +
      '<div class="quest-card">' +
      '  <p class="quest-question">' + actionLabel + '! Осталось: <span id="questBouquetLeft">' + left + '</span> сек.</p>' +
      '  <p class="quest-note">' + hitsLabel + ': <span id="questBouquetHits">0</span></p>' +
      '  <div class="quest-bouquet-zone' + (isChampagne ? ' champagne-zone' : '') + '" id="questBouquetZone"><button class="quest-bouquet' + (isChampagne ? ' champagne-clicker' : '') + '" id="questBouquetBtn" type="button">' + emoji + '</button></div>' +
      '</div>';

    var zone = document.getElementById('questBouquetZone');
    var btn = document.getElementById('questBouquetBtn');
    var leftEl = document.getElementById('questBouquetLeft');
    var hitsEl = document.getElementById('questBouquetHits');

    questState[hitsKey] = 0;
    if (!isChampagne) {
      moveBouquet(btn, zone);
    }

    if (btn) {
      btn.addEventListener('click', function() {
        questState[hitsKey] += 1;
        if (hitsEl) hitsEl.textContent = String(questState[hitsKey]);
        if (isChampagne) {
          btn.classList.remove('popping');
          void btn.offsetWidth;
          btn.classList.add('popping');
        } else {
          moveBouquet(btn, zone);
        }
      });
    }

    clearBouquetTimers();
    if (!isChampagne) {
      questState.bouquetMoveHandle = window.setInterval(function() {
        moveBouquet(btn, zone);
      }, 650);
    }

    questState.bouquetTickHandle = window.setInterval(function() {
      left -= 1;
      if (leftEl) leftEl.textContent = String(Math.max(0, left));
      if (left <= 0) {
        clearBouquetTimers();
        questState[pointsKey] = isChampagne
          ? calcChampagnePoints(questState[hitsKey])
          : calcBouquetPoints(questState[hitsKey]);
        questContent.innerHTML = '' +
          '<div class="quest-card">' +
          '  <p class="quest-question">Время вышло! ' + hitsLabel + ': ' + questState[hitsKey] + '.</p>' +
          '  <p class="quest-note">Бонус за этап: <strong>' + questState[pointsKey] + '</strong> балл(ов).</p>' +
          '  <div class="quest-actions"><button class="quest-btn primary" id="questAfterBouquet">Продолжить</button></div>' +
          '</div>';
        var next = document.getElementById('questAfterBouquet');
        if (next) next.addEventListener('click', runQuestNextStage);
      }
    }, 1000);
  }

  async function loadQuestLeaderboard() {
    if (!questLeaderboard) return;
    var localRows = bestQuestResults(readQuestResultsLocal());
    renderQuestLeaderboard(localRows, API_URL ? 'Пока нет результатов' : 'Лидерборд сейчас локальный для этого устройства');

    if (!API_URL) return;

    try {
      var data = await getApi('quiz_leaderboard');
      var rows = [];
      if (data && Array.isArray(data.leaderboard)) {
        rows = data.leaderboard;
      } else if (data && Array.isArray(data.results)) {
        rows = bestQuestResults(data.results);
      }
      if (rows.length) {
        renderQuestLeaderboard(rows);
      } else if (!Array.isArray(data && data.leaderboard) && !Array.isArray(data && data.results)) {
        try {
          var listData = await getApi('list');
          var fromResponses = extractQuizFallbackRowsFromResponses(listData && listData.responses);
          if (fromResponses.length) {
            renderQuestLeaderboard(fromResponses, 'Лидерборд из fallback-данных');
          } else {
            renderQuestLeaderboard(localRows, 'Лидерборд локальный: обновите Apps Script deployment с quiz_* методами');
          }
        } catch (_) {
          renderQuestLeaderboard(localRows, 'Лидерборд локальный: обновите Apps Script deployment с quiz_* методами');
        }
      }
    } catch (err) {
      console.warn('Не удалось загрузить лидерборд:', err);
      renderQuestLeaderboard(localRows, 'Не удалось загрузить из Google, показан локальный лидерборд');
    }
  }

  async function submitQuestResult(result) {
    writeQuestResultsLocal(result);
    if (!API_URL) return;

    try {
      var apiResult = await postApi('quiz_submit', {
        fingerprint: 'qf_' + makeHash([result.sessionId, result.playerName, result.totalScore, result.timeMs].join('|')),
        result: result
      });
      if (!apiResult || !apiResult.ok || !apiResult.status || !apiResult.sessionId) {
        throw new Error('quiz_submit rejected');
      }
    } catch (err) {
      console.warn('Не удалось отправить результат квеста:', err);
      await saveQuizViaRsvpFallback(result);
    }
  }

  function speechDurationMs(text) {
    return Math.max(1700, (String(text || '').length * 24) + 650);
  }

  function renderQuestFinalCard(timeMs, totalScore) {
    if (!questContent) return;
    questContent.innerHTML = '' +
      '<div class="quest-card">' +
      '  <p class="quest-question">Готово, ' + questState.playerName + '!</p>' +
      '  <p class="quest-note">Правильных ответов: <strong>' + questState.correctCount + '/3</strong></p>' +
      '  <p class="quest-note">Нажатий на шампанское: <strong>' + questState.champagneHits + '</strong></p>' +
      '  <p class="quest-note">Бонус за шампанское: <strong>' + questState.champagnePoints + ' балл(ов)</strong></p>' +
      '  <p class="quest-note">Поймано букетов: <strong>' + questState.bouquetHits + '</strong></p>' +
      '  <p class="quest-note">Бонус за букет: <strong>' + questState.bouquetPoints + ' балл(ов)</strong></p>' +
      '  <p class="quest-note">Время: <strong>' + formatMs(timeMs) + '</strong></p>' +
      '  <p class="quest-note">Итог: <strong>' + totalScore + ' очков</strong></p>' +
      '  <div class="quest-actions" style="margin-top:12px;"><button class="quest-btn primary" id="questRestart">Сыграть еще</button></div>' +
      '</div>';
    var restart = document.getElementById('questRestart');
    if (restart) restart.addEventListener('click', renderQuestStartCard);
  }

  function finishQuest() {
    stopQuestTimer();
    clearBouquetTimers();
    questState.finished = true;
    setQuestCharacter('Молодожены.png');
    typeSpeech('Мы снова вместе! Спасибо за помощь. Ты спас(ла) наш праздник.');

    var timeMs = Math.max(0, Date.now() - questState.startedAt);
    var speedBonus = Math.max(0, 360 - Math.floor(timeMs / 1000) * 4);
    var totalScore = questState.correctCount * 180 + questState.champagnePoints * 22 + questState.bouquetPoints * 30 + speedBonus;

    var result = {
      sessionId: questState.sessionId,
      playerId: questState.playerId,
      playerName: questState.playerName,
      correctCount: questState.correctCount,
      bouquetHits: questState.bouquetHits,
      timeMs: timeMs,
      totalScore: totalScore,
      finishedAt: new Date().toISOString()
    };

    if (questBoard) questBoard.classList.remove('is-hidden');
    submitQuestResult(result).then(loadQuestLeaderboard);

    var firstSpeech = 'Что произошло? Вы меня спасли!';
    setQuestCharacter('Невеста1.png');
    typeSpeech(firstSpeech);
    if (questContent) {
      questContent.innerHTML = '<div class="quest-card"><p class="quest-note">...</p></div>';
    }

    window.setTimeout(function() {
      var secondSpeech = 'Большое спасибо!';
      setQuestCharacter('Молодожены.png');
      typeSpeech(secondSpeech);

      window.setTimeout(function() {
        renderQuestFinalCard(timeMs, totalScore);
      }, speechDurationMs(secondSpeech));
    }, speechDurationMs(firstSpeech) + 4000);
  }

  function initQuestGame() {
    if (!questGame) return;
    if (GAME_MODE) {
      document.body.classList.add('game-mode');
    }
    renderQuestStartCard();
    loadQuestLeaderboard();

    if (GAME_MODE) {
      var music = document.getElementById('weddingMusic');
      if (music) {
        music.pause();
        music.currentTime = 0;
      }
      setTimeout(function() {
        var sec = document.getElementById('quest');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  }

  function setCoverStatus(text) {
    if (!coverStatus) return;
    coverStatus.textContent = text || '';
    coverStatus.classList.toggle('visible', !!text);
  }

  if (coverVideo) {
    coverVideo.pause();
    coverVideo.currentTime = 0;
    coverVideo.load();
    coverVideo.addEventListener('waiting', function() {
      if (introStarted && !siteOpened) setCoverStatus('Загружаем видео...');
    });
    coverVideo.addEventListener('stalled', function() {
      if (introStarted && !siteOpened) setCoverStatus('Слабый интернет, подождите...');
    });
    coverVideo.addEventListener('playing', function() {
      setCoverStatus('');
    });
    coverVideo.addEventListener('canplay', function() {
      if (!introStarted) setCoverStatus('');
    });
    coverVideo.addEventListener('timeupdate', function() {
      if (!introStarted || flashTriggered) return;
      if (!coverVideo.duration || !isFinite(coverVideo.duration)) return;
      var timeLeft = coverVideo.duration - coverVideo.currentTime;
      if (timeLeft <= 0.7) {
        flashTriggered = true;
        if (cover) cover.classList.add('flash-end');
      }
    });
  }

  if (cover) {
    cover.addEventListener('click', openEnvelope);
    cover.addEventListener('touchend', function(e) {
      e.preventDefault();
      openEnvelope();
    });
  }

  if (GAME_MODE) {
    setTimeout(function() {
      revealSite();
    }, 120);
  }

  function openEnvelope() {
    if (cover.classList.contains('is-open') || siteOpened || introStarted) return;
    introStarted = true;

    if (!coverVideo) {
      revealSite();
      return;
    }

    if (coverHint) coverHint.style.opacity = '0';
    setCoverStatus('Загружаем видео...');
    flashTriggered = false;
    if (cover) cover.classList.remove('flash-end');
    coverVideo.currentTime = 0;
    coverVideo.playbackRate = 1.6;
    coverVideo.onended = revealSite;

    function tryPlay() {
      coverVideo.play().then(function() {
      }).catch(function(err) {
        console.warn('Не удалось воспроизвести видео заставки:', err);
        revealSite();
      });
    }

    if (coverVideo.readyState >= 2) {
      tryPlay();
      return;
    }

    var started = false;
    function startOnce() {
      if (started) return;
      started = true;
      coverVideo.removeEventListener('canplay', startOnce);
      coverVideo.removeEventListener('loadeddata', startOnce);
      tryPlay();
    }

    coverVideo.addEventListener('canplay', startOnce);
    coverVideo.addEventListener('loadeddata', startOnce);
    coverVideo.load();

    setTimeout(function() {
      if (!started && !siteOpened) {
        setCoverStatus('Слабый интернет, пробуем запустить...');
        startOnce();
      }
    }, 3000);
  }

  function revealSite() {
    if (siteOpened) return;
    siteOpened = true;

    cover.classList.add('is-open');
    setCoverStatus('');
    document.body.style.overflow = '';
    if (mainContent) {
      mainContent.classList.add('visible');
    }

    var music = document.getElementById('weddingMusic');
    if (music && !GAME_MODE) {
      music.volume = 0.2;
      music.play().catch(function(e) {
        console.warn('Autoplay was prevented or audio failed:', e);
      });
    }

    var musicToggle = document.getElementById('musicToggle');
    if (musicToggle && !GAME_MODE) {
      musicToggle.classList.add('visible', 'playing');
    }

    setTimeout(function() {
      var heroItems = document.querySelectorAll('.fade-in-hero');
      heroItems.forEach(function(el) { el.classList.add('show'); });
    }, 200);
  }

  /* ---------- MUSIC TOGGLE ---------- */
  const musicToggle = document.getElementById('musicToggle');
  const weddingMusic = document.getElementById('weddingMusic');
  if (musicToggle && weddingMusic) {
    musicToggle.addEventListener('click', function() {
      if (GAME_MODE) return;
      if (weddingMusic.paused) {
        weddingMusic.play();
        musicToggle.classList.add('playing');
        musicToggle.innerHTML = '<span>🎵</span>';
      } else {
        weddingMusic.pause();
        musicToggle.classList.remove('playing');
        musicToggle.innerHTML = '<span>🔇</span>';
      }
    });
  }

  // Block scroll while envelope is visible
  if (!GAME_MODE) {
    document.body.style.overflow = 'hidden';
  }

  /* ---------- SCROLL REVEAL ---------- */
  function initReveals() {
    var reveals = document.querySelectorAll('.reveal, .reveal-scale');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function(el) { observer.observe(el); });
  }
  initReveals();

  /* ---------- COUNTDOWN TIMER ---------- */
  var weddingDate = new Date('2026-07-11T12:30:00');

  function updateCountdown() {
    var now  = new Date();
    var diff = weddingDate - now;

    if (diff <= 0) {
      var cd = document.getElementById('countdown');
      if (cd) cd.innerHTML = '<p style="font-family:var(--script);font-size:2rem;color:var(--brown)">Сегодня наш праздник! 🎊</p>';
      return;
    }

    var days  = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins  = Math.floor((diff % 3600000) / 60000);
    var secs  = Math.floor((diff % 60000) / 1000);

    setNum('cd-days',  pad(days));
    setNum('cd-hours', pad(hours));
    setNum('cd-mins',  pad(mins));
    setNum('cd-secs',  pad(secs));
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function setNum(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.textContent !== val) {
      el.textContent = val;
      el.classList.remove('tick');
      void el.offsetWidth;
      el.classList.add('tick');
    }
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ---------- OUTFIT SLIDER ---------- */
  var osTrack   = document.getElementById('osTrack');
  var osPrev    = document.getElementById('osPrev');
  var osNext    = document.getElementById('osNext');
  var osDotsCon = document.getElementById('osDots');
  var osCurrent = 0;

  if (osTrack) {
    var osSlides = osTrack.querySelectorAll('.os-slide');
    var osCount  = osSlides.length;

    // Build dots
    for (var i = 0; i < osCount; i++) {
      var dot = document.createElement('div');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('data-idx', i);
      dot.addEventListener('click', function() { osGoTo(+this.getAttribute('data-idx')); });
      osDotsCon.appendChild(dot);
    }

    osPrev.addEventListener('click', function() { osGoTo(osCurrent - 1); });
    osNext.addEventListener('click', function() { osGoTo(osCurrent + 1); });

    // Touch
    var osTouchX = 0;
    osTrack.addEventListener('touchstart', function(e) { osTouchX = e.touches[0].clientX; }, { passive: true });
    osTrack.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - osTouchX;
      if (Math.abs(dx) > 40) osGoTo(dx < 0 ? osCurrent + 1 : osCurrent - 1);
    });

    // Auto-play
    setInterval(function() { osGoTo(osCurrent >= osCount - 1 ? 0 : osCurrent + 1); }, 4000);
  }

  function osGoTo(n) {
    if (!osTrack) return;
    var osSlides = osTrack.querySelectorAll('.os-slide');
    var osCount  = osSlides.length;
    osCurrent = ((n % osCount) + osCount) % osCount;
    osTrack.style.transform = 'translateX(-' + (osCurrent * 100) + '%)';
    var dots = osDotsCon.querySelectorAll('.dot');
    dots.forEach(function(d, i) {
      d.classList.toggle('active', i === osCurrent);
    });
  }

  /* ---------- WISHES ---------- */
  // Section is now static as per user request.

  /* ---------- RSVP FORM ---------- */
  /* ---------- RSVP FORM ---------- */
  window.handleSubmit = function(e) {
    e.preventDefault();
    const form = document.getElementById('rsvpForm');
    const success = document.getElementById('rsvpSuccess');
    const btn = document.getElementById('submitBtn');
    const formData = new FormData(form);

    const clientId = getClientId();
    const drinks = normalizeDrinkValues(formData.getAll('drinks'));
    const uniqueId = clientId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    const response = {
      id: uniqueId,
      timestamp: new Date().toLocaleString('ru-RU'),
      name: (formData.get('guestName') || '').trim(),
      attendance: formData.get('attendance') === 'yes' ? 'Придет' : 'Не придет',
      drinks: drinks.join(', '),
      music: (formData.get('music') || '').trim()
    };

    const fingerprint = buildFingerprint(response);

    // Save to localStorage (offline safety + one-time migration source)
    const responses = readLocalResponses();
    responses.push(response);
    writeLocalResponses(responses);

    var migrated = readMigratedFingerprints();

    btn.textContent = 'Отправка...';
    btn.disabled = true;

    if (API_URL) {
      postApi('submit', {
        clientId: clientId,
        fingerprint: fingerprint,
        response: response
      }).then(function(result) {
        if (result && result.ok) {
          migrated.add(fingerprint);
          persistMigratedFingerprints(migrated);
        }
      }).catch(function(err) {
        console.warn('Не удалось отправить ответ в Google Sheets:', err);
      });
    }

    setTimeout(function() {
      form.style.opacity = '0';
      form.style.transform = 'scale(0.96)';
      form.style.transition = 'opacity 0.4s, transform 0.4s';
      setTimeout(function() {
        form.style.display = 'none';
        success.classList.add('show');
      }, 400);
    }, 700);
  };

  initQuestGame();
  migrateLocalResponsesOnce();

  /* ---------- PARALLAX LEAVES ---------- */
  var leaves = document.querySelectorAll('.leaf');
  window.addEventListener('scroll', function() {
    var scrollY = window.scrollY || window.pageYOffset;
    leaves.forEach(function(leaf, idx) {
      var speed = 0.03 + idx * 0.015;
      leaf.style.transform = 'translateY(' + (scrollY * speed) + 'px) rotate(' + (idx % 2 === 0 ? -30 + scrollY * 0.01 : 30 - scrollY * 0.01) + 'deg)';
    });
  }, { passive: true });

  /* ---------- POLAROID MOUSE PARALLAX (desktop) ---------- */
  var pLeft  = document.querySelector('.polaroid-left');
  var pRight = document.querySelector('.polaroid-right');
  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('mousemove', function(e) {
      var x = (e.clientX / window.innerWidth - 0.5) * 12;
      var y = (e.clientY / window.innerHeight - 0.5) * 6;
      if (pLeft)  pLeft.style.transform  = 'rotate(' + (-4.5 + x * 0.25) + 'deg) translate(' + x + 'px,' + y + 'px)';
      if (pRight) pRight.style.transform = 'rotate(' + (3 - x * 0.25) + 'deg) translate(' + (-x) + 'px,' + y + 'px)';
    });
  }

  /* ---------- IMAGE SHADER TRANSITION (POLAROIDS) ---------- */
  function initImageShader() {
    const canvases = document.querySelectorAll('.msg-canvas');
    if (!canvases.length) return;

    canvases.forEach(canvas => {
      const container = canvas.parentElement;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;

      const fragmentShader = `
        uniform float uProgress;
        uniform vec2 uResolution;
        uniform vec3 uColor;
        uniform float uSpread;
        varying vec2 vUv;

        float Hash(vec2 p) {
          vec3 p2 = vec3(p.xy, 1.0);
          return fract(sin(dot(p2, vec3(37.1, 61.7, 12.4))) * 3758.5453123);
        }

        float noise(in vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f *= f * (3.0 - 2.0 * f);
          return mix(
            mix(Hash(i + vec2(0.0, 0.0)), Hash(i + vec2(1.0, 0.0)), f.x),
            mix(Hash(i + vec2(0.0, 1.0)), Hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          v += noise(p * 1.0) * 0.5;
          v += noise(p * 2.0) * 0.25;
          v += noise(p * 4.0) * 0.125;
          return v;
        }

        void main() {
          vec2 uv = vUv;
          float aspect = uResolution.x / uResolution.y;
          vec2 centeredUv = (uv - 0.5) * vec2(aspect, 1.0);
          
          float dissolveEdge = (1.0 - uv.y) - uProgress * 1.5 + 0.5;
          float noiseValue = fbm(centeredUv * 15.0);
          float d = dissolveEdge + noiseValue * uSpread;
          
          float pixelSize = 1.0 / uResolution.y;
          float alpha = 1.0 - smoothstep(-pixelSize, pixelSize, d);
          
          gl_FragColor = vec4(uColor, alpha);
        }
      `;

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uProgress: { value: 0 },
          uResolution: { value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
          uColor: { value: new THREE.Vector3(0.96, 0.93, 0.89) },
          uSpread: { value: 0.5 }
        },
        transparent: true
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      function resize() {
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        renderer.setSize(w, h);
        material.uniforms.uResolution.value.set(w, h);
      }
      window.addEventListener('resize', resize);
      resize();

      function render() {
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      }
      render();

      if (window.gsap && window.ScrollTrigger) {
        gsap.to(material.uniforms.uProgress, {
          value: 1,
          scrollTrigger: {
            trigger: container,
            start: "top 60%",
            end: "bottom 20%",
            scrub: true
          }
        });
      }
    });
  }

  initImageShader();

})();
