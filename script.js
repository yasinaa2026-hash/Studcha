import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const $ = (s) => document.querySelector(s);
const state = {
  client: SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null,
  room: null,
  guestId: getGuestId(),
  displayName: localStorage.getItem('chat-display-name') || '',
  channel: null,
  messages: [],
  members: []
};

function getGuestId() {
  let id = localStorage.getItem('chat-guest-id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('chat-guest-id', id);
  }
  return id;
}
function cleanCode(v){ return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8); }
function initials(v){ return (String(v || 'C').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2) || 'C').toUpperCase(); }
function escapeHtml(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function clock(v){ return new Date(v || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function showError(v=''){ $('#error').textContent = v; }
function openModal(mode){
  $('#modal').classList.remove('hidden'); showError('');
  const join = mode === 'join';
  $('#modalTitle').textContent = join ? 'الانضمام إلى غرفة' : 'إنشاء غرفة';
  $('#modalText').textContent = join ? 'أدخل رقم الغرفة واسمك.' : 'أنشئ رقمًا فريدًا وشارك الرابط مع صديقك.';
  $('#modalIcon').textContent = join ? '🔗' : '＋';
  $('#joinOnly').classList.toggle('hidden', !join);
  $('#roomNameInput').classList.toggle('hidden', join);
  document.querySelector('label[for="roomNameInput"]').classList.toggle('hidden', join);
  $('#confirmBtn').dataset.mode = mode;
  $('#confirmBtn').textContent = join ? 'دخول الغرفة' : 'إنشاء الغرفة';
}
function closeModal(){ $('#modal').classList.add('hidden'); }

async function createRoom(roomName, displayName){
  if (!state.client) return localRoomCreate(roomName, displayName);
  const { data, error } = await state.client.rpc('create_room', { room_name: roomName, p_guest_id: state.guestId, p_display_name: displayName });
  if (error) throw error;
  return data;
}
async function joinRoom(code, displayName){
  if (!state.client) return localRoomJoin(code, displayName);
  const { data, error } = await state.client.rpc('join_room', { room_code: code, p_guest_id: state.guestId, p_display_name: displayName });
  if (error) throw error;
  return data;
}

function localKey(code){ return `chat-room-${code}`; }
function localRoomCreate(name, displayName){
  let code;
  do { code = Array.from({length:8},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join(''); } while(localStorage.getItem(localKey(code)));
  const room = {id: code, code, name, created_at: new Date().toISOString(), local:true, members:[], messages:[]};
  localStorage.setItem(localKey(code), JSON.stringify(room));
  return room;
}
function localRoomJoin(code){ const raw=localStorage.getItem(localKey(code)); if(!raw) throw new Error('هذه الغرفة غير موجودة في الوضع التجريبي. اربط Supabase لتعمل بين الأجهزة.'); return JSON.parse(raw); }
function localSaveRoom(){ if(state.room?.local) localStorage.setItem(localKey(state.room.code), JSON.stringify({...state.room,members:state.members,messages:state.messages})); }

async function loadRoomData(room){
  if (!state.client || room.local) {
    state.members = room.members || [];
    state.messages = room.messages || [];
    return;
  }
  const [{data:members,error:me},{data:messages,error:msg}] = await Promise.all([
    state.client.from('room_members').select('guest_id,display_name,joined_at').eq('room_id',room.id).order('joined_at',{ascending:true}),
    state.client.from('room_messages').select('id,guest_id,display_name,body,created_at').eq('room_id',room.id).order('created_at',{ascending:true}).limit(500)
  ]);
  if(me) throw me; if(msg) throw msg;
  state.members = members || []; state.messages = messages || [];
}

function render(){
  if(!state.room) return;
  $('#roomName').textContent = state.room.name;
  $('#chatTitle').textContent = state.room.name;
  $('#roomCode').textContent = state.room.code;
  $('#avatar').textContent = initials(state.room.name);
  $('#memberCount').textContent = state.members.length;
  $('#members').innerHTML = state.members.map(m=>`<div class="member"><span class="avatar">${escapeHtml(initials(m.display_name))}</span><span class="member-name">${escapeHtml(m.display_name)}${m.guest_id===state.guestId?' (أنت)':''}</span><i class="dot"></i></div>`).join('');
  $('#messages').innerHTML = state.messages.map(m=>{
    const mine=m.guest_id===state.guestId;
    return `<article class="message ${mine?'mine':''}"><span class="avatar">${escapeHtml(initials(m.display_name))}</span><div class="bubble"><div class="author">${escapeHtml(m.display_name)}</div><p>${escapeHtml(m.body)}</p></div><span class="time">${escapeHtml(clock(m.created_at))}</span></article>`;
  }).join('');
  const box=$('#messages'); box.scrollTop=box.scrollHeight;
}

async function enterRoom(room, displayName){
  state.room = room; state.displayName = displayName; localStorage.setItem('chat-display-name',displayName);
  await loadRoomData(room);
  if(!state.members.some(m=>m.guest_id===state.guestId)) state.members.push({guest_id:state.guestId,display_name:displayName,joined_at:new Date().toISOString()});
  render();
  $('#home').classList.add('hidden'); $('#room').classList.remove('hidden'); closeModal();
  history.replaceState({},'',`?room=${encodeURIComponent(room.code)}`);
  $('#status').textContent = state.client && !room.local ? '● متصل • Realtime' : '● وضع تجريبي محلي';
  if(state.client && !room.local) subscribeRealtime(); else localSaveRoom();
}

function subscribeRealtime(){
  if(state.channel) state.client.removeChannel(state.channel);
  state.channel = state.client.channel(`room-${state.room.id}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'room_messages',filter:`room_id=eq.${state.room.id}`},payload=>{
      if(!state.messages.some(x=>x.id===payload.new.id)){ state.messages.push(payload.new); render(); }
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'room_members',filter:`room_id=eq.${state.room.id}`},async()=>{ try { await loadRoomData(state.room); render(); } catch {} })
    .subscribe(status=>{ if(status==='SUBSCRIBED') $('#status').textContent='● متصل • Realtime'; });
}

async function sendMessage(text){
  const body=text.trim(); if(!body||!state.room) return;
  if(state.client && !state.room.local){
    const {data,error}=await state.client.from('room_messages').insert({room_id:state.room.id,guest_id:state.guestId,display_name:state.displayName,body}).select('id,guest_id,display_name,body,created_at').single();
    if(error) throw error;
    if(data && !state.messages.some(x=>x.id===data.id)) state.messages.push(data);
  } else {
    state.messages.push({id:`${Date.now()}-${Math.random()}`,guest_id:state.guestId,display_name:state.displayName,body,created_at:new Date().toISOString()});
    localSaveRoom();
  }
  render();
}

async function leave(){
  if(state.channel) { await state.client.removeChannel(state.channel); state.channel=null; }
  if(state.client && state.room && !state.room.local){ await state.client.from('room_members').delete().eq('room_id',state.room.id).eq('guest_id',state.guestId); }
  state.room=null; state.messages=[]; state.members=[]; $('#room').classList.add('hidden'); $('#home').classList.remove('hidden'); history.replaceState({},'',location.pathname);
}

async function copyCode(){ try{ await navigator.clipboard.writeText(state.room.code); $('#copyBtn').textContent='تم ✓'; setTimeout(()=>$('#copyBtn').textContent='نسخ',1200); }catch{} }
async function share(){ const url=`${location.origin}${location.pathname}?room=${state.room.code}`; try{ if(navigator.share) await navigator.share({title:`Chat — ${state.room.name}`,text:'انضم إلى غرفة الدردشة',url}); else {await navigator.clipboard.writeText(url); $('#shareBtn').textContent='تم نسخ الرابط ✓'; setTimeout(()=>$('#shareBtn').textContent='🔗 مشاركة الرابط',1300);} }catch{} }

$('#createBtn').addEventListener('click',()=>openModal('create'));
$('#joinBtn').addEventListener('click',()=>openModal('join'));
$('#closeModal').addEventListener('click',closeModal);
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
$('#confirmBtn').addEventListener('click',async()=>{
  try{
    const name=$('#displayNameInput').value.trim(); if(name.length<1||name.length>30) throw new Error('اكتب اسمًا صحيحًا.');
    const mode=$('#confirmBtn').dataset.mode;
    if(mode==='create'){
      const roomName=$('#roomNameInput').value.trim(); if(roomName.length<1||roomName.length>60) throw new Error('اكتب اسمًا صحيحًا للغرفة.');
      await enterRoom(await createRoom(roomName,name),name);
    } else {
      const code=cleanCode($('#codeInput').value); if(code.length!==8) throw new Error('رقم الغرفة يجب أن يكون 8 أحرف/أرقام.');
      await enterRoom(await joinRoom(code,name),name);
    }
  }catch(e){ showError(e?.message || 'حدث خطأ.'); }
});

$('#messageForm').addEventListener('submit',async e=>{e.preventDefault(); try{const input=$('#messageInput'); await sendMessage(input.value); input.value=''; input.focus();}catch(err){$('#status').textContent='● تعذر إرسال الرسالة'; console.error(err)}});
$('#leaveBtn').addEventListener('click',leave); $('#copyBtn').addEventListener('click',copyCode); $('#shareBtn').addEventListener('click',share);
$('#themeBtn').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('chat-theme',document.body.classList.contains('dark')?'dark':'light')});
if(localStorage.getItem('chat-theme')==='dark') document.body.classList.add('dark');

const urlCode=cleanCode(new URLSearchParams(location.search).get('room'));
if(urlCode){ $('#codeInput').value=urlCode; openModal('join'); }
if(!state.client) $('#status').textContent='● يحتاج Supabase للغرف بين الأجهزة';
