const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const state = {
  room: null,
  user: null,
  timer: 25 * 60,
  timerRunning: false,
  timerInterval: null,
  messages: [],
  members: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function initials(name) {
  return name.trim().split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'S';
}

function timeLabel(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function roomStorageKey(code) { return `studcha-room-${code}`; }

function saveRoomLocal() {
  if (!state.room) return;
  const data = { ...state.room, members: state.members, messages: state.messages };
  localStorage.setItem(roomStorageKey(state.room.code), JSON.stringify(data));
}

function loadRoomLocal(code) {
  try {
    const saved = localStorage.getItem(roomStorageKey(code));
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function showFormError(target, message = '') {
  $(target).textContent = message;
}

function enterRoom(room, name, isCreator = false) {
  state.room = room;
  state.user = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name };
  state.messages = Array.isArray(room.messages) ? room.messages : [];
  state.members = Array.isArray(room.members) ? room.members : [];

  if (!state.members.some(m => m.name === name)) {
    state.members.push({ id: state.user.id, name });
  }
  if (isCreator && !state.messages.length) {
    state.messages.push({ system: true, text: `تم إنشاء الغرفة. شارك الكود ${room.code} مع زملائك.` , time: timeLabel() });
  }
  saveRoomLocal();
  renderRoom();
  $('#roomView').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function renderRoom() {
  if (!state.room) return;
  $('#roomNameDisplay').textContent = state.room.name;
  $('#chatTitle').textContent = state.room.name;
  $('#roomCodeDisplay').textContent = state.room.code;
  $('#roomAvatar').textContent = initials(state.room.name);
  $('#memberCount').textContent = state.members.length;
  $('#membersList').innerHTML = state.members.map(member => `
    <div class="member-row">
      <span class="member-avatar">${escapeHtml(initials(member.name))}</span>
      <span>${escapeHtml(member.name)}${member.id === state.user?.id ? ' (أنت)' : ''}</span>
      <i class="member-online"></i>
    </div>`).join('');

  $('#chatMessages').innerHTML = state.messages.map(message => {
    if (message.system) return `<div class="system-message">${escapeHtml(message.text)}</div>`;
    const mine = message.userId === state.user?.id;
    return `<article class="message ${mine ? 'me' : ''}">
      <div class="member-avatar">${escapeHtml(initials(message.userName || 'S'))}</div>
      <div class="bubble"><div class="message-author">${escapeHtml(message.userName || 'عضو')}</div><p>${escapeHtml(message.text)}</p></div>
      <span class="message-time">${escapeHtml(message.time || '')}</span>
    </article>`;
  }).join('');
  const chat = $('#chatMessages');
  chat.scrollTop = chat.scrollHeight;
}

function createRoom() {
  const name = $('#roomName').value.trim();
  const userName = $('#displayName').value.trim();
  if (!name) return showFormError('#createError', 'اكتب اسم الغرفة أولاً.');
  if (!userName) return showFormError('#createError', 'اكتب اسمك للظهور داخل الغرفة.');

  const room = {
    code: makeCode(),
    name,
    createdAt: Date.now(),
    members: [],
    messages: []
  };
  closeModal('roomModal');
  showFormError('#createError');
  enterRoom(room, userName, true);

  const shareUrl = `${location.origin}${location.pathname}?room=${room.code}`;
  history.replaceState({}, '', `?room=${room.code}`);
  setTimeout(() => {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
  }, 250);
}

function joinRoom() {
  const code = normalizeCode($('#roomCode').value);
  const userName = $('#joinName').value.trim();
  if (code.length < 6) return showFormError('#joinError', 'أدخل كود الغرفة المكوّن من 6 أحرف/أرقام.');
  if (!userName) return showFormError('#joinError', 'اكتب اسمك للانضمام.');

  const room = loadRoomLocal(code);
  if (!room) {
    return showFormError('#joinError', 'الغرفة غير موجودة على هذا الجهاز. فعّل Firebase لتمكين الغرف الحقيقية بين الأجهزة.');
  }
  closeModal('joinModal');
  showFormError('#joinError');
  enterRoom(room, userName);
  history.replaceState({}, '', `?room=${room.code}`);
}

function sendMessage(text) {
  if (!state.room || !state.user || !text.trim()) return;
  state.messages.push({ userId: state.user.id, userName: state.user.name, text: text.trim(), time: timeLabel() });
  saveRoomLocal();
  renderRoom();
}

async function copyRoomCode() {
  const code = state.room?.code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    $('#copyCodeBtn').textContent = 'تم النسخ ✓';
    setTimeout(() => $('#copyCodeBtn').textContent = 'نسخ', 1300);
  } catch {}
}

async function shareRoom() {
  if (!state.room) return;
  const url = `${location.origin}${location.pathname}?room=${state.room.code}`;
  try {
    if (navigator.share) await navigator.share({ title: `Studcha — ${state.room.name}`, text: 'انضم إلى غرفة المذاكرة معي', url });
    else await navigator.clipboard.writeText(url);
  } catch {}
}

function leaveRoom() {
  if (state.room && state.user) {
    state.members = state.members.filter(m => m.id !== state.user.id);
    saveRoomLocal();
  }
  state.room = null;
  state.user = null;
  $('#roomView').classList.add('hidden');
  document.body.style.overflow = '';
  history.replaceState({}, '', location.pathname);
}

function updateTimerDisplay() {
  const min = Math.floor(state.timer / 60).toString().padStart(2, '0');
  const sec = (state.timer % 60).toString().padStart(2, '0');
  $('#timerDisplay').textContent = `${min}:${sec}`;
  $('#timerStartBtn').textContent = state.timerRunning ? 'إيقاف' : 'ابدأ';
}

function toggleTimer() {
  if (state.timerRunning) {
    clearInterval(state.timerInterval);
    state.timerRunning = false;
  } else {
    state.timerRunning = true;
    state.timerInterval = setInterval(() => {
      state.timer -= 1;
      if (state.timer <= 0) {
        state.timer = 0;
        clearInterval(state.timerInterval);
        state.timerRunning = false;
        sendMessage('⏰ انتهت جلسة التركيز! حان وقت الاستراحة.');
      }
      updateTimerDisplay();
    }, 1000);
  }
  updateTimerDisplay();
}

function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  state.timer = 25 * 60;
  updateTimerDisplay();
}

function saveNotes() {
  if (!state.room) return;
  localStorage.setItem(`studcha-notes-${state.room.code}`, $('#sessionNotes').value);
  $('#saveNotesBtn').textContent = 'تم الحفظ ✓';
  setTimeout(() => $('#saveNotesBtn').textContent = 'حفظ محلي', 1200);
}

function loadNotes() {
  if (!state.room) return;
  $('#sessionNotes').value = localStorage.getItem(`studcha-notes-${state.room.code}`) || '';
}

function setupTheme() {
  const saved = localStorage.getItem('studcha-theme');
  if (saved === 'dark') document.body.classList.add('dark');
  $('#themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('studcha-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  });
}

function wireEvents() {
  $('#createRoomBtn').addEventListener('click', () => openModal('roomModal'));
  $('#joinRoomBtn').addEventListener('click', () => openModal('joinModal'));
  $('#helpBtn').addEventListener('click', () => openModal('helpModal'));
  $('#createConfirmBtn').addEventListener('click', createRoom);
  $('#joinConfirmBtn').addEventListener('click', joinRoom);
  $('#copyCodeBtn').addEventListener('click', copyRoomCode);
  $('#shareRoomBtn').addEventListener('click', shareRoom);
  $('#leaveRoomBtn').addEventListener('click', leaveRoom);
  $('#timerStartBtn').addEventListener('click', toggleTimer);
  $('#timerResetBtn').addEventListener('click', resetTimer);
  $('#saveNotesBtn').addEventListener('click', saveNotes);
  $('#focusTimerBtn').addEventListener('click', () => $('#timerDisplay').scrollIntoView({ behavior: 'smooth', block: 'center' }));

  $('#messageForm').addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage($('#messageInput').value);
    $('#messageInput').value = '';
    $('#messageInput').focus();
  });

  $$('.close-btn').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  $$('.modal').forEach(modal => modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.classList.add('hidden');
  }));

  ['#roomCode','#joinName','#roomName','#displayName'].forEach(sel => $(sel).addEventListener('keydown', e => {
    if (e.key === 'Enter') (sel === '#roomCode' || sel === '#joinName') ? joinRoom() : createRoom();
  }));

  window.addEventListener('beforeunload', () => {
    if (state.room) saveRoomLocal();
  });
}

function bootFromUrl() {
  const code = new URLSearchParams(location.search).get('room');
  if (!code) return;
  $('#roomCode').value = normalizeCode(code);
  openModal('joinModal');
}

// Firebase-ready architecture note:
// FIREBASE_CONFIG is intentionally empty in this public repository. Once a Firebase
// Realtime Database project is configured, this module can be extended to sync room
// members/messages across devices without exposing any server secret in the frontend.

setupTheme();
wireEvents();
updateTimerDisplay();
bootFromUrl();
