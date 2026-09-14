const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let client = null;
let me = null;
let myProfile = null;
let conversations = [];
let activeConversation = null;
let messageChannel = null;
let personalCallChannel = null;
let callChannel = null;
let pc = null;
let localStream = null;
let currentCall = null;
let pendingIncoming = null;
let isMuted = false;
let cameraOff = false;
let dark = localStorage.getItem('chat-dark') === '1';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function config(){ return {url:localStorage.getItem('chat-supabase-url') || '', key:localStorage.getItem('chat-supabase-key') || ''}; }
function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
function setAuthMessage(message, ok=false){ const el=$('#authMessage'); el.textContent=message || ''; el.style.color=ok?'var(--success)':'var(--danger)'; }
function initials(name){ return (name || '?').trim().slice(0,1).toUpperCase(); }
function esc(value){ return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function formatTime(v){ return new Intl.DateTimeFormat('ar',{hour:'2-digit',minute:'2-digit'}).format(new Date(v)); }
function dateLabel(v){ return new Intl.DateTimeFormat('ar',{year:'numeric',month:'long',day:'numeric'}).format(new Date(v)); }
function shareLink(username){ return `${location.origin}${location.pathname}?user=${encodeURIComponent(username)}`; }
function setAvatar(el, name){ el.textContent=initials(name); }

function showScreen(name){
  ['setupScreen','authScreen','app'].forEach(id=>$('#'+id).classList.toggle('hidden',id!==name));
}

async function boot(){
  document.body.classList.toggle('dark',dark);
  const c=config();
  if(!c.url || !c.key){ showScreen('setupScreen'); return; }
  try{
    client = window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data:{session}} = await client.auth.getSession();
    if(session){ await startApp(session.user); } else showScreen('authScreen');
    client.auth.onAuthStateChange(async (_event,session)=>{
      if(session && !me){ await startApp(session.user); }
      if(!session){ me=null; myProfile=null; conversations=[]; showScreen('authScreen'); }
    });
  }catch(err){ showScreen('setupScreen'); toast('تعذر تشغيل Supabase'); console.error(err); }
}

async function startApp(user){
  me=user;
  const {data,error}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error){ setAuthMessage(error.message); return; }
  myProfile=data;
  showScreen('app');
  renderMe();
  $('#myShareLink').textContent=shareLink(myProfile.username);
  await loadConversations();
  await subscribePersonalCalls();
  handleIncomingProfileLink();
}

function renderMe(){
  $('#myName').textContent=myProfile?.display_name || me.email?.split('@')[0] || 'مستخدم';
  $('#myUsername').textContent='@'+(myProfile?.username || 'user');
  setAvatar($('#myAvatar'),myProfile?.display_name || 'م');
}

async function loadConversations(){
  const {data:members,error}=await client.from('conversation_members').select('conversation_id').eq('user_id',me.id);
  if(error){ toast(error.message); return; }
  const ids=[...(members||[]).map(x=>x.conversation_id)];
  if(!ids.length){ conversations=[]; renderConversationList(); renderWelcome(); return; }
  const [{data:others},{data:messages}]=await Promise.all([
    client.from('conversation_members').select('conversation_id,user_id,profiles(id,username,display_name)').in('conversation_id',ids).neq('user_id',me.id),
    client.from('messages').select('id,conversation_id,sender_id,body,attachment_path,attachment_type,created_at').in('conversation_id',ids).order('created_at',{ascending:false})
  ]);
  const byId=new Map();
  (others||[]).forEach(row=>byId.set(row.conversation_id,row.profiles));
  const lastById=new Map();
  (messages||[]).forEach(m=>{if(!lastById.has(m.conversation_id)) lastById.set(m.conversation_id,m);});
  conversations=ids.map(id=>({id,other:byId.get(id),last:lastById.get(id)||null})).filter(x=>x.other);
  renderConversationList();
}

function renderConversationList(filter=''){
  const list=$('#chatList'); list.innerHTML='';
  const needle=filter.trim().toLowerCase();
  const shown=conversations.filter(c=>`${c.other.display_name} ${c.other.username}`.toLowerCase().includes(needle));
  if(!shown.length){ list.innerHTML='<div class="empty-list">لا توجد محادثات بعد.</div>'; return; }
  shown.forEach(c=>{
    const el=document.createElement('button'); el.className='chat-item'+(activeConversation?.id===c.id?' active':'');
    el.innerHTML=`<div class="avatar">${esc(initials(c.other.display_name))}</div><div class="chat-copy"><div class="chat-top"><span class="chat-name">${esc(c.other.display_name)}</span><span class="chat-time">${c.last?formatTime(c.last.created_at):''}</span></div><div class="last-msg">${c.last?(c.last.attachment_path?'📎 ملف':esc(c.last.body||'صورة')):'ابدأ المحادثة'}</div></div>`;
    el.onclick=()=>openConversation(c); list.appendChild(el);
  });
}

function renderWelcome(){
  $('#messages').innerHTML='<div class="welcome"><div>💬</div><h3>مرحبًا بك في Chat</h3><p>ابحث عن زميلك باسم المستخدم أو شارك رابط حسابك لبدء محادثة حقيقية.</p></div>';
}

async function openConversation(conv){
  activeConversation=conv;
  renderConversationList($('#chatSearch').value);
  $('#activeName').textContent=conv.other.display_name;
  $('#activeStatus').textContent='@'+conv.other.username;
  $('#detailsName').textContent=conv.other.display_name;
  $('#detailsUsername').textContent='@'+conv.other.username;
  setAvatar($('#activeAvatar'),conv.other.display_name); setAvatar($('#detailsAvatar'),conv.other.display_name);
  $('#sidebar').classList.remove('open');
  await subscribeMessages(conv.id);
  await loadMessages(conv.id);
}

async function loadMessages(conversationId){
  const {data,error}=await client.from('messages').select('id,conversation_id,sender_id,body,attachment_path,attachment_type,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true});
  if(error){toast(error.message);return;}
  const box=$('#messages'); box.innerHTML='';
  if(!data?.length){ renderWelcome(); return; }
  let day='';
  for(const m of data){ const d=dateLabel(m.created_at); if(d!==day){day=d;const divider=document.createElement('div');divider.className='day';divider.textContent=d;box.appendChild(divider);} await appendMessage(m,false); }
  box.scrollTop=box.scrollHeight;
}

async function appendMessage(m,scroll=true){
  const row=document.createElement('div'); row.className='message '+(m.sender_id===me.id?'mine':'');
  let body='';
  if(m.body) body+=`<div class="bubble">${esc(m.body)}</div>`;
  if(m.attachment_path){
    const {data}=await client.storage.from('chat-files').createSignedUrl(m.attachment_path,3600);
    if(data?.signedUrl){
      if((m.attachment_type||'').startsWith('image/')) body+=`<div class="bubble attachment"><img src="${esc(data.signedUrl)}" alt="صورة مرسلة" loading="lazy"></div>`;
      else if((m.attachment_type||'').startsWith('video/')) body+=`<div class="bubble attachment"><video src="${esc(data.signedUrl)}" controls playsinline></video></div>`;
      else body+=`<div class="bubble"><a class="file-link" href="${esc(data.signedUrl)}" target="_blank" rel="noopener">📎 فتح الملف</a></div>`;
    }
  }
  row.innerHTML=`${body}<span class="time">${formatTime(m.created_at)}</span>`;
  $('#messages').appendChild(row);
  if(scroll) $('#messages').scrollTop=$('#messages').scrollHeight;
}

async function subscribeMessages(conversationId){
  if(messageChannel) await client.removeChannel(messageChannel);
  messageChannel=client.channel('messages:'+conversationId).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${conversationId}`},async payload=>{ if(payload.new.sender_id!==me.id) await appendMessage(payload.new,true); const c=conversations.find(x=>x.id===conversationId); if(c){c.last=payload.new;renderConversationList($('#chatSearch').value);} }).subscribe();
}

async function subscribePersonalCalls(){
  if(personalCallChannel) await client.removeChannel(personalCallChannel);
  personalCallChannel=client.channel('user-call:'+me.id).on('broadcast',{event:'incoming-call'},payload=>{
    const call=payload.payload;
    pendingIncoming=call;
    $('#incomingCaller').textContent=call.callerName || 'مكالمة واردة';
    $('#incomingType').textContent=call.type==='video'?'مكالمة فيديو':'مكالمة صوتية';
    $('#incomingCall').classList.remove('hidden');
  }).subscribe();
}

async function sendText(text){
  if(!activeConversation || !text.trim()) return;
  const {error}=await client.from('messages').insert({conversation_id:activeConversation.id,sender_id:me.id,body:text.trim()});
  if(error) toast(error.message); else $('#messageInput').value='';
}

async function sendFile(file){
  if(!activeConversation) return;
  if(file.size>20*1024*1024){toast('الملف أكبر من 20MB');return;}
  toast('جارٍ رفع الملف...');
  const safe=file.name.replace(/[^\w.\-]+/g,'_');
  const path=`${me.id}/${crypto.randomUUID()}-${safe}`;
  const {error:uploadError}=await client.storage.from('chat-files').upload(path,file,{upsert:false,contentType:file.type || 'application/octet-stream'});
  if(uploadError){toast(uploadError.message);return;}
  const {error}=await client.from('messages').insert({conversation_id:activeConversation.id,sender_id:me.id,body:'',attachment_path:path,attachment_type:file.type || 'application/octet-stream'});
  if(error){ await client.storage.from('chat-files').remove([path]); toast(error.message); return; }
  toast('تم إرسال الملف');
}

async function findUser(){
  const username=$('#userLookup').value.trim().replace(/^@/,'').toLowerCase(); if(!username){toast('اكتب اسم المستخدم');return;}
  const {data,error}=await client.from('profiles').select('id,username,display_name').eq('username',username).maybeSingle();
  const box=$('#lookupResults'); box.innerHTML='';
  if(error){toast(error.message);return;}
  if(!data){box.innerHTML='<p class="lookup-none">لم يتم العثور على المستخدم.</p>';return;}
  if(data.id===me.id){box.innerHTML='<p class="lookup-none">هذا حسابك أنت.</p>';return;}
  const item=document.createElement('button'); item.className='lookup-user'; item.innerHTML=`<div class="avatar">${esc(initials(data.display_name))}</div><div><b>${esc(data.display_name)}</b><span>@${esc(data.username)}</span></div>`; item.onclick=()=>startConversation(data); box.appendChild(item);
}

async function startConversation(user){
  const {data,error}=await client.rpc('create_direct_conversation',{other_user:user.id});
  if(error){toast(error.message);return;}
  $('#newChatModal').classList.add('hidden'); $('#lookupResults').innerHTML=''; $('#userLookup').value='';
  await loadConversations();
  const conv=conversations.find(c=>c.id===data); if(conv) await openConversation(conv); else toast('تم إنشاء المحادثة، أعد فتح القائمة');
}

function handleIncomingProfileLink(){
  const username=new URLSearchParams(location.search).get('user');
  if(username && username.toLowerCase()!==(myProfile?.username||'').toLowerCase()){
    $('#newChatModal').classList.remove('hidden'); $('#userLookup').value=username.replace(/^@/,''); setTimeout(()=>$('#lookupBtn').click(),100);
  }
}

async function setupCall(type,calleeUser,conversationId,isCaller=true){
  currentCall={type,calleeUser,conversationId,isCaller};
  $('#callTitle').textContent=`${type==='video'?'مكالمة فيديو':'مكالمة صوتية'} — ${calleeUser.display_name}`;
  $('#callState').textContent=isCaller?'جارٍ الاتصال...':'متصل';
  $('#callAvatar').textContent=initials(calleeUser.display_name);
  $('#callModal').classList.remove('hidden');
  $('#localVideo').classList.toggle('hidden',type!=='video');
  $('#cameraCall').classList.toggle('hidden',type!=='video');
  $('#remoteVideo').classList.toggle('hidden',type!=='video');
  await startMedia(type);
  await setupPeer(type);
  await subscribeCallChannel(conversationId);
  if(isCaller){
    const offer=await pc.createOffer(); await pc.setLocalDescription(offer); await broadcastCall('offer',{offer});
  }
}

async function startMedia(type){
  try{
    localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:type==='video'});
    $('#localVideo').srcObject=localStream;
  }catch(err){ $('#callModal').classList.add('hidden'); toast('اسمح للمتصفح باستخدام الميكروفون/الكاميرا للمكالمة'); throw err; }
}

async function setupPeer(type){
  if(pc){pc.close();}
  pc=new RTCPeerConnection(ICE_SERVERS);
  localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));
  pc.ontrack=(e)=>{ $('#remoteVideo').srcObject=e.streams[0]; $('#callState').textContent='متصل'; };
  pc.onicecandidate=(e)=>{if(e.candidate) broadcastCall('ice',{candidate:e.candidate});};
  pc.onconnectionstatechange=()=>{if(['failed','disconnected','closed'].includes(pc.connectionState)) endCall(false);};
}

async function subscribeCallChannel(conversationId){
  if(callChannel) await client.removeChannel(callChannel);
  callChannel=client.channel('call-room:'+conversationId).on('broadcast',{event:'offer'},async ({payload})=>{
    if(currentCall?.isCaller) return;
    await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
    const answer=await pc.createAnswer(); await pc.setLocalDescription(answer); await broadcastCall('answer',{answer});
  }).on('broadcast',{event:'answer'},async ({payload})=>{ if(currentCall?.isCaller) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer)); }).on('broadcast',{event:'ice'},async ({payload})=>{try{await pc.addIceCandidate(payload.candidate);}catch{}}).on('broadcast',{event:'hangup'},()=>endCall(false)).subscribe();
}

async function broadcastCall(event,payload){ if(callChannel) await callChannel.send({type:'broadcast',event,payload:{...payload,sender:me.id}}); }

async function inviteCall(type){
  if(!activeConversation){toast('اختر محادثة أولاً');return;}
  const other=activeConversation.other;
  const {error}=await client.channel('user-call:'+other.id).send({type:'broadcast',event:'incoming-call',payload:{conversationId:activeConversation.id,type,callerId:me.id,callerName:myProfile.display_name,calleeId:other.id}});
  if(error){toast(error.message);return;}
  try{await setupCall(type,other,activeConversation.id,true);}catch{}
}

async function acceptIncoming(){
  if(!pendingIncoming) return;
  $('#incomingCall').classList.add('hidden');
  const user={id:pendingIncoming.callerId,display_name:pendingIncoming.callerName,username:''};
  try{ await setupCall(pendingIncoming.type,user,pendingIncoming.conversationId,false); }catch{}
  pendingIncoming=null;
}

async function rejectIncoming(){ $('#incomingCall').classList.add('hidden'); pendingIncoming=null; }

async function endCall(sendSignal=true){
  if(sendSignal) await broadcastCall('hangup',{});
  if(pc){pc.close();pc=null;} if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;} if(callChannel){await client.removeChannel(callChannel);callChannel=null;}
  $('#remoteVideo').srcObject=null; $('#localVideo').srcObject=null; $('#callModal').classList.add('hidden'); currentCall=null; isMuted=false;cameraOff=false;toast('انتهت المكالمة');
}

$('#saveConfig').onclick=async()=>{
  const url=$('#supabaseUrl').value.trim(),key=$('#supabaseKey').value.trim();
  if(!url||!key){toast('أدخل القيمتين أولاً');return;}
  localStorage.setItem('chat-supabase-url',url);localStorage.setItem('chat-supabase-key',key);location.reload();
};

$$('.auth-tabs button').forEach(btn=>btn.onclick=()=>{$$('.auth-tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#loginForm').classList.toggle('hidden',btn.dataset.auth!=='login');$('#signupForm').classList.toggle('hidden',btn.dataset.auth!=='signup');setAuthMessage('');});

$('#loginForm').onsubmit=async(e)=>{e.preventDefault();setAuthMessage('');const {error}=await client.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});if(error)setAuthMessage(error.message);};
$('#signupForm').onsubmit=async(e)=>{e.preventDefault();setAuthMessage('');const username=$('#signupUsername').value.trim().toLowerCase();if(!/^[a-z0-9_]{3,20}$/.test(username)){setAuthMessage('اسم المستخدم: حروف إنجليزية وأرقام و _ فقط، من 3 إلى 20 حرفًا.');return;}const {error}=await client.auth.signUp({email:$('#signupEmail').value.trim(),password:$('#signupPassword').value,options:{data:{display_name:$('#signupName').value.trim(),username}}});if(error)setAuthMessage(error.message);else setAuthMessage('تم إنشاء الحساب. تحقق من بريدك الإلكتروني إذا كان تأكيد البريد مفعّلًا.',true);};

$('#signOutBtn').onclick=async()=>{await endCall(false);await client.auth.signOut();location.reload();};
$('#newChatBtn').onclick=()=>{$('#newChatModal').classList.remove('hidden');$('#userLookup').focus();};
$('#lookupBtn').onclick=findUser;
$('#userLookup').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findUser();}};
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
$('#composer').onsubmit=async(e)=>{e.preventDefault();await sendText($('#messageInput').value);};
$('#fileBtn').onclick=()=>{if(!activeConversation){toast('اختر محادثة أولاً');return;}$('#fileInput').click();};
$('#fileInput').onchange=async(e)=>{const f=e.target.files[0];if(f)await sendFile(f);e.target.value='';};
$('#emojiBtn').onclick=()=>$('#emojiPanel').classList.toggle('show');
$$('#emojiPanel button').forEach(b=>b.onclick=()=>{$('#messageInput').value+=b.textContent;$('#messageInput').focus();});
$('#chatSearch').oninput=e=>renderConversationList(e.target.value);
$('#audioCallBtn').onclick=()=>inviteCall('audio');
$('#videoCallBtn').onclick=()=>inviteCall('video');
$('#endCall').onclick=()=>endCall(true); $('#endCallTop').onclick=()=>endCall(true);
$('#acceptCall').onclick=acceptIncoming; $('#rejectCall').onclick=rejectIncoming;
$('#muteCall').onclick=()=>{isMuted=!isMuted;localStream?.getAudioTracks().forEach(t=>t.enabled=!isMuted);$('#muteCall').textContent=isMuted?'🔇':'🎙️';};
$('#cameraCall').onclick=()=>{cameraOff=!cameraOff;localStream?.getVideoTracks().forEach(t=>t.enabled=!cameraOff);$('#cameraCall').textContent=cameraOff?'🚫':'📷';};
$('#copyShareBtn').onclick=async()=>{await navigator.clipboard.writeText(shareLink(myProfile.username));toast('تم نسخ رابط حسابك');};
$('#copyUsernameBtn').onclick=async()=>{await navigator.clipboard.writeText('@'+myProfile.username);toast('تم نسخ المعرف');};
$('#blockBtn').onclick=()=>toast('الحظر يحتاج جدول block_list ويمكن إضافته لاحقًا');
$('#detailsBtn').onclick=()=>$('#details').classList.toggle('show-mobile');
$('#openSidebar').onclick=()=>$('#sidebar').classList.add('open');$('#closeSidebar').onclick=()=>$('#sidebar').classList.remove('open');
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#chatSearch').focus();}if(e.key==='Escape'){$('#emojiPanel').classList.remove('show');$('#newChatModal').classList.add('hidden');}});

boot();
