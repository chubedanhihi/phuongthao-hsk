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
   AUTHENTICATION & MULTI-USER SYSTEM
   ═══════════════════════════════════════════ */
const Auth = {
  getUsers() {
    try {
      let users = JSON.parse(localStorage.getItem('hsk_users_list')) || [];
      if (!users.some(u => u.username && u.username.toLowerCase() === 'admin')) {
        const adminUser = {
          id: 'u_admin',
          name: 'Giáo viên Quản trị',
          username: 'admin',
          password: 'admin123',
          role: 'admin',
          avatar: '👑',
          createdAt: '01/01/2025',
          lastLogin: new Date().toISOString()
        };
        users.unshift(adminUser);
        localStorage.setItem('hsk_users_list', JSON.stringify(users));
      }
      return users;
    } catch {
      return [];
    }
  },
  saveUsers(users) {
    localStorage.setItem('hsk_users_list', JSON.stringify(users));
  },
  getActiveUserId() {
    return localStorage.getItem('hsk_active_user_id') || null;
  },
  setActiveUserId(id) {
    if (id) {
      localStorage.setItem('hsk_active_user_id', id);
    } else {
      localStorage.removeItem('hsk_active_user_id');
    }
  },
  getCurrentUser() {
    const activeId = this.getActiveUserId();
    if (!activeId) return null;
    const users = this.getUsers();
    return users.find(u => u.id === activeId) || null;
  },
  register(name, username, password, avatar = '🐼') {
    const cleanUser = username.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanUser || !cleanName || !password) {
      showToast('⚠️ Vui lòng điền đầy đủ thông tin!');
      return false;
    }
    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUser)) {
      showToast('⚠️ Tên đăng nhập này đã được sử dụng!');
      return false;
    }

    const newUser = {
      id: 'u_' + Date.now(),
      name: cleanName,
      username: cleanUser,
      password: password,
      role: 'student',
      avatar: avatar || '🐼',
      createdAt: new Date().toLocaleDateString('vi-VN'),
      lastLogin: new Date().toISOString()
    };

    // Tự động chuyển tiến độ khách hiện tại vào tài khoản này nếu có
    const guestProgress = localStorage.getItem('hsk_progress');
    const guestSrs = localStorage.getItem('hsk_srs');
    const guestStreak = localStorage.getItem('hsk_streak');

    if (guestProgress && !localStorage.getItem(`hsk_user_${newUser.id}_progress`)) {
      localStorage.setItem(`hsk_user_${newUser.id}_progress`, guestProgress);
    }
    if (guestSrs && !localStorage.getItem(`hsk_user_${newUser.id}_srs`)) {
      localStorage.setItem(`hsk_user_${newUser.id}_srs`, guestSrs);
    }
    if (guestStreak && !localStorage.getItem(`hsk_user_${newUser.id}_streak`)) {
      localStorage.setItem(`hsk_user_${newUser.id}_streak`, guestStreak);
    }

    users.push(newUser);
    this.saveUsers(users);
    this.setActiveUserId(newUser.id);
    Storage.load();
    updateAuthDisplay();
    renderDashboard();
    renderProfile();
    showToast(`🎉 Chào mừng học viên ${cleanName} gia nhập HSK Learn!`);
    return true;
  },
  login(username, password) {
    const cleanUser = username.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanUser && u.password === password);
    if (!user) {
      showToast('❌ Tên đăng nhập hoặc mật khẩu không chính xác!');
      return false;
    }
    user.lastLogin = new Date().toISOString();
    this.saveUsers(users);
    this.setActiveUserId(user.id);
    Storage.load();
    if (user.role === 'admin') {
      setPage('admin');
      showToast(`👑 Chào mừng Giáo viên ${user.name} vào Trang Quản Trị!`);
    } else {
      renderDashboard();
      renderProfile();
      showToast(`👋 Chào mừng trở lại, ${user.name}!`);
    }
    return true;
  },
  logout() {
    const curr = this.getCurrentUser();
    const name = curr ? curr.name : '';
    this.setActiveUserId(null);
    State.progress = {};
    State.srsQueue = [];
    Storage.load(); // tải tiến độ mặc định/khách
    updateAuthDisplay();
    renderDashboard();
    renderProfile();
    showToast(`🚪 Đã đăng xuất khỏi tài khoản ${name}!`);
    setPage('dashboard');
  },
  switchUser(userId) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (user.role === 'admin') {
      showToast('🔒 Chỉ tài khoản Giáo viên có mật khẩu mới đăng nhập được!');
      openAuthModal('login');
      const loginU = document.getElementById('login-username');
      if (loginU) loginU.value = user.username;
      return;
    }
    this.setActiveUserId(userId);
    Storage.load();
    updateAuthDisplay();
    renderDashboard();
    renderProfile();
    showToast(`🔄 Đã chuyển sang học viên: ${user.name}`);
  },
  exportData() {
    const user = this.getCurrentUser();
    const data = {
      version: 'HSK_3.0',
      exportedAt: new Date().toISOString(),
      user: user || { id: 'guest', name: 'Khách', username: 'guest', avatar: '🐼' },
      progress: State.progress,
      srsQueue: State.srsQueue,
      streak: getStreak(),
      quizStats: Storage.getQuizStats()
    };
    return JSON.stringify(data, null, 2);
  },
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Dữ liệu không hợp lệ');

      let targetUser = this.getCurrentUser();
      if (!targetUser && data.user && data.user.username) {
        // Tạo tài khoản từ bản sao lưu nếu chưa có
        const users = this.getUsers();
        let existing = users.find(u => u.username === data.user.username);
        if (!existing) {
          existing = {
            id: 'u_' + Date.now(),
            name: data.user.name || 'Học viên',
            username: data.user.username || ('user_' + Date.now()),
            password: data.user.password || '1234',
            avatar: data.user.avatar || '🐼',
            createdAt: new Date().toLocaleDateString('vi-VN')
          };
          users.push(existing);
          this.saveUsers(users);
        }
        this.setActiveUserId(existing.id);
        targetUser = existing;
      }

      if (data.progress) State.progress = data.progress;
      if (data.srsQueue) State.srsQueue = data.srsQueue;
      if (data.streak !== undefined) {
        const uId = targetUser ? targetUser.id : null;
        const key = uId ? `hsk_user_${uId}_streak` : 'hsk_streak';
        localStorage.setItem(key, JSON.stringify({ streak: data.streak, last: new Date().toDateString() }));
      }
      if (data.quizStats) {
        Storage.saveQuizStats(data.quizStats);
      }
      Storage.save();
      updateAuthDisplay();
      renderDashboard();
      renderProfile();
      return true;
    } catch (e) {
      showToast('❌ Mã sao lưu không đúng định dạng!');
      return false;
    }
  }
};

/* ═══════════════════════════════════════════
   PERSISTENCE (ĐỘC LẬP THEO TỪNG HỌC VIÊN)
   ═══════════════════════════════════════════ */
const Storage = {
  getUserPrefix() {
    const id = Auth.getActiveUserId();
    return id ? `hsk_user_${id}_` : 'hsk_';
  },
  save() {
    const prefix = this.getUserPrefix();
    localStorage.setItem(prefix + 'progress', JSON.stringify(State.progress));
    localStorage.setItem(prefix + 'srs', JSON.stringify(State.srsQueue));
  },
  load() {
    const prefix = this.getUserPrefix();
    try { State.progress = JSON.parse(localStorage.getItem(prefix + 'progress')) || {}; } catch { State.progress = {}; }
    try { State.srsQueue  = JSON.parse(localStorage.getItem(prefix + 'srs'))      || []; } catch { State.srsQueue = []; }
  },
  getQuizStats() {
    const prefix = this.getUserPrefix();
    try {
      return JSON.parse(localStorage.getItem(prefix + 'quiz_stats')) || { totalQuizzes: 0, totalQuestions: 0, totalScore: 0 };
    } catch {
      return { totalQuizzes: 0, totalQuestions: 0, totalScore: 0 };
    }
  },
  saveQuizStats(stats) {
    const prefix = this.getUserPrefix();
    localStorage.setItem(prefix + 'quiz_stats', JSON.stringify(stats));
  },
  recordQuizResult(score, total) {
    const stats = this.getQuizStats();
    stats.totalQuizzes += 1;
    stats.totalQuestions += total;
    stats.totalScore += score;
    this.saveQuizStats(stats);
  }
};

/* ═══════════════════════════════════════════
   CLASSROOM & ASSIGNMENT MANAGEMENT
   ═══════════════════════════════════════════ */
const ClassManager = {
  getAssignments() {
    try {
      return JSON.parse(localStorage.getItem('hsk_class_assignments')) || [];
    } catch {
      return [];
    }
  },
  saveAssignments(list) {
    localStorage.setItem('hsk_class_assignments', JSON.stringify(list));
  },
  addAssignment(item) {
    const list = this.getAssignments();
    list.unshift(item);
    this.saveAssignments(list);
  },
  deleteAssignment(id) {
    let list = this.getAssignments();
    list = list.filter(a => a.id !== id);
    this.saveAssignments(list);
  },
  getAnnouncements() {
    try {
      return JSON.parse(localStorage.getItem('hsk_class_announcements')) || [];
    } catch {
      return [];
    }
  },
  saveAnnouncements(list) {
    localStorage.setItem('hsk_class_announcements', JSON.stringify(list));
  },
  addAnnouncement(item) {
    const list = this.getAnnouncements();
    list.unshift(item);
    this.saveAnnouncements(list);
  },
  deleteAnnouncement(id) {
    let list = this.getAnnouncements();
    list = list.filter(a => a.id !== id);
    this.saveAnnouncements(list);
  },
  checkStudentAssignment(studentId, assignment) {
    const prefix = studentId ? `hsk_user_${studentId}_` : 'hsk_';
    let userProgress = {};
    let userQuizStats = { totalQuizzes: 0, totalQuestions: 0, totalScore: 0 };
    try { userProgress = JSON.parse(localStorage.getItem(prefix + 'progress')) || {}; } catch {}
    try { userQuizStats = JSON.parse(localStorage.getItem(prefix + 'quiz_stats')) || { totalQuizzes: 0, totalQuestions: 0, totalScore: 0 }; } catch {}

    const targetVal = parseInt(assignment.target) || 1;
    let currentVal = 0;

    if (assignment.type === 'learn_words') {
      const words = assignment.level === 'all' ? ALL_WORDS : ALL_WORDS.filter(w => w.level === parseInt(assignment.level));
      currentVal = words.filter(w => userProgress[`${w.level}-${w.id}`] === 'know').length;
    } else if (assignment.type === 'quiz_score') {
      currentVal = userQuizStats.totalQuizzes;
    } else if (assignment.type === 'srs_review') {
      let srsQueue = [];
      try { srsQueue = JSON.parse(localStorage.getItem(prefix + 'srs')) || []; } catch {}
      currentVal = srsQueue.length;
    } else if (assignment.type === 'stroke_practice') {
      currentVal = Object.values(userProgress).filter(v => v === 'know').length;
    }

    const pct = Math.min(100, Math.round((currentVal / targetVal) * 100));
    const isCompleted = currentVal >= targetVal;
    return { currentVal, targetVal, pct, isCompleted };
  },
  getReadNotifs(userId) {
    const key = userId ? `hsk_user_${userId}_read_notifs` : 'hsk_read_notifs';
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  },
  markNotifRead(userId, notifId) {
    const key = userId ? `hsk_user_${userId}_read_notifs` : 'hsk_read_notifs';
    const list = this.getReadNotifs(userId);
    if (!list.includes(notifId)) {
      list.push(notifId);
      localStorage.setItem(key, JSON.stringify(list));
    }
  },
  markAllNotifsRead(userId) {
    const key = userId ? `hsk_user_${userId}_read_notifs` : 'hsk_read_notifs';
    const all = [...this.getAssignments().map(a => 'asgn_' + a.id), ...this.getAnnouncements().map(a => 'ann_' + a.id)];
    localStorage.setItem(key, JSON.stringify(all));
  },
  exportClassPackage() {
    return JSON.stringify({
      version: 'HSK_CLASS_1.0',
      exportedAt: new Date().toISOString(),
      teacher: 'Cô Phương Thảo',
      assignments: this.getAssignments(),
      announcements: this.getAnnouncements()
    }, null, 2);
  },
  importClassPackage(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || (!data.assignments && !data.announcements)) {
        throw new Error('Định dạng không hợp lệ');
      }
      if (Array.isArray(data.assignments)) {
        const curr = this.getAssignments();
        const map = new Map(curr.map(a => [a.id, a]));
        data.assignments.forEach(a => map.set(a.id, a));
        this.saveAssignments(Array.from(map.values()));
      }
      if (Array.isArray(data.announcements)) {
        const curr = this.getAnnouncements();
        const map = new Map(curr.map(a => [a.id, a]));
        data.announcements.forEach(a => map.set(a.id, a));
        this.saveAnnouncements(Array.from(map.values()));
      }
      return true;
    } catch {
      return false;
    }
  },
  seedInitialDataIfEmpty() {
    if (!localStorage.getItem('hsk_class_assignments')) {
      const initialAssignments = [
        {
          id: 'asgn_1',
          title: 'Học thuộc 20 từ vựng cơ bản HSK 1',
          type: 'learn_words',
          level: '1',
          target: 20,
          deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          desc: 'Các em xem thẻ flashcard HSK 1 và ghi nhớ nghĩa tiếng Việt cùng pinyin nhé!',
          createdAt: new Date().toISOString().slice(0, 10)
        },
        {
          id: 'asgn_2',
          title: 'Hoàn thành 3 bài kiểm tra trắc nghiệm Quiz',
          type: 'quiz_score',
          level: 'all',
          target: 3,
          deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          desc: 'Làm trắc nghiệm để củng cố phản xạ nhận diện chữ Hán và phát âm.',
          createdAt: new Date().toISOString().slice(0, 10)
        }
      ];
      this.saveAssignments(initialAssignments);
    }
    if (!localStorage.getItem('hsk_class_announcements')) {
      const initialAnnouncements = [
        {
          id: 'ann_1',
          title: 'Chào mừng các bạn học viên đến với khóa học Tiếng Trung HSK!',
          tag: '🎉 Sự kiện',
          content: 'Chào mừng các em! Lớp học HSK của cô Phương Thảo đã mở trên web. Các em hãy học đều đặn mỗi ngày từ 15-20 phút và hoàn thành bài tập giao nhé!',
          pinned: true,
          createdAt: new Date().toISOString().slice(0, 10)
        },
        {
          id: 'ann_2',
          title: 'Nhắc nhở ôn tập SRS đều đặn hàng ngày',
          tag: '🔔 Nhắc nhở',
          content: 'Mỗi ngày hãy bấm vào mục "Ôn tập SRS" để ôn lại các từ sắp quên theo thuật toán khoa học. Chúc các em học tốt!',
          pinned: false,
          createdAt: new Date().toISOString().slice(0, 10)
        }
      ];
      this.saveAnnouncements(initialAnnouncements);
    }
  }
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

function setPage(page, keepCustomWords = false) {
  // BẢO VỆ NGHIÊM NGẶT: Chỉ tài khoản Giáo viên (role: admin) mới được vào trang quản trị
  if (page === 'admin') {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'admin') {
      showToast('⛔ Chỉ tài khoản Giáo viên Quản trị mới được quyền vào trang này!');
      if (!user) {
        openAuthModal('login');
      }
      return;
    }
  }

  State.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.page-section').forEach(el =>
    el.classList.toggle('hidden', el.id !== `page-${page}`));
  document.querySelector('.topbar-title').textContent = {
    dashboard: '🏠 Tổng quan',
    flashcard: State.isSRSSession ? '🔁 Ôn tập SRS' : '📚 Flashcard',
    quiz:      '✏️ Kiểm tra',
    dictionary:'🔍 Từ điển',
    strokes:   '✍️ Luyện viết chữ & Bộ thủ',
    srs:       '🔁 Ôn tập SRS',
    profile:   '👤 Hồ sơ học viên',
    admin:     '🛡️ Quản trị lớp học',
  }[page] || '🏠 Tổng quan';
  // init each section
  if (page === 'dashboard')  renderDashboard();
  if (page === 'flashcard' && !keepCustomWords) {
    State.isSRSSession = false;
    initFlashcard();
  }
  if (page === 'quiz')       initQuiz();
  if (page === 'dictionary') renderDictionary();
  if (page === 'strokes')    initStrokes();
  if (page === 'srs')        renderSRS();
  if (page === 'profile')    renderProfile();
  if (page === 'admin')      renderAdmin();
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

  renderDashboardAssignments();
  updateNotifBadge();

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
  const prefix = Storage.getUserPrefix();
  const data = JSON.parse(localStorage.getItem(prefix + 'streak') || '{"streak":0,"last":""}');
  const today = new Date().toDateString();
  if (data.last === today) return data.streak;
  return data.streak;
}
function bumpStreak() {
  const prefix = Storage.getUserPrefix();
  const data = JSON.parse(localStorage.getItem(prefix + 'streak') || '{"streak":0,"last":""}');
  const today = new Date().toDateString();
  if (data.last === today) return;
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  data.streak = data.last === yest.toDateString() ? data.streak + 1 : 1;
  data.last = today;
  localStorage.setItem(prefix + 'streak', JSON.stringify(data));
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
  document.getElementById('fc-level-label').textContent = State.isSRSSession ? `🔁 Ôn SRS (HSK ${word.level})` : levelName(State.currentLevel === 'all' ? word.level : State.currentLevel);

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
    showToast('✅ Đã thuộc từ này!');
  } else {
    updateSRS(word, false);
    showToast('🔁 Đã thêm vào mục "Cần ôn hôm nay"!');
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
    entry.interval = Math.max(1, Math.round(entry.interval * entry.ease));
    entry.ease     = Math.min(3.0, entry.ease + 0.1);
    // Thuộc rồi -> Xếp lịch ôn vào các ngày tiếp theo (sau 1 ngày, 3 ngày, 7 ngày...)
    entry.nextReview = now + entry.interval * 24 * 60 * 60 * 1000;
  } else {
    entry.interval = 1;
    entry.ease     = Math.max(1.3, entry.ease - 0.2);
    // Chưa thuộc -> Đưa vào danh sách CẦN ÔN NGAY HÔM NAY!
    entry.nextReview = now - 1000;
  }
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

  // Ghi nhận thống kê bài kiểm tra cho học viên
  Storage.recordQuizResult(score, total);
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
      <button class="action-btn primary" onclick="startSRSSession()">▶ Bắt đầu ôn tập (${dueWords.length} từ)</button>
    </div>
    <div class="srs-queue-list">
      ${dueWords.map(w => {
        const bg = levelColor(w.level);
        return `
        <div class="srs-item" onclick="dictSpeak('${w.hanzi.replace(/'/g,"\\'")}')" style="cursor:pointer">
          <div class="srs-hanzi">${w.hanzi}</div>
          <div class="srs-meta">
            <div style="font-size:15px;font-weight:700;color:var(--brand);margin-bottom:4px">${w.pinyin || ''}</div>
            <div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:4px">${w.meaning || ''}</div>
            <div class="srs-due">⏰ Cần ôn ngay hôm nay</div>
          </div>
          <div class="dict-badge-wrap">
            <span class="lv-badge" style="background:${bg}">${levelName(w.level)}</span>
            <div style="display:flex;gap:6px">
              <button class="tts-btn" style="padding:6px 10px;font-size:12px;font-weight:700;color:var(--brand);background:#FFF1F2;border-color:#FECDD3" onclick="event.stopPropagation();jumpToStrokePractice('${w.hanzi.replace(/'/g,"\\'")}')" title="Tập viết chữ này">✍️ Viết</button>
              <button class="tts-btn" style="padding:6px 10px;font-size:12px" onclick="event.stopPropagation();speak('${w.hanzi.replace(/'/g,"\\'")}')" title="Nghe phát âm">🔊</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function startSRSSession() {
  const now = Date.now();
  const dueKeys = State.srsQueue
    .filter(s => new Date(s.nextReview).getTime() <= now)
    .map(s => s.key);
  const dueWords = ALL_WORDS.filter(w => dueKeys.includes(progressKey(w)));
  if (!dueWords.length) {
    showToast('🌟 Bạn không có từ nào cần ôn hôm nay!');
    return;
  }
  State.isSRSSession = true;
  State.fcWords   = shuffle(dueWords);
  State.fcIndex   = 0;
  State.fcFlipped = false;
  setPage('flashcard', true);
  renderFlashcard();
  updateFCProgress();
  showToast(`🔁 Bắt đầu ôn tập ${dueWords.length} từ cần nhớ hôm nay!`);
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

let selectedRegAvatar = '🐼';

function updateAuthDisplay() {
  const user = Auth.getCurrentUser();
  const isTeacher = user && user.role === 'admin';

  const sideNavStudent = document.getElementById('sidebar-nav-student');
  const sideNavTeacher = document.getElementById('sidebar-nav-teacher');
  const logoText = document.getElementById('sidebar-logo-text');
  const logoSub = document.getElementById('sidebar-logo-sub');
  const levelBtn = document.getElementById('level-btn');
  const notifBell = document.getElementById('btn-notif-bell');

  if (isTeacher) {
    if (sideNavStudent) sideNavStudent.classList.add('hidden');
    if (sideNavTeacher) sideNavTeacher.classList.remove('hidden');
    if (logoText) logoText.textContent = 'HSK Quản Trị';
    if (logoSub) logoSub.textContent = 'Cổng Giáo Viên';
    if (levelBtn) levelBtn.classList.add('hidden');
    if (notifBell) notifBell.classList.add('hidden');
  } else {
    if (sideNavStudent) sideNavStudent.classList.remove('hidden');
    if (sideNavTeacher) sideNavTeacher.classList.add('hidden');
    if (logoText) logoText.textContent = 'HSK Learn';
    if (logoSub) logoSub.textContent = 'Học tiếng Trung';
    if (levelBtn) levelBtn.classList.remove('hidden');
    if (notifBell) notifBell.classList.remove('hidden');
  }

  const sideAvatar = document.getElementById('sidebar-avatar');
  const sideName = document.getElementById('sidebar-name');
  const sideSub = document.getElementById('sidebar-sub');
  const topAvatar = document.getElementById('topbar-avatar');
  const topName = document.getElementById('topbar-name');
  const topLogoutBtn = document.getElementById('topbar-logout-btn');
  const sideLogoutBtn = document.getElementById('sidebar-logout-btn');

  if (user) {
    if (topLogoutBtn) {
      topLogoutBtn.classList.remove('hidden');
      topLogoutBtn.textContent = isTeacher ? '🚪 Đăng xuất quản trị' : '🚪 Đăng xuất';
    }
    if (sideLogoutBtn) sideLogoutBtn.classList.remove('hidden');
    if (sideAvatar) sideAvatar.textContent = user.avatar || (isTeacher ? '👑' : '🐼');
    if (sideName) sideName.textContent = user.name;
    if (sideSub) sideSub.textContent = isTeacher ? `Giáo viên Quản trị • @${user.username}` : `Học viên • @${user.username}`;
    if (topAvatar) topAvatar.textContent = user.avatar || (isTeacher ? '👑' : '🐼');
    if (topName) topName.textContent = isTeacher ? 'Cô Phương Thảo (Quản trị)' : user.name;
  } else {
    if (topLogoutBtn) topLogoutBtn.classList.add('hidden');
    if (sideLogoutBtn) sideLogoutBtn.classList.add('hidden');
    if (sideAvatar) sideAvatar.textContent = '👤';
    if (sideName) sideName.textContent = 'Chưa đăng nhập';
    if (sideSub) sideSub.textContent = 'Bấm để đăng nhập / đăng ký';
    if (topAvatar) topAvatar.textContent = '👤';
    if (topName) topName.textContent = 'Đăng nhập';
  }

  updateNotifBadge();
}

function renderProfile() {
  const user = Auth.getCurrentUser();
  const profAvatar = document.getElementById('prof-avatar');
  const profName = document.getElementById('prof-name');
  const profUserBadge = document.getElementById('prof-username-badge');
  const profStatusBadge = document.getElementById('prof-status-badge');
  const profMeta = document.getElementById('prof-meta');
  const authActionBtn = document.getElementById('btn-prof-auth-action');

  const learnedCountAll = Object.values(State.progress).filter(v => v === 'know').length;
  const totalWords = ALL_WORDS.length;
  const totalPct = totalWords ? Math.round(learnedCountAll / totalWords * 100) : 0;
  const now = Date.now();
  const dueCount = State.srsQueue.filter(s => new Date(s.nextReview).getTime() <= now).length;
  const streak = getStreak();
  const quizStats = Storage.getQuizStats();

  document.getElementById('prof-learned-count').textContent = `${learnedCountAll} / ${totalWords}`;
  document.getElementById('prof-progress-pct').textContent = `${totalPct}%`;
  document.getElementById('prof-srs-due').textContent = dueCount;
  document.getElementById('prof-streak').textContent = `${streak} ngày 🔥`;

  if (user) {
    if (profAvatar) profAvatar.textContent = user.avatar || '🐼';
    if (profName) profName.textContent = user.name;
    if (profUserBadge) profUserBadge.textContent = `@${user.username}`;
    if (profStatusBadge) {
      profStatusBadge.textContent = '● Đang hoạt động';
      profStatusBadge.style.background = '#ECFDF5';
      profStatusBadge.style.color = '#059669';
    }
    if (profMeta) profMeta.textContent = `Tham gia: ${user.createdAt || 'Gần đây'} • Đã làm ${quizStats.totalQuizzes} bài test`;
    if (authActionBtn) {
      authActionBtn.textContent = '🚪 Đăng xuất';
      authActionBtn.className = 'action-btn warn';
      authActionBtn.onclick = () => Auth.logout();
    }
  } else {
    if (profAvatar) profAvatar.textContent = '👤';
    if (profName) profName.textContent = 'Học viên Khách';
    if (profUserBadge) profUserBadge.textContent = '@khach';
    if (profStatusBadge) {
      profStatusBadge.textContent = '● Chưa đăng nhập';
      profStatusBadge.style.background = '#FEF3C7';
      profStatusBadge.style.color = '#B45309';
    }
    if (profMeta) profMeta.textContent = 'Đăng ký tài khoản để theo dõi tiến độ học tập riêng biệt';
    if (authActionBtn) {
      authActionBtn.textContent = '🔑 Đăng nhập / Đăng ký';
      authActionBtn.className = 'action-btn primary';
      authActionBtn.onclick = () => openAuthModal('login');
    }
  }

  // 9 Cấp độ HSK thanh tiến độ
  const levelsListEl = document.getElementById('prof-levels-list');
  if (levelsListEl) {
    levelsListEl.innerHTML = '';
    for (let lv = 1; lv <= 9; lv++) {
      const words = getWords(lv);
      const cnt = words.length;
      const done = learnedCount(lv);
      const pct = cnt ? Math.round(done / cnt * 100) : 0;
      const bg = levelColor(lv);
      levelsListEl.innerHTML += `
        <div class="profile-level-row">
          <div class="profile-lv-tag" style="background:${bg}">HSK ${lv}</div>
          <div class="profile-lv-info">
            <div class="profile-lv-text">
              <span>Đã thuộc: <b>${done}/${cnt}</b> từ</span>
              <span style="color:${bg}">${pct}%</span>
            </div>
            <div class="profile-lv-bar-wrap">
              <div class="profile-lv-bar-fill" style="width:${pct}%;background:${bg}"></div>
            </div>
          </div>
          <button class="tts-btn" style="padding:6px 12px;font-size:12px;font-weight:700" onclick="selectLevel(${lv})" title="Học Flashcard HSK ${lv}">Học ngay →</button>
        </div>
      `;
    }
  }

  // Danh sách các học viên trên máy (chỉ hiển thị học viên, bảo mật tài khoản giáo viên)
  const accountsEl = document.getElementById('prof-accounts-list');
  if (accountsEl) {
    const studentUsers = Auth.getUsers().filter(u => u.role !== 'admin');
    if (!studentUsers.length) {
      accountsEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;grid-column:1/-1;text-align:center;padding:12px">Chưa có tài khoản học viên nào được tạo trên thiết bị này.</div>';
    } else {
      const currId = Auth.getActiveUserId();
      accountsEl.innerHTML = studentUsers.map(u => {
        const isCurrent = u.id === currId;
        return `
          <div class="account-item-card ${isCurrent ? 'current' : ''}" onclick="Auth.switchUser('${u.id}')">
            <div class="user-avatar-badge">${u.avatar || '🐼'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:14px;color:#0F172A">${u.name} ${isCurrent ? '<span style="color:var(--brand);font-size:11px">(Đang học)</span>' : ''}</div>
              <div style="font-size:12px;color:var(--text-muted)">@${u.username}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function openAuthOrProfile() {
  const user = Auth.getCurrentUser();
  if (user) {
    if (user.role === 'admin') {
      setPage('admin');
    } else {
      setPage('profile');
    }
  } else {
    openAuthModal('login', 'student');
  }
}

let currentAuthRole = 'student';

function selectAuthRole(role) {
  currentAuthRole = role;
  const btnStudent = document.getElementById('role-btn-student');
  const btnTeacher = document.getElementById('role-btn-teacher');
  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const logo = document.getElementById('auth-modal-logo');
  const hint = document.getElementById('teacher-login-hint');
  const regTab = document.getElementById('tab-auth-register');
  const loginUser = document.getElementById('login-username');

  if (role === 'teacher') {
    if (btnStudent) {
      btnStudent.style.borderColor = 'var(--border)';
      btnStudent.style.background = '#FFFFFF';
      btnStudent.style.color = 'var(--text-secondary)';
      btnStudent.style.fontWeight = '700';
    }
    if (btnTeacher) {
      btnTeacher.style.borderColor = 'var(--brand)';
      btnTeacher.style.background = '#FFF1F2';
      btnTeacher.style.color = 'var(--brand)';
      btnTeacher.style.fontWeight = '800';
    }
    if (title) title.textContent = 'Cổng Đăng Nhập Giáo Viên';
    if (subtitle) subtitle.textContent = 'Trang quản trị lớp học, quản lý học viên và bài tập';
    if (logo) logo.textContent = '🛡️';
    if (hint) hint.classList.remove('hidden');
    if (regTab) regTab.style.display = 'none';
    switchAuthTab('login');
    if (loginUser && !loginUser.value) loginUser.value = 'admin';
  } else {
    if (btnStudent) {
      btnStudent.style.borderColor = 'var(--brand)';
      btnStudent.style.background = '#FFF1F2';
      btnStudent.style.color = 'var(--brand)';
      btnStudent.style.fontWeight = '800';
    }
    if (btnTeacher) {
      btnTeacher.style.borderColor = 'var(--border)';
      btnTeacher.style.background = '#FFFFFF';
      btnTeacher.style.color = 'var(--text-secondary)';
      btnTeacher.style.fontWeight = '700';
    }
    if (title) title.textContent = 'Tài Khoản Học Viên';
    if (subtitle) subtitle.textContent = 'Lưu trữ và theo dõi tiến độ học tiếng Trung riêng biệt';
    if (logo) logo.textContent = '🀄';
    if (hint) hint.classList.add('hidden');
    if (regTab) regTab.style.display = '';
    if (loginUser && loginUser.value === 'admin') loginUser.value = '';
  }
}

function openAuthModal(tab = 'login', role = 'student') {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.add('open');
  selectAuthRole(role);
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.remove('open');
}

function switchAuthTab(tab) {
  document.getElementById('tab-auth-login')?.classList.toggle('active', tab === 'login');
  document.getElementById('tab-auth-register')?.classList.toggle('active', tab === 'register');
  document.getElementById('form-login')?.classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register')?.classList.toggle('hidden', tab !== 'register');
  const title = document.getElementById('auth-modal-title');
  if (title) {
    if (currentAuthRole === 'teacher') {
      title.textContent = 'Cổng Đăng Nhập Giáo Viên';
    } else {
      title.textContent = tab === 'login' ? 'Đăng Nhập Học Viên' : 'Đăng Ký Học Viên Mới';
    }
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById('login-username').value;
  const p = document.getElementById('login-password').value;
  if (Auth.login(u, p)) {
    closeAuthModal();
    const curr = Auth.getCurrentUser();
    if (curr && curr.role === 'admin') {
      setPage('admin');
    } else {
      setPage('dashboard');
    }
  }
}

function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const u = document.getElementById('reg-username').value;
  const p = document.getElementById('reg-password').value;
  if (Auth.register(name, u, p, selectedRegAvatar)) {
    closeAuthModal();
    setPage('profile');
  }
}

function switchAdminSubPage(tab) {
  setPage('admin');
  switchAdminTab(tab);
  document.querySelectorAll('#sidebar-nav-teacher .nav-item').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tnav-${tab}`)?.classList.add('active');
  document.getElementById('sidebar')?.classList.remove('open');
}

function openBackupModal() {
  const modal = document.getElementById('backup-modal');
  if (!modal) return;
  modal.classList.add('open');
  switchBackupTab('export');
  const codeBox = document.getElementById('export-code-box');
  if (codeBox) {
    codeBox.value = Auth.exportData();
  }
}

function closeBackupModal() {
  document.getElementById('backup-modal')?.classList.remove('open');
}

function switchBackupTab(tab) {
  document.getElementById('tab-backup-export')?.classList.toggle('active', tab === 'export');
  document.getElementById('tab-backup-import')?.classList.toggle('active', tab === 'import');
  document.getElementById('panel-backup-export')?.classList.toggle('hidden', tab !== 'export');
  document.getElementById('panel-backup-import')?.classList.toggle('hidden', tab !== 'import');
  if (tab === 'export') {
    const codeBox = document.getElementById('export-code-box');
    if (codeBox) codeBox.value = Auth.exportData();
  }
}

function copyBackupCode() {
  const box = document.getElementById('export-code-box');
  if (!box) return;
  box.select();
  navigator.clipboard.writeText(box.value).then(() => {
    showToast('📋 Đã sao chép mã tiến độ vào bộ nhớ tạm!');
  }).catch(() => {
    document.execCommand('copy');
    showToast('📋 Đã sao chép mã tiến độ!');
  });
}

function downloadBackupFile() {
  const jsonStr = Auth.exportData();
  const user = Auth.getCurrentUser();
  const filename = `hsk_backup_${user ? user.username : 'guest'}_${new Date().toISOString().slice(0,10)}.json`;
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('💾 Đã tải file sao lưu về máy!');
}

function handleBackupFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    document.getElementById('import-code-box').value = evt.target.result;
    showToast('📄 Đã nạp nội dung file sao lưu!');
  };
  reader.readAsText(file);
}

function applyBackupImport() {
  const code = document.getElementById('import-code-box').value.trim();
  if (!code) {
    showToast('⚠️ Vui lòng dán mã hoặc chọn file sao lưu!');
    return;
  }
  if (Auth.importData(code)) {
    closeBackupModal();
    showToast('🎉 Khôi phục toàn bộ tiến độ thành công!');
    setPage('profile');
  }
}

/* ═══════════════════════════════════════════
   ADMIN PORTAL & CLASS NOTIFICATIONS
   ═══════════════════════════════════════════ */
function switchAdminTab(tab) {
  ['students', 'assignments', 'announcements'].forEach(t => {
    document.getElementById(`tab-btn-admin-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`admin-tab-${t}`)?.classList.toggle('hidden', t !== tab);
    document.getElementById(`tnav-${t}`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'students') renderAdminStudents();
  if (tab === 'assignments') renderAdminAssignments();
  if (tab === 'announcements') renderAdminAnnouncements();
}

function renderAdmin() {
  const users = Auth.getUsers().filter(u => u.role !== 'admin');
  const assignments = ClassManager.getAssignments();
  const announcements = ClassManager.getAnnouncements();

  const totalStudentsEl = document.getElementById('admin-total-students');
  const totalAsgnEl = document.getElementById('admin-total-assignments');
  const totalAnnEl = document.getElementById('admin-total-announcements');
  const avgWordsEl = document.getElementById('admin-avg-words');

  if (totalStudentsEl) totalStudentsEl.textContent = users.length;
  if (totalAsgnEl) totalAsgnEl.textContent = assignments.length;
  if (totalAnnEl) totalAnnEl.textContent = announcements.length;

  let totalWordsLearnedAcrossAll = 0;
  users.forEach(u => {
    try {
      const prog = JSON.parse(localStorage.getItem(`hsk_user_${u.id}_progress`)) || {};
      totalWordsLearnedAcrossAll += Object.values(prog).filter(v => v === 'know').length;
    } catch {}
  });
  const avg = users.length ? Math.round(totalWordsLearnedAcrossAll / users.length) : 0;
  if (avgWordsEl) avgWordsEl.textContent = avg;

  renderAdminStudents();
  renderAdminAssignments();
  renderAdminAnnouncements();
}

function renderAdminStudents() {
  const tbody = document.getElementById('admin-students-tbody');
  const countEl = document.getElementById('admin-student-count');
  const searchInput = document.getElementById('admin-search-student');
  const q = (searchInput?.value || '').trim().toLowerCase();

  const users = Auth.getUsers().filter(u => u.role !== 'admin');
  const filtered = users.filter(u => {
    if (!q) return true;
    return (u.name && u.name.toLowerCase().includes(q)) ||
           (u.username && u.username.toLowerCase().includes(q));
  });

  if (countEl) countEl.textContent = `${filtered.length} học viên`;

  if (!tbody) return;
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Không có học viên nào phù hợp.</td></tr>`;
    return;
  }

  const totalWords = ALL_WORDS.length;
  tbody.innerHTML = filtered.map(u => {
    let prog = {};
    let streak = 0;
    let quizStats = { totalQuizzes: 0, totalQuestions: 0, totalScore: 0 };
    try { prog = JSON.parse(localStorage.getItem(`hsk_user_${u.id}_progress`)) || {}; } catch {}
    try {
      const sData = JSON.parse(localStorage.getItem(`hsk_user_${u.id}_streak`) || '{}');
      streak = sData.streak || 0;
    } catch {}
    try { quizStats = JSON.parse(localStorage.getItem(`hsk_user_${u.id}_quiz_stats`)) || quizStats; } catch {}

    const learned = Object.values(prog).filter(v => v === 'know').length;
    const pct = totalWords ? Math.round((learned / totalWords) * 100) : 0;

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">${u.avatar || '🐼'}</span>
            <span style="font-weight:800;color:#0F172A">${u.name}</span>
          </div>
        </td>
        <td><span class="badge" style="background:var(--surface2);color:var(--text)">@${u.username}</span></td>
        <td>${u.createdAt || 'Mới tham gia'}</td>
        <td><b style="color:var(--brand)">${learned}</b> / ${totalWords}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px;height:6px;background:#E2E8F0;border-radius:99px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:var(--brand);border-radius:99px"></div>
            </div>
            <span style="font-weight:700;font-size:12px">${pct}%</span>
          </div>
        </td>
        <td><b>${quizStats.totalQuizzes}</b> bài</td>
        <td>🔥 <b>${streak}</b> ngày</td>
        <td>
          <button class="tts-btn" onclick="viewStudentDetail('${u.id}')" style="padding:6px 12px;font-size:12px;font-weight:700">🔍 Chi tiết</button>
        </td>
      </tr>
    `;
  }).join('');
}

function viewStudentDetail(userId) {
  const users = Auth.getUsers();
  const u = users.find(x => x.id === userId);
  if (!u) return;

  let prog = {};
  let streak = 0;
  let quizStats = { totalQuizzes: 0, totalQuestions: 0, totalScore: 0 };
  try { prog = JSON.parse(localStorage.getItem(`hsk_user_${u.id}_progress`)) || {}; } catch {}
  try {
    const sData = JSON.parse(localStorage.getItem(`hsk_user_${u.id}_streak`) || '{}');
    streak = sData.streak || 0;
  } catch {}
  try { quizStats = JSON.parse(localStorage.getItem(`hsk_user_${u.id}_quiz_stats`)) || quizStats; } catch {}

  const learned = Object.values(prog).filter(v => v === 'know').length;
  const totalWords = ALL_WORDS.length;
  const pct = totalWords ? Math.round((learned / totalWords) * 100) : 0;

  const admAvatar = document.getElementById('adm-modal-avatar');
  const admName = document.getElementById('adm-modal-name');
  const admUser = document.getElementById('adm-modal-username');
  const admLearned = document.getElementById('adm-modal-learned');
  const admPct = document.getElementById('adm-modal-pct');
  const admStreak = document.getElementById('adm-modal-streak');

  if (admAvatar) admAvatar.textContent = u.avatar || '🐼';
  if (admName) admName.textContent = u.name;
  if (admUser) admUser.textContent = `@${u.username} • Tham gia: ${u.createdAt || 'Gần đây'} • Đã làm ${quizStats.totalQuizzes} bài kiểm tra`;
  if (admLearned) admLearned.textContent = `${learned}/${totalWords}`;
  if (admPct) admPct.textContent = `${pct}%`;
  if (admStreak) admStreak.textContent = `${streak} ngày 🔥`;

  const levelsListEl = document.getElementById('adm-modal-levels-list');
  if (levelsListEl) {
    levelsListEl.innerHTML = '';
    for (let lv = 1; lv <= 9; lv++) {
      const words = getWords(lv);
      const cnt = words.length;
      const done = words.filter(w => prog[`${w.level}-${w.id}`] === 'know').length;
      const lvPct = cnt ? Math.round((done / cnt) * 100) : 0;
      const bg = levelColor(lv);
      levelsListEl.innerHTML += `
        <div class="profile-level-row" style="padding:10px 14px">
          <div class="profile-lv-tag" style="background:${bg}">HSK ${lv}</div>
          <div class="profile-lv-info">
            <div class="profile-lv-text">
              <span>Đã thuộc: <b>${done}/${cnt}</b> từ</span>
              <span style="color:${bg}">${lvPct}%</span>
            </div>
            <div class="profile-lv-bar-wrap">
              <div class="profile-lv-bar-fill" style="width:${lvPct}%;background:${bg}"></div>
            </div>
          </div>
        </div>
      `;
    }
  }

  document.getElementById('admin-student-modal')?.classList.add('open');
}

function closeAdminStudentModal() {
  document.getElementById('admin-student-modal')?.classList.remove('open');
}

function renderAdminAssignments() {
  const container = document.getElementById('admin-assignments-list');
  if (!container) return;
  const list = ClassManager.getAssignments();
  if (!list.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:28px;color:var(--text-muted);background:var(--surface2);border-radius:var(--radius-sm)">Chưa có bài tập nào được giao. Hãy bấm "Giao Bài Mới" để tạo bài tập cho học viên!</div>`;
    return;
  }
  const typeMap = {
    learn_words: '📖 Học từ vựng',
    quiz_score: '🎯 Điểm thi Quiz',
    srs_review: '🔁 Ôn tập SRS',
    stroke_practice: '✍️ Luyện viết chữ'
  };

  container.innerHTML = list.map(a => {
    return `
      <div class="assignment-card">
        <div>
          <div class="assignment-header">
            <span class="badge" style="background:#FFF1F2;color:var(--brand)">${typeMap[a.type] || a.type}</span>
            <span class="badge" style="background:var(--surface2);color:var(--text-muted)">HSK: ${a.level === 'all' ? 'Tất cả' : a.level}</span>
          </div>
          <div class="assignment-title">${a.title}</div>
          <div class="assignment-meta" style="margin-top:8px">
            <div>🎯 <b>Mục tiêu:</b> ${a.target} ${a.type === 'learn_words' ? 'từ thuộc' : (a.type === 'quiz_score' ? 'bài kiểm tra' : 'lượt')}</div>
            <div>⏰ <b>Hạn nộp:</b> ${a.deadline || 'Không giới hạn'}</div>
            ${a.desc ? `<div style="margin-top:6px;font-style:italic;color:var(--text-secondary)">"${a.desc}"</div>` : ''}
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
          <button class="action-btn" onclick="deleteAssignment('${a.id}')" style="background:#FFF1F2;color:var(--brand);border:1px solid #FECDD3;padding:6px 12px;font-size:12px">🗑️ Xóa bài này</button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteAssignment(id) {
  if (confirm('Bạn có chắc muốn xóa bài tập này?')) {
    ClassManager.deleteAssignment(id);
    renderAdminAssignments();
    renderDashboardAssignments();
    updateNotifBadge();
    showToast('🗑️ Đã xóa bài tập!');
  }
}

function renderAdminAnnouncements() {
  const container = document.getElementById('admin-announcements-list');
  if (!container) return;
  const list = ClassManager.getAnnouncements();
  if (!list.length) {
    container.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-muted);background:var(--surface2);border-radius:var(--radius-sm)">Chưa có thông báo nào được đăng. Hãy bấm "Đăng Thông Báo Mới"!</div>`;
    return;
  }

  const sorted = [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  container.innerHTML = sorted.map(ann => {
    return `
      <div class="announcement-card ${ann.pinned ? 'pinned' : ''}">
        <div class="announcement-header">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${ann.pinned ? '<span class="badge" style="background:#FFF1F2;color:var(--brand);font-weight:800">📌 Đã ghim</span>' : ''}
            <span class="badge" style="background:var(--surface2);color:var(--text)">${ann.tag || '📢 Thông báo'}</span>
            <span style="font-size:12px;color:var(--text-muted)">${ann.createdAt || ''}</span>
          </div>
          <button class="action-btn" onclick="deleteAnnouncement('${ann.id}')" style="background:#FFF1F2;color:var(--brand);border:1px solid #FECDD3;padding:4px 8px;font-size:11px">🗑️ Xóa</button>
        </div>
        <div class="announcement-title" style="margin-bottom:6px">${ann.title}</div>
        <div class="announcement-body">${ann.content}</div>
      </div>
    `;
  }).join('');
}

function deleteAnnouncement(id) {
  if (confirm('Bạn có chắc muốn xóa thông báo này?')) {
    ClassManager.deleteAnnouncement(id);
    renderAdminAnnouncements();
    updateNotifBadge();
    showToast('🗑️ Đã xóa thông báo!');
  }
}

function openCreateAssignmentModal() {
  const modal = document.getElementById('create-assignment-modal');
  if (!modal) return;
  modal.classList.add('open');
  const d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const dlInput = document.getElementById('asgn-deadline');
  if (dlInput && !dlInput.value) dlInput.value = d;
}

function closeCreateAssignmentModal() {
  document.getElementById('create-assignment-modal')?.classList.remove('open');
}

function updateAssignmentTargetLabel() {
  const type = document.getElementById('asgn-type')?.value;
  const label = document.getElementById('asgn-target-label');
  if (!label) return;
  if (type === 'learn_words') label.textContent = 'Mục tiêu (Số từ cần thuộc)';
  else if (type === 'quiz_score') label.textContent = 'Mục tiêu (Số bài kiểm tra đã làm)';
  else if (type === 'srs_review') label.textContent = 'Mục tiêu (Số từ ôn tập SRS)';
  else if (type === 'stroke_practice') label.textContent = 'Mục tiêu (Số chữ luyện viết)';
}

function handleCreateAssignmentSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('asgn-title').value.trim();
  const type = document.getElementById('asgn-type').value;
  const level = document.getElementById('asgn-level').value;
  const target = parseInt(document.getElementById('asgn-target').value) || 1;
  const deadline = document.getElementById('asgn-deadline').value;
  const desc = document.getElementById('asgn-desc').value.trim();

  const newAsgn = {
    id: 'asgn_' + Date.now(),
    title,
    type,
    level,
    target,
    deadline,
    desc,
    createdAt: new Date().toISOString().slice(0, 10)
  };

  ClassManager.addAssignment(newAsgn);
  closeCreateAssignmentModal();
  document.getElementById('form-create-assignment')?.reset();
  renderAdminAssignments();
  renderDashboardAssignments();
  updateNotifBadge();
  showToast('🎉 Đã giao bài tập mới thành công!');
}

function openCreateAnnouncementModal() {
  document.getElementById('create-announcement-modal')?.classList.add('open');
}

function closeCreateAnnouncementModal() {
  document.getElementById('create-announcement-modal')?.classList.remove('open');
}

function handleCreateAnnouncementSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('ann-title').value.trim();
  const tag = document.getElementById('ann-tag').value;
  const content = document.getElementById('ann-content').value.trim();
  const pinned = document.getElementById('ann-pinned')?.checked || false;

  const newAnn = {
    id: 'ann_' + Date.now(),
    title,
    tag,
    content,
    pinned,
    createdAt: new Date().toISOString().slice(0, 10)
  };

  ClassManager.addAnnouncement(newAnn);
  closeCreateAnnouncementModal();
  document.getElementById('form-create-announcement')?.reset();
  renderAdminAnnouncements();
  updateNotifBadge();
  showToast('📢 Đã đăng thông báo mới!');
}

function openClassExportModal() {
  const modal = document.getElementById('class-sync-modal');
  if (!modal) return;
  modal.classList.add('open');
  switchClassSyncTab('export');
}

function openStudentSyncModal() {
  const modal = document.getElementById('class-sync-modal');
  if (!modal) return;
  modal.classList.add('open');
  switchClassSyncTab('import');
}

function closeClassSyncModal() {
  document.getElementById('class-sync-modal')?.classList.remove('open');
}

function switchClassSyncTab(tab) {
  document.getElementById('tab-class-export')?.classList.toggle('active', tab === 'export');
  document.getElementById('tab-class-import')?.classList.toggle('active', tab === 'import');
  document.getElementById('panel-class-export')?.classList.toggle('hidden', tab !== 'export');
  document.getElementById('panel-class-import')?.classList.toggle('hidden', tab !== 'import');
  if (tab === 'export') {
    const box = document.getElementById('class-export-box');
    if (box) box.value = ClassManager.exportClassPackage();
  }
}

function copyClassExportCode() {
  const box = document.getElementById('class-export-box');
  if (!box) return;
  box.select();
  navigator.clipboard.writeText(box.value).then(() => {
    showToast('📋 Đã sao chép mã gói lớp học!');
  }).catch(() => {
    document.execCommand('copy');
    showToast('📋 Đã sao chép mã gói lớp học!');
  });
}

function downloadClassExportFile() {
  const jsonStr = ClassManager.exportClassPackage();
  const filename = `hsk_class_package_${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('💾 Đã tải file gói bài tập lớp về máy!');
}

function handleClassFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const box = document.getElementById('class-import-box');
    if (box) box.value = evt.target.result;
    showToast('📄 Đã nạp file bài tập từ cô giáo!');
  };
  reader.readAsText(file);
}

function applyClassImport() {
  const code = document.getElementById('class-import-box')?.value.trim();
  if (!code) {
    showToast('⚠️ Vui lòng dán mã hoặc chọn file bài tập từ cô!');
    return;
  }
  if (ClassManager.importClassPackage(code)) {
    closeClassSyncModal();
    renderDashboardAssignments();
    updateNotifBadge();
    showToast('🎉 Nhận bài tập & thông báo từ cô thành công!');
  } else {
    showToast('❌ Mã bài tập không đúng định dạng!');
  }
}

function updateNotifBadge() {
  const user = Auth.getCurrentUser();
  const uId = user ? user.id : null;
  const readList = ClassManager.getReadNotifs(uId);

  const assignments = ClassManager.getAssignments();
  const announcements = ClassManager.getAnnouncements();

  let unread = 0;
  assignments.forEach(a => {
    if (!readList.includes('asgn_' + a.id)) unread++;
  });
  announcements.forEach(ann => {
    if (!readList.includes('ann_' + ann.id)) unread++;
  });

  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = unread;
    badge.classList.toggle('hidden', unread === 0);
  }
  const unreadText = document.getElementById('notif-unread-text');
  if (unreadText) {
    unreadText.textContent = `${unread} thông báo / bài tập mới`;
  }
}

function openNotifModal() {
  const modal = document.getElementById('notif-modal');
  if (!modal) return;
  modal.classList.add('open');

  const container = document.getElementById('notif-list-container');
  if (!container) return;

  const user = Auth.getCurrentUser();
  const uId = user ? user.id : null;
  const readList = ClassManager.getReadNotifs(uId);

  const assignments = ClassManager.getAssignments();
  const announcements = ClassManager.getAnnouncements();

  let items = [];
  announcements.forEach(ann => {
    items.push({
      id: 'ann_' + ann.id,
      type: 'announcement',
      title: `${ann.pinned ? '📌 ' : ''}${ann.title}`,
      tag: ann.tag || '📢 Thông báo',
      desc: ann.content,
      time: ann.createdAt || 'Mới đây',
      isUnread: !readList.includes('ann_' + ann.id)
    });
  });
  assignments.forEach(asgn => {
    const status = ClassManager.checkStudentAssignment(uId, asgn);
    items.push({
      id: 'asgn_' + asgn.id,
      type: 'assignment',
      title: `📝 Bài tập: ${asgn.title}`,
      tag: status.isCompleted ? '✅ Đã hoàn thành' : `🎯 Tiến độ: ${status.currentVal}/${status.targetVal}`,
      desc: asgn.desc || `Mục tiêu: Đạt ${asgn.target} • Hạn nộp: ${asgn.deadline || 'Không giới hạn'}`,
      time: `Hạn: ${asgn.deadline || 'Không giới hạn'}`,
      isUnread: !readList.includes('asgn_' + asgn.id)
    });
  });

  if (!items.length) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted)">Hiện chưa có thông báo hay bài tập nào.</div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    return `
      <div class="notif-item ${item.isUnread ? 'unread' : ''}" onclick="ClassManager.markNotifRead('${uId}', '${item.id}'); updateNotifBadge(); this.classList.remove('unread');">
        <div class="notif-item-header">
          <div class="notif-item-title">${item.title}</div>
          <span class="badge" style="font-size:10px;background:var(--surface);color:var(--text-muted)">${item.tag}</span>
        </div>
        <div class="notif-item-desc">${item.desc}</div>
        <div class="notif-item-time" style="margin-top:6px">${item.time}</div>
      </div>
    `;
  }).join('');
}

function closeNotifModal() {
  document.getElementById('notif-modal')?.classList.remove('open');
}

function markAllNotifsRead() {
  const user = Auth.getCurrentUser();
  const uId = user ? user.id : null;
  ClassManager.markAllNotifsRead(uId);
  document.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
  updateNotifBadge();
  showToast('✓ Đã đánh dấu đọc toàn bộ thông báo!');
}

function renderDashboardAssignments() {
  const container = document.getElementById('dash-assignments-container');
  if (!container) return;

  const assignments = ClassManager.getAssignments();
  const user = Auth.getCurrentUser();
  const uId = user ? user.id : null;

  if (!assignments.length) {
    container.innerHTML = `<div style="grid-column:1/-1;font-size:13px;color:var(--text-muted);text-align:center;padding:16px">Hiện chưa có bài tập nào cần làm. Hãy tiếp tục luyện tập tự do nhé!</div>`;
    return;
  }

  container.innerHTML = assignments.map(a => {
    const status = ClassManager.checkStudentAssignment(uId, a);
    return `
      <div class="assignment-card ${status.isCompleted ? 'completed' : ''}" style="margin:0">
        <div class="assignment-header">
          <span class="badge" style="${status.isCompleted ? 'background:#ECFDF5;color:#059669' : 'background:#FFF1F2;color:var(--brand)'}">
            ${status.isCompleted ? '✅ Đã hoàn thành' : `⏳ Còn thiếu ${Math.max(0, status.targetVal - status.currentVal)}`}
          </span>
          <span style="font-size:11px;color:var(--text-muted)">Hạn: ${a.deadline || 'Không'}</span>
        </div>
        <div class="assignment-title" style="font-size:14px;margin-bottom:6px">${a.title}</div>
        <div class="assignment-meta" style="margin-bottom:8px">
          <div style="font-size:12px;display:flex;justify-content:space-between">
            <span>Tiến độ của bạn:</span>
            <b>${status.currentVal} / ${status.targetVal} (${status.pct}%)</b>
          </div>
          <div class="assignment-bar-wrap">
            <div class="assignment-bar-fill" style="width:${status.pct}%;background:${status.isCompleted ? '#10B981' : 'var(--brand)'}"></div>
          </div>
          ${a.desc ? `<div style="font-size:11px;color:var(--text-secondary);font-style:italic;margin-top:4px">"${a.desc}"</div>` : ''}
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button class="tts-btn" style="padding:4px 10px;font-size:11px;font-weight:700" onclick="setPage('${a.type === 'quiz_score' ? 'quiz' : (a.type === 'srs_review' ? 'srs' : (a.type === 'stroke_practice' ? 'strokes' : 'flashcard'))}')">Làm bài ngay →</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  Storage.load();
  ClassManager.seedInitialDataIfEmpty();
  updateAuthDisplay();

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
  document.getElementById('btn-fc-write')?.addEventListener('click', () => {
    const word = State.fcWords[State.fcIndex];
    if (word) jumpToStrokePractice(word.hanzi);
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

  // Avatar picker listener
  document.querySelectorAll('#avatar-picker-grid .avatar-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#avatar-picker-grid .avatar-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRegAvatar = btn.dataset.avatar;
    });
  });

  // Modal overlay click to close
  document.getElementById('auth-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAuthModal();
  });
  document.getElementById('backup-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBackupModal();
  });
  document.getElementById('notif-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNotifModal();
  });
  document.getElementById('create-assignment-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCreateAssignmentModal();
  });
  document.getElementById('create-announcement-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCreateAnnouncementModal();
  });
  document.getElementById('admin-student-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAdminStudentModal();
  });
  document.getElementById('class-sync-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeClassSyncModal();
  });

  // Default page
  const currUser = Auth.getCurrentUser();
  if (currUser && currUser.role === 'admin') {
    setPage('admin');
  } else {
    setPage('dashboard');
  }
  updateLevelDisplay();
});
