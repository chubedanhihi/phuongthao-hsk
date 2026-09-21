/**
 * HSK Learning App — app.js
 * ─────────────────────────
 * Đọc dữ liệu từ HSK_DATA (định nghĩa trong data/hsk_data.js).
 * Logic hoàn toàn tách biệt với dữ liệu: chỉ cần thay file hsk_data.js
 * là ứng dụng hoạt động với bộ từ vựng đầy đủ, không cần sửa file này.
 */

/* ═══════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════ */
const State = {
  currentPage:   'dashboard',
  currentLevel:  'all',      // 'all' | 1..9
  fcIndex:       0,
  fcWords:       [],
  fcFlipped:     false,
  fcShuffle:     false,
  fcShowPinyin:  true,
  quizWords:     [],
  quizIndex:     0,
  quizScore:     0,
  quizAnswered:  false,
  quizTotal:     10,
  quizLevel:     'all',
  quizMode:      'hanzi_to_meaning', // 'hanzi_to_meaning' | 'meaning_to_hanzi' | 'hanzi_to_pinyin' | 'listening'
  quizHistory:   [],
  quizWrongWords:[],
  dictFilter:    'all',
  progress:      {},         // { 'lv-id': 'know'|'again' }
  srsQueue:      [],         // [{ word, nextReview, interval, ease }]
};

/* ═══════════════════════════════════════════
   PERSISTENCE
   ═══════════════════════════════════════════ */
const Storage = {
  save()  { localStorage.setItem('hsk_progress', JSON.stringify(State.progress)); localStorage.setItem('hsk_srs', JSON.stringify(State.srsQueue)); },
  load()  {
    try { State.progress = JSON.parse(localStorage.getItem('hsk_progress')) || {}; } catch { State.progress = {}; }
    try { State.srsQueue  = JSON.parse(localStorage.getItem('hsk_srs'))      || []; } catch { State.srsQueue = []; }
  },
};

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
function getWords(level = 'all') {
  return level === 'all' ? ALL_WORDS : ALL_WORDS.filter(w => w.level === parseInt(level));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function progressKey(word) { return `${word.level}-${word.id}`; }

function learnedCount(level) {
  const words = getWords(level);
  return words.filter(w => State.progress[progressKey(w)] === 'know').length;
}

function levelColor(lv) {
  return [
    '',
    '#E53935', // HSK 1
    '#F57C00', // HSK 2
    '#F9A825', // HSK 3
    '#388E3C', // HSK 4
    '#1565C0', // HSK 5
    '#6A1B9A', // HSK 6
    '#C2185B', // HSK 7
    '#00838F', // HSK 8
    '#E65100'  // HSK 9
  ][lv] || '#E53935';
}

function levelName(lv) {
  return `HSK ${lv}`;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function showToast(msg, ms = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

function setPage(page) {
  State.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page-section').forEach(el =>
    el.classList.toggle('hidden', el.id !== `page-${page}`));
  document.querySelector('.topbar-title').textContent = {
    dashboard: '🏠 Tổng quan',
    flashcard: '📚 Flashcard',
    quiz:      '✏️ Kiểm tra',
    dictionary:'🔍 Từ điển',
    strokes:   '✍️ Luyện viết chữ & Bộ thủ',
    srs:       '🔁 Ôn tập SRS',
  }[page];
  // init each section
  if (page === 'dashboard')  renderDashboard();
  if (page === 'flashcard')  initFlashcard();
  if (page === 'quiz')       initQuiz();
  if (page === 'dictionary') renderDictionary();
  if (page === 'strokes')    initStrokes();
  if (page === 'srs')        renderSRS();
  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

/* ═══════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════ */
function renderDashboard() {
  const total   = ALL_WORDS.length;
  const learned = Object.values(State.progress).filter(v => v === 'know').length;
  const due     = State.srsQueue.filter(s => new Date(s.nextReview) <= new Date()).length;

  document.getElementById('dash-total').textContent   = total;
  document.getElementById('dash-learned').textContent = learned;
  document.getElementById('dash-due').textContent     = due;
  document.getElementById('dash-streak').textContent  = getStreak();

  const levelsEl = document.getElementById('dash-levels');
  levelsEl.innerHTML = '';
  for (let lv = 1; lv <= 9; lv++) {
    const words  = getWords(lv);
    const cnt    = words.length;
    const done   = learnedCount(lv);
    const pct    = cnt ? Math.round(done / cnt * 100) : 0;
    const title  = levelName(lv);
    levelsEl.innerHTML += `
      <div class="level-card lv${lv}" onclick="selectLevel(${lv})" title="Học ${title}">
        <div class="level-title">${title}</div>
        <div class="level-count">${done}/${cnt} từ</div>
        <div class="level-progress"><div class="level-progress-bar" style="width:${pct}%"></div></div>
        <div class="level-pct">${pct}%</div>
      </div>`;
  }
}

function getStreak() {
  // Simple streak from localStorage
  const data = JSON.parse(localStorage.getItem('hsk_streak') || '{"streak":0,"last":""}');
  const today = new Date().toDateString();
  if (data.last === today) return data.streak;
  return data.streak; // shown as-is; updated on learn
}
function bumpStreak() {
  const data = JSON.parse(localStorage.getItem('hsk_streak') || '{"streak":0,"last":""}');
  const today = new Date().toDateString();
  if (data.last === today) return;
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  data.streak = data.last === yest.toDateString() ? data.streak + 1 : 1;
  data.last = today;
  localStorage.setItem('hsk_streak', JSON.stringify(data));
}

function selectLevel(lv) {
  State.currentLevel = lv;
  setPage('flashcard');
}

/* ═══════════════════════════════════════════
   FLASHCARD
   ═══════════════════════════════════════════ */
function initFlashcard() {
  let words = getWords(State.currentLevel);
  State.fcWords   = State.fcShuffle ? shuffle(words) : words;
  State.fcIndex   = 0;
  State.fcFlipped = false;
  renderFlashcard();
  updateFCProgress();
}

function renderFlashcard() {
  const words = State.fcWords;
  if (!words.length) {
    document.getElementById('fc-scene').innerHTML =
      '<p class="text-muted" style="text-align:center;padding:40px">Chưa có từ vựng cho cấp độ này.</p>';
    return;
  }
  const idx  = State.fcIndex;
  const word = words[idx];
  const key  = progressKey(word);
  const known = State.progress[key] === 'know';

  document.getElementById('fc-counter').textContent = `${idx + 1} / ${words.length}`;
  document.getElementById('fc-level-label').textContent = levelName(State.currentLevel === 'all' ? word.level : State.currentLevel);

  // Front face
  document.getElementById('fc-hanzi').textContent    = word.hanzi;
  document.getElementById('fc-pinyin-f').textContent = (State.fcShowPinyin && word.pinyin) ? word.pinyin : '';
  document.getElementById('fc-type-badge').textContent = word.type || '';

  // Back face
  document.getElementById('fc-pinyin-b').textContent  = word.pinyin  || '— chưa có pinyin —';
  document.getElementById('fc-meaning').textContent   = word.meaning || '— chưa có nghĩa —';
  document.getElementById('fc-ex-cn').textContent     = word.example || '';
  document.getElementById('fc-ex-py').textContent     = word.example_pinyin  || '';
  document.getElementById('fc-ex-vn').textContent     = word.example_meaning || '';

  // Reset flip
  const wrap = document.getElementById('fc-card-wrap');
  wrap.classList.toggle('flipped', false);
  State.fcFlipped = false;

  // Known marker
  document.getElementById('btn-know').style.opacity  = known ? '0.5' : '1';

  updateFCProgress();
}

function flipCard() {
  State.fcFlipped = !State.fcFlipped;
  document.getElementById('fc-card-wrap').classList.toggle('flipped', State.fcFlipped);
  if (State.fcFlipped) {
    const word = State.fcWords[State.fcIndex];
    speak(word.hanzi);
  }
}

function updateFCProgress() {
  const total = State.fcWords.length;
  const pct   = total ? ((State.fcIndex / total) * 100) : 0;
  document.getElementById('fc-progress-fill').style.width = pct + '%';
}

function fcNavigate(dir) {
  const total = State.fcWords.length;
  if (!total) return;
  State.fcIndex = (State.fcIndex + dir + total) % total;
  State.fcFlipped = false;
  renderFlashcard();
}

function markWord(result) {
  // result: 'know' | 'again'
  const word = State.fcWords[State.fcIndex];
  if (!word) return;
  State.progress[progressKey(word)] = result;
  if (result === 'know') {
    bumpStreak();
    updateSRS(word, true);
  } else {
    updateSRS(word, false);
  }
  Storage.save();
  if (State.fcIndex < State.fcWords.length - 1) {
    fcNavigate(1);
  } else {
    showToast('🎉 Hết thẻ! Bạn đã học xong lượt này.');
    renderFlashcard(); // stay at last card
  }
}

/* ═══════════════════════════════════════════
   SRS — Spaced Repetition (SM-2 simplified)
   ═══════════════════════════════════════════ */
function updateSRS(word, correct) {
  const key   = progressKey(word);
  const now   = Date.now();
  let entry   = State.srsQueue.find(s => s.key === key);

  if (!entry) {
    entry = { key, level: word.level, id: word.id, interval: 1, ease: 2.5, nextReview: now };
    State.srsQueue.push(entry);
  }

  if (correct) {
    entry.interval = Math.round(entry.interval * entry.ease);
    entry.ease     = Math.max(1.3, entry.ease + 0.1);
  } else {
    entry.interval = 1;
    entry.ease     = Math.max(1.3, entry.ease - 0.2);
  }
  entry.nextReview = now + entry.interval * 24 * 60 * 60 * 1000;
  Storage.save();
}

/* ═══════════════════════════════════════════
   QUIZ
   ═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   QUIZ SYSTEM
   ═══════════════════════════════════════════ */
function initQuiz() {
  // Đồng bộ cấp độ được chọn hiện tại sang quiz level nếu chưa đặt
  if (State.currentLevel !== 'all') {
    State.quizLevel = State.currentLevel;
  }
  // Cập nhật giao diện lobby
  document.querySelectorAll('#quiz-level-options .quiz-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === String(State.quizLevel));
  });
  document.querySelectorAll('#quiz-mode-options .quiz-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === State.quizMode);
  });
  document.querySelectorAll('#quiz-count-options .quiz-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.count === String(State.quizTotal));
  });

  document.getElementById('quiz-lobby').classList.remove('hidden');
  document.getElementById('quiz-body').classList.add('hidden');
  document.getElementById('quiz-result').classList.add('hidden');
}

function startQuiz(customWords = null) {
  let pool = customWords || getWords(State.quizLevel);
  if (!pool.length) {
    showToast('Chưa có từ vựng cho cấp độ này!');
    return;
  }
  State.quizWords = shuffle(pool).slice(0, Math.min(State.quizTotal, pool.length));
  State.quizIndex = 0;
  State.quizScore = 0;
  State.quizAnswered = false;
  State.quizHistory = [];
  State.quizWrongWords = [];

  document.getElementById('quiz-lobby').classList.add('hidden');
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('quiz-body').classList.remove('hidden');
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const words = State.quizWords;
  if (!words.length || State.quizIndex >= words.length) {
    showQuizResult();
    return;
  }

  const word = words[State.quizIndex];
  const total = words.length;
  const pct = (State.quizIndex / total) * 100;

  document.getElementById('quiz-progress-fill').style.width = pct + '%';
  document.getElementById('quiz-counter').textContent = `Câu ${State.quizIndex + 1} / ${total}`;
  document.getElementById('quiz-score-badge').textContent = `⭐ ${State.quizScore}`;
  document.getElementById('quiz-feedback').className = 'quiz-feedback';
  document.getElementById('quiz-next-btn').classList.remove('show');
  State.quizAnswered = false;

  const typeLabelEl = document.getElementById('quiz-type-label');
  const hanziEl = document.getElementById('quiz-hanzi');
  const pinyinEl = document.getElementById('quiz-pinyin');
  const audioWrapEl = document.getElementById('quiz-audio-wrap');

  // Lấy các phương án gây nhiễu (distractors)
  const others = ALL_WORDS.filter(w => progressKey(w) !== progressKey(word));
  const poolDistractors = shuffle(others).slice(0, 3);
  const choices = shuffle([word, ...poolDistractors]);

  // Cấu hình giao diện câu hỏi theo chế độ thi
  if (State.quizMode === 'hanzi_to_meaning') {
    typeLabelEl.textContent = `Chọn nghĩa đúng của từ HSK ${word.level}:`;
    hanziEl.textContent = word.hanzi;
    pinyinEl.textContent = word.pinyin || '';
    audioWrapEl.style.display = 'block';
  } else if (State.quizMode === 'meaning_to_hanzi') {
    typeLabelEl.textContent = `Chọn chữ Hán tương ứng với nghĩa:`;
    hanziEl.textContent = word.meaning || '—';
    hanziEl.style.fontSize = '36px';
    pinyinEl.textContent = `Cấp HSK ${word.level}`;
    audioWrapEl.style.display = 'none';
  } else if (State.quizMode === 'hanzi_to_pinyin') {
    typeLabelEl.textContent = `Chọn phiên âm Pinyin đúng:`;
    hanziEl.textContent = word.hanzi;
    pinyinEl.textContent = word.meaning ? `(${word.meaning})` : '';
    audioWrapEl.style.display = 'block';
  } else if (State.quizMode === 'listening') {
    typeLabelEl.textContent = `🔊 Nghe phát âm và chọn từ đúng:`;
    hanziEl.textContent = '🔊 ???';
    pinyinEl.textContent = 'Nhấn nút loa nếu muốn nghe lại';
    audioWrapEl.style.display = 'block';
    // Tự động phát âm khi mở câu hỏi
    setTimeout(() => speak(word.hanzi), 300);
  }

  // Render 4 phương án
  const optWrap = document.getElementById('quiz-options');
  optWrap.innerHTML = '';
  choices.forEach((ch, optIdx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';

    let labelText = '';
    if (State.quizMode === 'hanzi_to_meaning') {
      labelText = ch.meaning || ch.hanzi;
    } else if (State.quizMode === 'meaning_to_hanzi') {
      labelText = `${ch.hanzi}  <span style="font-size:12px;color:var(--brand);margin-left:6px">${ch.pinyin || ''}</span>`;
    } else if (State.quizMode === 'hanzi_to_pinyin') {
      labelText = ch.pinyin || ch.hanzi;
    } else if (State.quizMode === 'listening') {
      labelText = `${ch.hanzi}  <span style="font-size:12px;color:var(--text-muted);margin-left:6px">(${ch.meaning || ''})</span>`;
    }

    btn.innerHTML = `<span style="display:inline-block;width:24px;color:var(--text-muted);font-weight:700">${optIdx + 1}.</span> ${labelText}`;
    btn.dataset.key = progressKey(ch);
    btn.dataset.correct = progressKey(ch) === progressKey(word) ? '1' : '0';
    btn.addEventListener('click', () => answerQuiz(btn, word, ch));
    optWrap.appendChild(btn);
  });
}

function answerQuiz(btn, word, chosenWord) {
  if (State.quizAnswered) return;
  State.quizAnswered = true;

  const correct = btn.dataset.correct === '1';
  const fb = document.getElementById('quiz-feedback');

  // Ghi lại lịch sử câu hỏi
  State.quizHistory.push({
    word: word,
    chosen: chosenWord,
    correct: correct
  });

  if (!correct) {
    State.quizWrongWords.push(word);
  }

  // Đổi trạng thái hiển thị các nút đáp án
  document.querySelectorAll('.quiz-option').forEach(b => {
    b.disabled = true;
    if (b.dataset.correct === '1') b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong');
  });

  if (correct) {
    State.quizScore++;
    fb.innerHTML = `✅ <b>Chính xác!</b> <span>${word.hanzi} [${word.pinyin}] : ${word.meaning}</span>`;
    fb.className = 'quiz-feedback correct';
    updateSRS(word, true);
    bumpStreak();
  } else {
    fb.innerHTML = `❌ <b>Chưa đúng!</b> Đáp án chuẩn: <b style="color:var(--text)">${word.hanzi}</b> [${word.pinyin}] : ${word.meaning}`;
    fb.className = 'quiz-feedback wrong';
    updateSRS(word, false);
  }

  State.progress[progressKey(word)] = correct ? 'know' : 'again';
  Storage.save();
  document.getElementById('quiz-next-btn').classList.add('show');
}

function nextQuiz() {
  State.quizIndex++;
  if (State.quizIndex >= State.quizWords.length) {
    showQuizResult();
  } else {
    renderQuizQuestion();
  }
}

function showQuizResult() {
  document.getElementById('quiz-body').classList.add('hidden');
  document.getElementById('quiz-result').classList.remove('hidden');

  const total = State.quizWords.length;
  const score = State.quizScore;
  const pct = total ? Math.round((score / total) * 100) : 0;

  const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '😊' : '💪';
  const msg = pct >= 90 ? 'Xuất Sắc! Đạt Điểm Tuyệt Đối!' : pct >= 70 ? 'Rất Tốt! Bạn Đã Nắm Vững!' : pct >= 50 ? 'Khá Tốt! Cần Luyện Thêm Một Chút!' : 'Hãy Cố Gắng Luyện Tập Lại Nhé!';

  const modeLabels = {
    hanzi_to_meaning: 'Chữ Hán ➔ Nghĩa Tiếng Việt',
    meaning_to_hanzi: 'Nghĩa Tiếng Việt ➔ Chữ Hán',
    hanzi_to_pinyin: 'Chữ Hán ➔ Phiên âm Pinyin',
    listening: 'Luyện nghe phát âm ➔ Chọn từ'
  };
  const modeText = modeLabels[State.quizMode] || 'Trắc nghiệm';
  document.getElementById('result-subtitle').textContent = `Chế độ: ${modeText} — Cấp độ: ${levelName(State.quizLevel)}`;
  document.getElementById('result-score').textContent = score;
  document.getElementById('result-total').textContent = total;
  document.getElementById('result-pct').textContent = pct + '%';

  // Hiển thị danh sách chi tiết các câu đã làm
  const reviewListEl = document.getElementById('quiz-review-list');
  reviewListEl.innerHTML = '';
  State.quizHistory.forEach((item, idx) => {
    const isOk = item.correct;
    reviewListEl.innerHTML += `
      <div class="quiz-review-item ${isOk ? 'correct' : 'wrong'}">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <span style="font-weight:800;font-size:16px">${isOk ? '✓' : '✗'}</span>
          <div>
            <div style="font-weight:700;font-size:15px">
              ${item.word.hanzi} <span style="color:var(--brand);font-size:13px">[${item.word.pinyin}]</span>
            </div>
            <div style="font-size:12px;color:var(--text-muted)">
              Nghĩa: <b>${item.word.meaning}</b>
            </div>
          </div>
        </div>
        <button class="tts-btn" onclick="speak('${item.word.hanzi.replace(/'/g,"\\'")}')" title="Nghe phát âm">🔊</button>
      </div>`;
  });

  // Hiện nút luyện lại câu sai nếu có
  const retryBtn = document.getElementById('quiz-retry-wrong');
  if (State.quizWrongWords.length > 0) {
    retryBtn.style.display = 'inline-flex';
    retryBtn.textContent = `⚠️ Ôn lại ${State.quizWrongWords.length} câu sai`;
  } else {
    retryBtn.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════
   DICTIONARY
   ═══════════════════════════════════════════ */
function renderDictionary(query = '', filterLevel = 'all') {
  let words = getWords(filterLevel);
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    words = words.filter(w =>
      w.hanzi.includes(q) ||
      (w.pinyin  && w.pinyin.toLowerCase().includes(q)) ||
      (w.meaning && w.meaning.toLowerCase().includes(q))
    );
  }
  const el = document.getElementById('dict-results');
  if (!words.length) {
    el.innerHTML = `<div class="srs-empty"><div class="srs-empty-icon">🔍</div><div class="srs-empty-text">Không tìm thấy từ nào</div></div>`;
    return;
  }

  // show count
  document.getElementById('dict-count').textContent = `${words.length} từ`;

  el.innerHTML = words.slice(0, 200).map(w => {
    const bg = levelColor(w.level);
    const py  = w.pinyin  || '<span style="color:var(--text-dim);font-style:italic">chưa có pinyin</span>';
    const mn  = w.meaning || '<span style="color:var(--text-dim);font-style:italic">chưa có nghĩa</span>';
    return `
      <div class="dict-item" onclick="dictSpeak('${w.hanzi.replace(/'/g,"\\'")}')">
        <div class="dict-hanzi">${w.hanzi}</div>
        <div class="dict-info">
          <div class="dict-pinyin">${py}</div>
          <div class="dict-meaning">${mn}</div>
          ${w.example ? `<div class="dict-example">${w.example}</div>` : ''}
        </div>
        <div class="dict-badge-wrap">
          <span class="lv-badge" style="background:${bg}">${levelName(w.level)}</span>
          <div style="display:flex;gap:6px">
            <button class="tts-btn" style="padding:6px 10px;font-size:12px" onclick="event.stopPropagation();jumpToStrokePractice('${w.hanzi.replace(/'/g,"\\'")}')" title="Tập viết chữ này">✍️ Viết</button>
            <button class="tts-btn" style="padding:6px 10px;font-size:12px" onclick="event.stopPropagation();speak('${w.hanzi.replace(/'/g,"\\'")}')">🔊</button>
          </div>
        </div>
      </div>`;
  }).join('');

  if (words.length > 200) {
    el.innerHTML += `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">Đang hiển thị 200/${words.length} kết quả. Hãy thu hẹp tìm kiếm.</div>`;
  }
}

function jumpToStrokePractice(raw) {
  const char = raw.trim().charAt(0);
  setPage('strokes');
  switchStrokeTab('practice');
  loadStrokeChar(char);
}

function dictSpeak(hanzi) { speak(hanzi); }

/* ═══════════════════════════════════════════
   SRS REVIEW
   ═══════════════════════════════════════════ */
function renderSRS() {
  const now = Date.now();
  const due = State.srsQueue.filter(s => new Date(s.nextReview).getTime() <= now);
  const el  = document.getElementById('srs-content');

  if (!due.length) {
    el.innerHTML = `
      <div class="srs-empty">
        <div class="srs-empty-icon">🌟</div>
        <div class="srs-empty-text">Tuyệt vời! Không có từ nào cần ôn hôm nay.</div>
        <div class="srs-empty-sub">Hãy quay lại vào ngày mai hoặc học thêm từ mới.</div>
      </div>`;
    return;
  }

  const dueWords = due.map(s => ALL_WORDS.find(w => progressKey(w) === s.key)).filter(Boolean);
  el.innerHTML = `
    <div class="section-title">📋 ${dueWords.length} từ cần ôn hôm nay</div>
    <div class="quick-actions">
      <button class="action-btn primary" onclick="startSRSSession()">▶ Bắt đầu ôn tập</button>
    </div>
    <div class="srs-queue-list">
      ${dueWords.map(w => `
        <div class="srs-item">
          <div class="srs-hanzi">${w.hanzi}</div>
          <div class="srs-meta">
            <div style="font-size:14px;font-weight:600;">${w.pinyin}</div>
            <div style="font-size:13px;color:var(--text-muted)">${w.meaning}</div>
            <div class="srs-due">⏰ Cần ôn ngay</div>
          </div>
          <button class="tts-btn" onclick="speak('${w.hanzi}')">🔊</button>
        </div>`).join('')}
    </div>`;
}

function startSRSSession() {
  const now = Date.now();
  const dueKeys = State.srsQueue
    .filter(s => new Date(s.nextReview).getTime() <= now)
    .map(s => s.key);
  const dueWords = ALL_WORDS.filter(w => dueKeys.includes(progressKey(w)));
  State.fcWords   = shuffle(dueWords);
  State.fcIndex   = 0;
  State.fcFlipped = false;
  setPage('flashcard');
}

/* ═══════════════════════════════════════════
   STROKE WRITER & RADICALS MODULE
   ═══════════════════════════════════════════ */
let currentWriterInstance = null;
let canvasCtx = null;
let isDrawingOnCanvas = false;
let currentDrawColor = '#0F172A';
let isCanvasInitialized = false;

function initStrokes() {
  // Mặc định nạp chữ hiện tại hoặc chữ '你'
  const char = document.getElementById('stroke-char-input').value.trim() || '你';
  loadStrokeChar(char);
  renderRadicals();
  renderStrokeRules();
  initFreeDrawingCanvas();
}

function switchStrokeTab(tab) {
  document.querySelectorAll('#page-strokes .filter-chip').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-btn-${tab}`).classList.add('active');

  document.getElementById('stroke-tab-practice').classList.toggle('hidden', tab !== 'practice');
  document.getElementById('stroke-tab-radicals').classList.toggle('hidden', tab !== 'radicals');
  document.getElementById('stroke-tab-rules').classList.toggle('hidden', tab !== 'rules');
}

function loadStrokeChar(rawChar) {
  if (!rawChar) return;
  const char = rawChar.trim().charAt(0);
  document.getElementById('stroke-char-input').value = char;

  // Cập nhật thông tin chữ
  document.getElementById('stroke-info-hanzi').textContent = char;
  const watermark = document.getElementById('canvas-watermark');
  if (watermark) watermark.textContent = char;

  // Tìm thông tin chữ trong ALL_WORDS hoặc RADICALS_DATA
  const foundWord = ALL_WORDS.find(w => w.hanzi === char || w.hanzi.includes(char));
  const foundRadical = (typeof RADICALS_DATA !== 'undefined') ? RADICALS_DATA.find(r => r.radical.includes(char)) : null;

  const py = foundWord ? foundWord.pinyin : (foundRadical ? foundRadical.pinyin : '');
  const mn = foundWord ? foundWord.meaning : (foundRadical ? `${foundRadical.name} — ${foundRadical.meaning}` : '');

  document.getElementById('stroke-info-pinyin').textContent = py || '';
  document.getElementById('stroke-info-meaning').textContent = mn || '—';

  // Khởi tạo Hanzi Writer
  const box = document.getElementById('hanzi-writer-box');
  box.innerHTML = '';

  currentWriterInstance = null;
  if (window.HanziWriter) {
    try {
      currentWriterInstance = HanziWriter.create('hanzi-writer-box', char, {
        width: 250,
        height: 250,
        padding: 15,
        showOutline: true,
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 200,
        strokeColor: '#E11D48',
        outlineColor: '#CBD5E1',
        drawingColor: '#0284C7',
        showHintAfterMisses: 1,
        highlightOnComplete: true,
        charDataLoader: function(c, onComplete, onErr) {
          if (typeof STROKES_CACHE !== 'undefined' && STROKES_CACHE[c]) {
            onComplete(STROKES_CACHE[c]);
            return;
          }
          fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/' + encodeURIComponent(c) + '.json')
            .then(res => {
              if (!res.ok) throw new Error('CDN error');
              return res.json();
            })
            .then(data => {
              if (typeof STROKES_CACHE !== 'undefined') STROKES_CACHE[c] = data;
              onComplete(data);
            })
            .catch(() => {
              fetch('https://unpkg.com/hanzi-writer-data@2.0/' + encodeURIComponent(c) + '.json')
                .then(res => res.json())
                .then(data => {
                  if (typeof STROKES_CACHE !== 'undefined') STROKES_CACHE[c] = data;
                  onComplete(data);
                })
                .catch(err => {
                  if (onErr) onErr(err);
                  renderFallbackStrokeAnimation(c);
                });
            });
        },
        onLoadCharDataError: function() {
          renderFallbackStrokeAnimation(char);
        }
      });

      // Tự động chạy nét sau khi khởi tạo
      setTimeout(() => {
        if (currentWriterInstance) {
          try { currentWriterInstance.animateCharacter(); } catch(e) {}
        }
      }, 200);
    } catch (e) {
      renderFallbackStrokeAnimation(char);
    }
  } else {
    renderFallbackStrokeAnimation(char);
  }

  // Khởi tạo lại canvas vẽ tay
  initFreeDrawingCanvas();
  clearStrokeCanvas();
}

function renderFallbackStrokeAnimation(char) {
  const box = document.getElementById('hanzi-writer-box');
  if (!box) return;
  box.innerHTML = `
    <div style="width:100%;height:100%;display:grid;place-items:center;position:relative">
      <svg viewBox="0 0 200 200" width="220" height="220">
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
          font-family="'Noto Sans SC', sans-serif" font-size="140" font-weight="900"
          fill="none" stroke="#E11D48" stroke-width="4" stroke-dasharray="800" stroke-dashoffset="800">
          ${char}
          <animate attributeName="stroke-dashoffset" values="800;0" dur="2.5s" repeatCount="indefinite" />
        </text>
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
          font-family="'Noto Sans SC', sans-serif" font-size="140" font-weight="900"
          fill="#0F172A" opacity="0.12">
          ${char}
        </text>
      </svg>
    </div>
  `;
}

function initFreeDrawingCanvas() {
  const canvas = document.getElementById('stroke-canvas');
  if (!canvas) return;

  canvasCtx = canvas.getContext('2d');
  let isDown = false;
  let lastX = 0;
  let lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    let cx, cy;
    if (e.touches && e.touches.length > 0) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (cx - rect.left) * scaleX,
      y: (cy - rect.top) * scaleY
    };
  }

  function start(e) {
    e.preventDefault();
    isDown = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;

    canvasCtx.beginPath();
    canvasCtx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    canvasCtx.fillStyle = currentDrawColor;
    canvasCtx.fill();
  }

  function move(e) {
    if (!isDown) return;
    e.preventDefault();
    const pos = getPos(e);

    canvasCtx.beginPath();
    canvasCtx.moveTo(lastX, lastY);
    canvasCtx.lineTo(pos.x, pos.y);
    canvasCtx.strokeStyle = currentDrawColor;
    canvasCtx.lineWidth = 8;
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';
    canvasCtx.stroke();

    lastX = pos.x;
    lastY = pos.y;
  }

  function end(e) {
    if (isDown) {
      isDown = false;
    }
  }

  canvas.onmousedown = start;
  canvas.onmousemove = move;
  canvas.onmouseup = end;
  canvas.onmouseleave = end;

  canvas.ontouchstart = start;
  canvas.ontouchmove = move;
  canvas.ontouchend = end;
  canvas.ontouchcancel = end;
}

function clearStrokeCanvas() {
  const canvas = document.getElementById('stroke-canvas');
  if (canvas && canvasCtx) {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function setCanvasColor(color) {
  currentDrawColor = color;
  document.querySelectorAll('#stroke-tab-practice .fc-btn').forEach(btn => {
    if (btn.id.startsWith('btn-color-')) {
      btn.classList.remove('active');
    }
  });
  if (color === '#0F172A') document.getElementById('btn-color-black')?.classList.add('active');
  if (color === '#E11D48') document.getElementById('btn-color-red')?.classList.add('active');
  if (color === '#0284C7') document.getElementById('btn-color-blue')?.classList.add('active');
}

function renderRadicals(query = '') {
  if (typeof RADICALS_DATA === 'undefined') return;
  const grid = document.getElementById('radicals-grid');
  if (!grid) return;

  let list = RADICALS_DATA;
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(r =>
      r.radical.toLowerCase().includes(q) ||
      r.pinyin.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.meaning.toLowerCase().includes(q) ||
      String(r.strokes) === q
    );
  }

  document.getElementById('radical-count').textContent = `${list.length} bộ thủ`;

  grid.innerHTML = list.map(r => `
    <div class="radical-card" onclick="practiceRadical('${r.radical.replace(/'/g,"\\'")}')" title="Nhấn để tập viết bộ ${r.radical}">
      <span class="radical-strokes-badge">${r.strokes} nét</span>
      <div class="radical-char">${r.radical}</div>
      <div class="radical-pinyin">${r.pinyin}</div>
      <div class="radical-name">Bộ ${r.name}</div>
      <div class="radical-meaning">${r.meaning}</div>
    </div>
  `).join('');
}

function practiceRadical(rawRadical) {
  const char = rawRadical.replace(/[()（）]/g, '').trim().charAt(0);
  switchStrokeTab('practice');
  loadStrokeChar(char);
  showToast(`✍️ Đang nạp bộ thủ: ${char}`);
}

function renderStrokeRules() {
  if (typeof STROKE_RULES === 'undefined') return;
  const listEl = document.getElementById('stroke-rules-list');
  if (!listEl) return;

  listEl.innerHTML = STROKE_RULES.map(rule => `
    <div class="stroke-rule-card">
      <div class="rule-title">${rule.rule}</div>
      <div class="rule-desc">${rule.desc}</div>
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px">BẤM VÀO CHỮ ĐỂ TẬP VIẾT:</div>
      <div class="rule-examples">
        ${rule.examples.map(ex => `
          <button class="rule-example-chip" onclick="practiceRuleChar('${ex}')" title="Tập viết chữ ${ex}">${ex}</button>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function practiceRuleChar(char) {
  switchStrokeTab('practice');
  loadStrokeChar(char);
  showToast(`✍️ Đang nạp chữ: ${char}`);
}

/* ═══════════════════════════════════════════
   LEVEL MODAL
   ═══════════════════════════════════════════ */
function openLevelModal() {
  const overlay = document.getElementById('level-modal');
  overlay.classList.add('open');
  // highlight current
  overlay.querySelectorAll('.modal-lv-btn').forEach(btn => {
    const lv = btn.dataset.level;
    btn.classList.toggle('selected', lv === String(State.currentLevel));
  });
}
function closeLevelModal() {
  document.getElementById('level-modal').classList.remove('open');
}
function chooseLevel(lv) {
  State.currentLevel = lv === 'all' ? 'all' : parseInt(lv);
  document.querySelectorAll('.modal-lv-btn').forEach(b => b.classList.toggle('selected', b.dataset.level === lv));
  closeLevelModal();
  updateLevelDisplay();
  // Re-init current page
  if (State.currentPage === 'flashcard') initFlashcard();
  if (State.currentPage === 'quiz')      initQuiz();
  if (State.currentPage === 'dictionary') renderDictionary(document.getElementById('dict-input').value);
}
function updateLevelDisplay() {
  const lv = State.currentLevel;
  document.getElementById('level-label').textContent = lv === 'all' ? 'Tất cả' : levelName(lv);
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  Storage.load();

  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => setPage(el.dataset.page));
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Flashcard — card click to flip
  document.getElementById('fc-card-wrap').addEventListener('click', flipCard);

  // Flashcard controls
  document.getElementById('btn-prev').addEventListener('click',  () => fcNavigate(-1));
  document.getElementById('btn-next').addEventListener('click',  () => fcNavigate(1));
  document.getElementById('btn-shuffle').addEventListener('click', () => {
    State.fcShuffle = !State.fcShuffle;
    document.getElementById('btn-shuffle').classList.toggle('active', State.fcShuffle);
    initFlashcard();
    showToast(State.fcShuffle ? '🔀 Đã bật chế độ ngẫu nhiên' : '📋 Đã tắt ngẫu nhiên');
  });
  document.getElementById('btn-pinyin').addEventListener('click', () => {
    State.fcShowPinyin = !State.fcShowPinyin;
    document.getElementById('btn-pinyin').classList.toggle('active', State.fcShowPinyin);
    renderFlashcard();
  });
  document.getElementById('btn-tts').addEventListener('click', () => {
    const word = State.fcWords[State.fcIndex];
    if (word) speak(word.hanzi);
  });

  // Flashcard action buttons
  document.getElementById('btn-again').addEventListener('click', () => markWord('again'));
  document.getElementById('btn-skip').addEventListener('click',  () => fcNavigate(1));
  document.getElementById('btn-know').addEventListener('click',  () => markWord('know'));

  // Quiz Setup Listeners
  document.querySelectorAll('#quiz-level-options .quiz-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-level-options .quiz-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.quizLevel = btn.dataset.val === 'all' ? 'all' : parseInt(btn.dataset.val);
    });
  });

  document.querySelectorAll('#quiz-mode-options .quiz-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-mode-options .quiz-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.quizMode = btn.dataset.mode;
    });
  });

  document.querySelectorAll('#quiz-count-options .quiz-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quiz-count-options .quiz-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.quizTotal = parseInt(btn.dataset.count);
    });
  });

  document.getElementById('btn-start-quiz').addEventListener('click', () => startQuiz());
  document.getElementById('btn-quit-quiz').addEventListener('click', () => initQuiz());
  document.getElementById('quiz-tts-btn').addEventListener('click', () => {
    const word = State.quizWords[State.quizIndex];
    if (word) speak(word.hanzi);
  });
  document.getElementById('quiz-next-btn').addEventListener('click', nextQuiz);
  document.getElementById('quiz-restart').addEventListener('click', initQuiz);
  document.getElementById('quiz-retry-wrong').addEventListener('click', () => {
    if (State.quizWrongWords.length > 0) {
      startQuiz(State.quizWrongWords);
    }
  });

  // Keyboard shortcuts for Quiz (1, 2, 3, 4 to answer, Space/Enter for next)
  document.addEventListener('keydown', (e) => {
    if (State.currentPage !== 'quiz') return;
    if (document.getElementById('quiz-body').classList.contains('hidden')) return;

    if (['1', '2', '3', '4'].includes(e.key) && !State.quizAnswered) {
      const idx = parseInt(e.key) - 1;
      const options = document.querySelectorAll('.quiz-option');
      if (options[idx]) options[idx].click();
    } else if ((e.key === 'Enter' || e.key === ' ') && State.quizAnswered) {
      e.preventDefault();
      nextQuiz();
    }
  });

  // Dictionary search
  const dictInput = document.getElementById('dict-input');
  dictInput.addEventListener('input', () =>
    renderDictionary(dictInput.value, State.dictFilter));

  // Dictionary filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      State.dictFilter = chip.dataset.level;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderDictionary(dictInput.value, State.dictFilter);
    });
  });

  // Level modal
  document.getElementById('level-btn').addEventListener('click', openLevelModal);
  document.getElementById('modal-close').addEventListener('click', closeLevelModal);
  document.getElementById('level-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLevelModal();
  });
  document.querySelectorAll('.modal-lv-btn').forEach(btn => {
    btn.addEventListener('click', () => chooseLevel(btn.dataset.level));
  });

  // Quick action buttons on dashboard
  document.getElementById('dash-btn-fc').addEventListener('click',   () => setPage('flashcard'));
  document.getElementById('dash-btn-quiz').addEventListener('click', () => setPage('quiz'));
  document.getElementById('dash-btn-srs').addEventListener('click',  () => setPage('srs'));
  document.getElementById('dash-btn-reset').addEventListener('click', () => {
    if (confirm('Đặt lại toàn bộ tiến độ học?')) {
      State.progress = {};
      State.srsQueue = [];
      Storage.save();
      renderDashboard();
      showToast('🔄 Đã đặt lại tiến độ');
    }
  });

  // Stroke Writer Event Listeners
  document.getElementById('btn-load-stroke-char')?.addEventListener('click', () => {
    const input = document.getElementById('stroke-char-input');
    if (input.value.trim()) {
      loadStrokeChar(input.value.trim());
    }
  });

  document.getElementById('stroke-char-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const input = document.getElementById('stroke-char-input');
      if (input.value.trim()) {
        loadStrokeChar(input.value.trim());
      }
    }
  });

  document.getElementById('btn-stroke-tts')?.addEventListener('click', () => {
    const char = document.getElementById('stroke-char-input').value.trim();
    if (char) speak(char);
  });

  document.getElementById('btn-animate-stroke')?.addEventListener('click', () => {
    if (currentWriterInstance) {
      currentWriterInstance.animateCharacter();
    } else {
      const char = document.getElementById('stroke-char-input').value.trim() || '你';
      renderFallbackStrokeAnimation(char);
    }
  });

  document.getElementById('btn-loop-stroke')?.addEventListener('click', () => {
    if (currentWriterInstance) {
      currentWriterInstance.loopCharacterAnimation();
    } else {
      const char = document.getElementById('stroke-char-input').value.trim() || '你';
      renderFallbackStrokeAnimation(char);
    }
  });

  document.getElementById('btn-quiz-stroke')?.addEventListener('click', () => {
    if (currentWriterInstance) {
      showToast('🎯 Hãy dùng chuột hoặc ngón tay vẽ theo từng nét trong khung!');
      currentWriterInstance.quiz({
        onComplete: function() {
          showToast('🎉 Xuất sắc! Bạn đã hoàn thành đúng thứ tự tất cả các nét!');
        }
      });
    } else {
      showToast('✍️ Chế độ đố nét viết đang chuẩn bị dữ liệu!');
    }
  });

  document.getElementById('btn-clear-canvas')?.addEventListener('click', clearStrokeCanvas);

  document.getElementById('btn-toggle-watermark')?.addEventListener('click', () => {
    const wm = document.getElementById('canvas-watermark');
    if (wm) {
      wm.style.display = (wm.style.display === 'none') ? 'grid' : 'none';
      document.getElementById('btn-toggle-watermark').classList.toggle('active', wm.style.display !== 'none');
    }
  });

  document.getElementById('radical-search-input')?.addEventListener('input', (e) => {
    renderRadicals(e.target.value);
  });

  // Default page
  setPage('dashboard');
  updateLevelDisplay();
});
