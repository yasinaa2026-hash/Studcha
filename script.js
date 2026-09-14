const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const defaultChats = [
  { id:'sara', name:'سارة', handle:'@sara', avatar:'س', bio:'أحب التصميم، البرمجة والقهوة ☕', color:'sunset', status:'متصلة الآن', messages:[
    {from:'them', text:'مرحباً ياسين! 👋', time:'10:21'},
    {from:'me', text:'أهلاً سارة، كيف حالك؟', time:'10:22'},
    {from:'them', text:'بخير الحمد لله! هل أنهيت مشروعك الجديد؟', time:'10:23'},
    {from:'me', text:'تقريباً، بقيت بعض اللمسات الأخيرة ✨', time:'10:24'}
  ]},
  { id:'ahmed', name:'أحمد', handle:'@ahmed', avatar:'أ', bio:'مبرمج ومحب للتقنية 🚀', color:'ocean', status:'منذ 5 دقائق', messages:[
    {from:'them', text:'شاهدت التطبيق، التصميم جميل جداً.', time:'09:14'},
    {from:'me', text:'شكراً لك! أريد إضافة أشياء أكثر.', time:'09:16'}
  ]},
  { id:'dev', name:'فريق البرمجة', handle:'@dev-team', avatar:'💻', bio:'مجموعة التطوير', color:'green', status:'3 أعضاء متصلون', messages:[
    {from:'them', text:'تم رفع النسخة الجديدة للمراجعة.', time:'أمس'},
    {from:'them', text:'نحتاج رأيكم في صفحة الدردشة.', time:'أمس'}
  ]},
  { id:'omar', name:'عمر', handle:'@omar', avatar:'ع', bio:'طالب ومطور ويب', color:'violet', status:'متصل مؤخراً', messages:[
    {from:'them', text:'هل لديك وقت اليوم؟', time:'الاثنين'}
  ]}
];

let chats = JSON.parse(localStorage.getItem('chatly-chats') || 'null') || defaultChats;
let activeId = localStorage.getItem('chatly-active') || chats[0]?.id;
let dark = localStorage.getItem('chatly-dark') === '1';

function save(){ localStorage.setItem('chatly-chats', JSON.stringify(chats)); localStorage.setItem('chatly-active', activeId); }
function active(){ return chats.find(c => c.id === activeId) || chats[0]; }
function initials(name){ return [...name].slice(0,1).join(''); }
function now(){ return new Intl.DateTimeFormat('ar',{hour:'2-digit',minute:'2-digit'}).format(new Date()); }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }

function renderList(filter=''){
  const list=$('#chatList'); list.innerHTML='';
  chats.filter(c=>c.name.toLowerCase().includes(filter.toLowerCase()) || c.handle.includes(filter.toLowerCase())).forEach(c=>{
    const last=c.messages.at(-1);
    const el=document.createElement('div'); el.className='chat-item'+(c.id===activeId?' active':''); el.dataset.id=c.id;
    el.innerHTML=`<div class="avatar ${c.id==='sara'?'':''}">${c.avatar}</div><div class="chat-copy"><div class="chat-top"><span class="chat-name">${escapeHtml(c.name)}</span><span class="chat-time">${last?.time||''}</span></div><div class="last-msg">${escapeHtml(last?.text||'ابدأ محادثة جديدة')}</div></div>`;
    el.addEventListener('click',()=>selectChat(c.id)); list.appendChild(el);
  });
}

function renderChat(){
  const c=active(); if(!c) return;
  $('#activeAvatar').textContent=c.avatar; $('#activeName').textContent=c.name; $('#activeStatus').textContent=c.status;
  $('#detailsAvatar').textContent=c.avatar; $('#detailsName').textContent=c.name; $('#detailsHandle').textContent=c.handle; $('#detailsBio').textContent=c.bio;
  const box=$('#messages'); box.innerHTML='<div class="day-divider">اليوم</div>';
  c.messages.forEach(m=>{
    const row=document.createElement('div'); row.className='message-row '+(m.from==='me'?'mine':'');
    row.innerHTML=`<div class="message-bubble">${escapeHtml(m.text)}</div><span class="message-time">${m.time}</span>`; box.appendChild(row);
  });
  box.scrollTop=box.scrollHeight; $('#messageInput').focus();
}

function selectChat(id){ activeId=id; save(); renderList($('#chatSearch').value); renderChat(); $('#sidebar').classList.remove('open'); }
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }

function autoReply(){
  const c=active(); if(!c) return;
  $('#typing').classList.add('show');
  setTimeout(()=>{
    $('#typing').classList.remove('show');
    const replies=['أكيد! 👍','جميل جداً 😍','فكرة ممتازة!','تمام، سأخبرك قريباً.','هههه 😂','موافق، لنبدأ! 🚀','هذا رائع ✨'];
    c.messages.push({from:'them',text:replies[Math.floor(Math.random()*replies.length)],time:now()});
    save(); renderList($('#chatSearch').value); renderChat();
  },900+Math.random()*900);
}

$('#composer').addEventListener('submit',e=>{
  e.preventDefault(); const input=$('#messageInput'); const text=input.value.trim(); if(!text) return;
  active().messages.push({from:'me',text,time:now()}); input.value=''; $('#emojiPanel').classList.remove('show'); save(); renderList($('#chatSearch').value); renderChat(); autoReply();
});

$('#emojiBtn').onclick=()=>$('#emojiPanel').classList.toggle('show');
$$('#emojiPanel button').forEach(b=>b.onclick=()=>{ $('#messageInput').value += b.textContent; $('#messageInput').focus(); });
$('#attachBtn').onclick=()=>$('#fileInput').click();
$('#fileInput').addEventListener('change',e=>{ const f=e.target.files[0]; if(f){ active().messages.push({from:'me',text:`📎 ${f.name}`,time:now()}); save(); renderList($('#chatSearch').value); renderChat(); toast('تمت إضافة الملف للمحادثة'); } e.target.value=''; });
$('#chatSearch').addEventListener('input',e=>renderList(e.target.value));
$('#themeBtn').onclick=()=>{ dark=!dark; document.body.classList.toggle('dark',dark); localStorage.setItem('chatly-dark',dark?'1':'0'); $('#themeText').textContent=dark?'الوضع الفاتح':'الوضع الداكن'; };
$('#settingsBtn').onclick=()=>toast('الإعدادات الأساسية محفوظة محلياً');
$('#callBtn').onclick=()=>toast('الاتصال التجريبي غير متصل بخادم');
$('#moreBtn').onclick=()=>toast('المزيد قريباً');
$('#muteBtn').onclick=()=>toast('تم تبديل حالة كتم الإشعارات');
$('#searchMessagesBtn').onclick=()=>{ $('#chatSearch').focus(); toast('استخدم البحث للعثور على المحادثة'); };
$('#clearChatBtn').onclick=()=>{ if(confirm('هل تريد حذف رسائل هذه المحادثة من هذا المتصفح؟')){ active().messages=[]; save(); renderList(); renderChat(); toast('تم حذف الرسائل'); } };
$('#newChatBtn').onclick=()=>{ $('#newChatModal').classList.remove('hidden'); $('#newChatName').focus(); };
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
$('#createChatBtn').onclick=()=>{
  const name=$('#newChatName').value.trim(); if(!name){ toast('اكتب الاسم أولاً'); return; }
  const id='chat-'+Date.now(); chats.unshift({id,name,handle:'@'+name.replace(/\s+/g,'').toLowerCase(),avatar:initials(name),bio:$('#newChatBio').value.trim()||'مستخدم جديد على Chatly',color:'violet',status:'متصل الآن',messages:[]});
  $('#newChatName').value=''; $('#newChatBio').value=''; $('#newChatModal').classList.add('hidden'); selectChat(id); toast('تم إنشاء المحادثة');
};
$('#newChatName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#createChatBtn').click()});
$('#openSidebar').onclick=()=>$('#sidebar').classList.add('open');
$('#closeSidebar').onclick=()=>$('#sidebar').classList.remove('open');
document.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#chatSearch').focus();} if(e.key==='Escape'){ $('#emojiPanel').classList.remove('show'); $('#newChatModal').classList.add('hidden'); }});

document.body.classList.toggle('dark',dark); $('#themeText').textContent=dark?'الوضع الفاتح':'الوضع الداكن'; renderList(); renderChat();
