(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const KEY = 'chat-account';
  let myName = '';
  let peer = null;
  let connection = null;
  let pendingCall = null;
  let call = null;
  let localStream = null;

  const toast = (text) => {
    const el = $('#toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  };

  const first = (name) => (name || '؟').trim().slice(0, 1).toUpperCase();

  function showApp() {
    $('#startScreen')?.classList.add('hidden');
    $('#app')?.classList.remove('hidden');
    $('#myName').textContent = myName;
    $('#myAvatar').textContent = first(myName);
  }

  function showStart() {
    $('#app')?.classList.add('hidden');
    $('#startScreen')?.classList.remove('hidden');
    const input = $('#displayNameInput');
    if (input) {
      input.focus();
      input.select();
    }
  }

  function saveAccount(name) {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) {
      const e = $('#startError');
      if (e) e.textContent = 'اكتب اسمك أولًا.';
      toast('اكتب اسمك أولًا');
      return false;
    }
    myName = clean;
    localStorage.setItem(KEY, JSON.stringify({ name: clean, createdAt: Date.now() }));
    return true;
  }

  function loadAccount() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (a?.name) myName = a.name;
    } catch (_) {}
    return Boolean(myName);
  }

  function addMessage(text, mine) {
    const box = $('#messages');
    if (!box) return;
    $('#emptyWelcome')?.remove();
    const row = document.createElement('div');
    row.className = `message ${mine ? 'mine' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    row.append(bubble, time);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  function openConversation(name) {
    $('#activeName').textContent = name || 'صديق';
    $('#activeAvatar').textContent = first(name);
    $('#activeStatus').textContent = connection?.open ? 'متصل' : 'بانتظار الاتصال';
    $('#chatList').innerHTML = `<button class="chat-item active" type="button"><div class="avatar">${first(name)}</div><div class="chat-copy"><b>${name || 'صديق'}</b><small>محادثة مباشرة</small></div></button>`;
  }

  function loadPeerScript() {
    if (window.Peer || document.getElementById('peer-script')) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = 'peer-script';
      s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function setupPeer() {
    try {
      await loadPeerScript();
      if (!window.Peer) throw new Error('PeerJS unavailable');
      peer = new window.Peer();
      peer.on('open', (id) => {
        localStorage.setItem('chat-peer-id', id);
        const invite = new URL(location.href);
        const target = invite.searchParams.get('connect');
        if (target && target !== id) connectTo(target);
      });
      peer.on('connection', (c) => {
        connection = c;
        bindConnection(c, false);
      });
      peer.on('call', (c) => {
        pendingCall = c;
        showIncoming(c);
      });
      peer.on('error', () => {
        toast('الاتصال بالشخص تعذر الآن. جرّب الرابط مرة أخرى.');
      });
    } catch (err) {
      console.error(err);
      toast('تم إنشاء حسابك. الاتصال المباشر غير متاح الآن.');
    }
  }

  function bindConnection(c, outgoing) {
    c.on('open', () => {
      openConversation(c.metadata?.name || 'صديق');
      c.send({ type: 'hello', name: myName });
      toast('تم الاتصال');
    });
    c.on('data', (data) => {
      if (!data) return;
      if (data.type === 'hello') openConversation(data.name || 'صديق');
      if (data.type === 'text') addMessage(data.text, false);
      if (data.type === 'name') openConversation(data.name || 'صديق');
    });
    c.on('close', () => {
      if (connection === c) connection = null;
      $('#activeStatus').textContent = 'غير متصل';
    });
    if (outgoing && c.open) c.send({ type: 'hello', name: myName });
  }

  function connectTo(id) {
    if (!peer || !id) return;
    try {
      connection?.close();
      const c = peer.connect(id, { reliable: true, metadata: { name: myName } });
      connection = c;
      bindConnection(c, true);
      history.replaceState({}, '', location.pathname);
    } catch (_) {
      toast('تعذر فتح المحادثة');
    }
  }

  function makeConversationInvite() {
    const name = $('#friendName').value.trim() || 'صديق';
    const id = localStorage.getItem('chat-peer-id');
    if (!id) {
      toast('انتظر لحظة حتى يجهز رابطك');
      return;
    }
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('connect', id);
    $('#inviteLink').value = u.href;
    $('#activeName').textContent = name;
    $('#activeAvatar').textContent = first(name);
    $('#chatModal').classList.add('hidden');
    $('#inviteModal').classList.remove('hidden');
  }

  async function copyInvite() {
    const value = $('#inviteLink')?.value;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast('تم نسخ الرابط');
    } catch (_) {
      $('#inviteLink').select();
      document.execCommand('copy');
      toast('تم نسخ الرابط');
    }
  }

  function sendText() {
    const input = $('#messageInput');
    const text = input.value.trim();
    if (!text) return;
    if (!connection?.open) return toast('لا يوجد اتصال حاليًا. افتح رابط الدعوة أولًا.');
    connection.send({ type: 'text', text });
    addMessage(text, true);
    input.value = '';
  }

  async function startCall(video) {
    if (!connection?.open || !connection.peer) return toast('اتصل بصديق أولًا');
    if (!navigator.mediaDevices?.getUserMedia) return toast('المكالمات تحتاج HTTPS');
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      $('#callModal')?.classList.remove('hidden');
      $('#callName').textContent = $('#activeName').textContent;
      $('#callState').textContent = 'جارٍ الاتصال...';
      $('#localVideo').srcObject = localStream;
      $('#localVideo').classList.toggle('hidden', !video);
      call = peer.call(connection.peer, localStream, { metadata: { callerName: myName, video } });
      call.on('stream', (remote) => {
        $('#remoteVideo').srcObject = remote;
        $('#callState').textContent = 'متصل';
      });
      call.on('close', endCall);
    } catch (_) {
      toast('اسمح بالكاميرا والميكروفون لإجراء المكالمة');
    }
  }

  function showIncoming(c) {
    const old = $('#incoming');
    old?.remove();
    const box = document.createElement('div');
    box.id = 'incoming';
    box.className = 'incoming';
    box.innerHTML = `<div class="incoming-icon">${c.metadata?.video ? '📹' : '📞'}</div><div class="incoming-copy"><b>${c.metadata?.callerName || 'مكالمة واردة'}</b><span>${c.metadata?.video ? 'مكالمة فيديو' : 'مكالمة صوتية'}</span></div><button id="acceptCall" class="accept" type="button">قبول</button><button id="rejectCall" class="reject" type="button">رفض</button>`;
    document.body.appendChild(box);
    $('#acceptCall').onclick = () => acceptCall(c);
    $('#rejectCall').onclick = () => { c.close(); box.remove(); pendingCall = null; };
  }

  async function acceptCall(c) {
    try {
      $('#incoming')?.remove();
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!c.metadata?.video });
      $('#callModal')?.classList.remove('hidden');
      $('#callName').textContent = c.metadata?.callerName || 'مكالمة';
      $('#callState').textContent = 'متصل';
      $('#localVideo').srcObject = localStream;
      $('#localVideo').classList.toggle('hidden', !c.metadata?.video);
      c.answer(localStream);
      call = c;
      c.on('stream', (remote) => { $('#remoteVideo').srcObject = remote; });
      c.on('close', endCall);
    } catch (_) {
      c.close();
      toast('اسمح بالكاميرا والميكروفون لقبول المكالمة');
    }
    pendingCall = null;
  }

  function endCall() {
    try { call?.close(); } catch (_) {}
    localStream?.getTracks().forEach((t) => t.stop());
    call = null;
    localStream = null;
    $('#remoteVideo').srcObject = null;
    $('#localVideo').srcObject = null;
    $('#callModal')?.classList.add('hidden');
  }

  function createRoom() {
    const name = prompt('اكتب اسم الغرفة');
    if (!name?.trim()) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('room', code);
    $('#roomTitle').textContent = name.trim();
    $('#roomStatus').textContent = `رمز الغرفة: ${code}`;
    $('#roomLink').value = u.href;
    $('#roomModal').classList.remove('hidden');
  }

  async function copyRoom() {
    const value = $('#roomLink')?.value;
    if (!value) return;
    try { await navigator.clipboard.writeText(value); toast('تم نسخ رابط الغرفة'); } catch (_) { $('#roomLink').select(); document.execCommand('copy'); toast('تم نسخ الرابط'); }
  }

  function joinRoom() {
    const value = prompt('الصق رابط الغرفة');
    if (value) location.href = value;
  }

  function bindUI() {
    $('#startBtn').onclick = async () => {
      if (!saveAccount($('#displayNameInput').value)) return;
      showApp();
      toast('تم إنشاء حسابك بنجاح ✅');
      await setupPeer();
    };

    $('#displayNameInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#startBtn').click();
    });

    $('#newChatBtn').onclick = () => $('#chatModal').classList.remove('hidden');
    $('#makeInvite').onclick = makeConversationInvite;
    $('#copyInvite').onclick = copyInvite;
    $('#copyMyLink').onclick = copyInvite;
    $('#composer').onsubmit = (e) => { e.preventDefault(); sendText(); };
    $('#audioBtn').onclick = () => startCall(false);
    $('#videoBtn').onclick = () => startCall(true);
    $('#endCallBtn').onclick = endCall;
    $('#endCallTop').onclick = endCall;
    $('#createRoomBtn').onclick = createRoom;
    $('#joinRoomBtn').onclick = joinRoom;
    $('#copyRoom').onclick = copyRoom;
    $('#leaveRoom').onclick = () => $('#roomModal').classList.add('hidden');
    $('#logoutBtn').onclick = () => { localStorage.removeItem(KEY); localStorage.removeItem('chat-peer-id'); location.reload(); };
    $('#darkBtn').onclick = () => document.body.classList.toggle('dark');
    $('#attachBtn').onclick = () => $('#fileInput').click();
    $('#fileInput').onchange = () => {
      const f = $('#fileInput').files?.[0];
      if (!f) return;
      toast(`الملف المحدد: ${f.name}`);
      $('#fileInput').value = '';
    };
    document.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => document.getElementById(b.dataset.close)?.classList.add('hidden'));
    $('#openSidebar').onclick = () => $('#sidebar').classList.add('open');
    $('#closeSidebar').onclick = () => $('#sidebar').classList.remove('open');
  }

  async function boot() {
    bindUI();
    if (loadAccount()) {
      showApp();
      await setupPeer();
    } else {
      showStart();
    }
  }

  boot();
})();
