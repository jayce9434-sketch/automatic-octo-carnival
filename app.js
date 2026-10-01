const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const defaults = {
  model: 'openai/gpt-6.1-sol', reasoning: 'medium', theme: 'dark', density: 'comfortable', autoMemory: true, timestamps: false, customInstructions: ''
};
const stored = (k, fallback) => { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : fallback; } catch { return fallback; } };
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));

let settings = {...defaults, ...stored('rb_settings', {})};
let memory = stored('rb_memory', [
  'Main Roblox project: Insect Home.',
  'Strong preference for complete, working Roblox Luau scripts instead of snippets.',
  'Prefer workspace-only or script-generated builds when practical; avoid unnecessary manual Studio setup.',
  'Prefer few or no comments in generated scripts unless a comment prevents a real mistake.',
  'Keep instructions iPad/mobile-friendly when possible.',
  'Match my energy naturally: casual, funny, dramatic, and emoji-heavy when I am writing that way.'
]);
let styleExamples = stored('rb_style_examples', []);
let chats = stored('rb_chats', []);
let currentId = stored('rb_current_chat', null);
let mode = stored('rb_mode', 'chat');
let attached = [];
let sending = false;

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function currentChat(){ return chats.find(c=>c.id===currentId); }
function persist(){ save('rb_settings',settings); save('rb_memory',memory); save('rb_style_examples',styleExamples); save('rb_chats',chats); save('rb_current_chat',currentId); save('rb_mode',mode); }
function ensureChat(){ if(!currentId || !currentChat()){ const c={id:uid(),title:'New chat',messages:[],updated:Date.now()}; chats.unshift(c); currentId=c.id; persist(); } }
function renderChatList(){ const el=$('#chatList'); el.innerHTML=''; chats.sort((a,b)=>b.updated-a.updated).slice(0,50).forEach(c=>{ const b=document.createElement('button'); b.className='chat-item '+(c.id===currentId?'active':''); b.textContent=c.title||'New chat'; b.onclick=()=>{currentId=c.id; persist(); renderAll(); if(innerWidth<=760) $('#sidebar').classList.remove('open');}; el.appendChild(b); }); }
function textFromMessage(m){ return (m.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n'); }
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function codeLangExt(lang){ const map={lua:'lua',luau:'luau',javascript:'js',js:'js',typescript:'ts',ts:'ts',json:'json',html:'html',css:'css',bash:'sh',shell:'sh',markdown:'md',md:'md',text:'txt',txt:'txt',python:'py'}; return map[lang?.toLowerCase()]||'txt'; }
function parseSegments(text){
  const segments=[]; const re=/```([\w+-]*)?(?:\s+filename=([^\s`]+))?\n([\s\S]*?)```/g; let last=0,m;
  while((m=re.exec(text))){ if(m.index>last) segments.push({type:'text',text:text.slice(last,m.index)}); segments.push({type:'code',lang:m[1]||'text',filename:m[2]||'',text:m[3].replace(/\n$/,'')}); last=re.lastIndex; }
  if(last<text.length) segments.push({type:'text',text:text.slice(last)}); return segments;
}
function inlineMarkdown(t){ let x=escapeHtml(t); x=x.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>'); x=x.replace(/`([^`]+)`/g,'<code>$1</code>'); x=x.replace(/\n/g,'<br>'); return x; }
function renderMessage(m, idx){
  const wrap=document.createElement('div'); wrap.className='message '+m.role;
  const av=document.createElement('div'); av.className='msg-avatar'; av.textContent=m.role==='user'?'U':'RB';
  const bubble=document.createElement('div'); bubble.className='bubble';
  const copy=document.createElement('div'); copy.className='message-copy';
  if(m.files?.length){ m.files.forEach(f=>{ if(f.type.startsWith('image/')){ const img=document.createElement('img'); img.src=f.url; img.alt=f.name; img.style='max-width:320px;max-height:240px;border-radius:10px;margin-bottom:8px;display:block'; copy.appendChild(img);} }); }
  parseSegments(textFromMessage(m)).forEach(seg=>{
    if(seg.type==='text'){ const p=document.createElement('div'); p.innerHTML=inlineMarkdown(seg.text); copy.appendChild(p); }
    else { const cw=document.createElement('div'); cw.className='code-wrap'; const head=document.createElement('div'); head.className='code-head'; const label=document.createElement('span'); label.textContent=seg.filename||seg.lang.toUpperCase(); const acts=document.createElement('div'); acts.className='code-actions'; const copyBtn=document.createElement('button'); copyBtn.className='mini-btn'; copyBtn.textContent='Copy'; copyBtn.onclick=()=>navigator.clipboard.writeText(seg.text); const saveBtn=document.createElement('button'); saveBtn.className='mini-btn'; saveBtn.textContent='Save'; saveBtn.onclick=()=>downloadFile(seg.filename||('code.'+codeLangExt(seg.lang)),seg.text); acts.append(copyBtn,saveBtn); head.append(label,acts); const pre=document.createElement('pre'); pre.textContent=seg.text; cw.append(head,pre); copy.appendChild(cw); }
  });
  if(settings.timestamps && m.ts){ const time=document.createElement('div'); time.style='font-size:10px;color:#6b7280;margin-top:6px'; time.textContent=new Date(m.ts).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}); copy.appendChild(time); }
  bubble.appendChild(copy); wrap.append(av,bubble); return wrap;
}
function renderMessages(){ ensureChat(); const el=$('#messages'); el.innerHTML=''; const c=currentChat(); $('#welcome').style.display=c.messages.length?'none':''; c.messages.forEach((m,i)=>el.appendChild(renderMessage(m,i))); el.scrollTop=el.scrollHeight; }
function renderAll(){renderChatList();renderMessages();renderMode();renderMemoryList();applyTheme();}
function renderMode(){ $$('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode)); $('#modeHint').textContent=mode==='code'?'Code mode · Roblox + Luau focused':'Chat mode · natural + helpful'; $('#input').placeholder=mode==='code'?'Describe what you want built, fixed, or debugged…':'Message Roblox Brain…'; }
function setStatus(text,active=false){ $('#statusText').textContent=text; $('.dot').style.background=active?'#f59e0b':'#33d17a'; }
function autoResize(){const x=$('#input');x.style.height='auto';x.style.height=Math.min(x.scrollHeight,180)+'px';}
function applyTheme(){ let t=settings.theme; if(t==='system') t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'; document.body.classList.toggle('light',t==='light'); document.body.classList.toggle('compact',settings.density==='compact'); }
function openModal(id){ $('#modalBackdrop').hidden=false; $(id).hidden=false; }
function closeModals(){ $('#modalBackdrop').hidden=true; ['#settingsModal','#memoryModal'].forEach(x=>$(x).hidden=true); }
function renderMemoryList(){ const el=$('#memoryList'); el.innerHTML=''; memory.forEach((m,i)=>{const row=document.createElement('div');row.className='memory-row';const s=document.createElement('span');s.textContent=m;const b=document.createElement('button');b.textContent='×';b.onclick=()=>{memory.splice(i,1);persist();renderMemoryList()};row.append(s,b);el.appendChild(row);}); if(!memory.length) el.innerHTML='<div style="color:#70798a;font-size:12px;padding:10px">No memories yet.</div>'; }
function downloadFile(name,text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})); a.download=name.replace(/[^\w.\-\/]+/g,'_').split('/').pop()||'code.txt'; document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function captureStyle(text){ if(!settings.autoMemory) return; const t=text.trim(); if(!t) return; const hasEmoji=/[😭☠️👁️🔥😂💀]/u.test(t), hasSlang=/\b(bro|dude|got|manslaughtered|glaze|trash|crazy|nah|fr|lmao|lol|wtf)\b/i.test(t); if(hasEmoji||hasSlang){ const sample=t.slice(0,300); if(!styleExamples.includes(sample)){styleExamples.push(sample); styleExamples=styleExamples.slice(-10); persist();} if((hasEmoji&&hasSlang)&&!memory.some(x=>/energetic/i.test(x))){memory.push('Communication style: energetic, casual, dramatic humor with slang and emojis when appropriate.');persist();} } }
function makeTitle(text){const clean=text.replace(/\s+/g,' ').trim(); return clean.length>32?clean.slice(0,32)+'…':(clean||'New chat');}
function addUserMessage(text){const c=currentChat(); const m={id:uid(),role:'user',content:[{type:'text',text}],ts:Date.now(),files:attached.map(f=>({name:f.name,type:f.type,url:f.url}))}; c.messages.push(m); c.updated=Date.now(); if(c.title==='New chat') c.title=makeTitle(text); captureStyle(text); persist(); return m;}
function contentForApi(m){ if(m.files?.some(f=>f.type.startsWith('image/'))){ const parts=[]; if(textFromMessage(m)) parts.push({type:'text',text:textFromMessage(m)}); m.files.filter(f=>f.type.startsWith('image/')).forEach(f=>parts.push({type:'image_url',image_url:{url:f.url}})); return {role:m.role,content:parts}; } return {role:m.role,content:textFromMessage(m)}; }
async function send(){ if(sending) return; const text=$('#input').value.trim(); if(!text && !attached.length) return; ensureChat(); sending=true; $('#sendBtn').disabled=true; setStatus('Thinking…',true); $('#typing').classList.add('show'); const c=currentChat(); addUserMessage(text); const history=c.messages.map(contentForApi); $('#input').value='';autoResize(); clearAttachments();renderMessages();
  try{ const resp=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:settings.model,reasoning:settings.reasoning,mode,memory,styleExamples,settings,messages:history})}); if(!resp.ok){const e=await resp.text();throw new Error(e||`HTTP ${resp.status}`)} const reader=resp.body.getReader(); const decoder=new TextDecoder(); let buf=''; let answer=''; while(true){const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true}); const lines=buf.split(/\r?\n/);buf=lines.pop()||''; for(const line of lines){if(!line.startsWith('data:'))continue;const payload=line.slice(5).trim();if(!payload||payload==='[DONE]')continue;try{const j=JSON.parse(payload);const delta=j.choices?.[0]?.delta?.content;if(delta){answer+=delta;upsertAssistant(answer)}}catch{} }}
    const last=c.messages[c.messages.length-1]; if(last && last.role==='assistant'){last.content=[{type:'text',text:answer}]; last.ts=Date.now(); last.streaming=false;} else { c.messages.push({id:uid(),role:'assistant',content:[{type:'text',text:answer}],ts:Date.now()}); } c.updated=Date.now(); persist(); renderMessages();
  }catch(err){const msg=err?.message||String(err); const assistant={id:uid(),role:'assistant',content:[{type:'text',text:`I couldn't reach the model.\n\n
g> ${msg}`}],ts:Date.now()}; c.messages.push(assistant); persist(); renderMessages();}
  finally{sending=false; $('#sendBtn').disabled=false;$('#typing').classList.remove('show');setStatus('Ready',false);}
}
function upsertAssistant(text){const c=currentChat();let last=c.messages[c.messages.length-1];if(!last||last.role!=='assistant'){last={id:uid(),role:'assistant',content:[{type:'text',text}],ts:Date.now(),streaming:true};c.messages.push(last);}else last.content=[{type:'text',text}]; renderMessages(); }
function clearAttachments(){attached=[];renderAttachments();}
function renderAttachments(){const el=$('#attachmentStrip');el.innerHTML='';attached.forEach((f,i)=>{const a=document.createElement('div');a.className='attachment';if(f.type.startsWith('image/')){const img=document.createElement('img');img.src=f.url;a.appendChild(img);}const s=document.createElement('span');s.textContent=f.name;a.appendChild(s);const b=document.createElement('button');b.className='remove-attachment';b.textContent='×';b.onclick=()=>{attached.splice(i,1);renderAttachments()};a.appendChild(b);el.appendChild(a);});}

$('#composer').onsubmit=e=>{e.preventDefault();send()};$('#input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});$('#input').addEventListener('input',autoResize);
$('#fileInput').addEventListener('change',async e=>{for(const file of [...(e.target.files||[])]){if(file.size>6*1024*1024){alert(`${file.name} is over 6 MB.`);continue;} const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)}); attached.push({name:file.name,type:file.type||'text/plain',url});} e.target.value='';renderAttachments();});
$$('.mode-btn').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;persist();renderMode();});
$$('.quick-card').forEach(b=>b.onclick=()=>{$('#input').value=b.dataset.prompt;autoResize();$('#input').focus();});
$('#newChat').onclick=()=>{const c={id:uid(),title:'New chat',messages:[],updated:Date.now()};chats.unshift(c);currentId=c.id;persist();renderAll()};
$('#clearChat').onclick=()=>{const c=currentChat();if(c){c.messages=[];c.title='New chat';c.updated=Date.now();persist();renderAll()}};
$('#memoryBtn').onclick=()=>openModal('#memoryModal');$('#memoryTop').onclick=()=>openModal('#memoryModal');$('#settingsBtn').onclick=()=>openModal('#settingsModal');$('#modalBackdrop').onclick=closeModals;$$('.close-modal').forEach(b=>b.onclick=closeModals);
$('#addMemory').onclick=()=>{const v=$('#memoryInput').value.trim();if(v){memory.push(v);persist();$('#memoryInput').value='';renderMemoryList()}};
$('#clearMemory').onclick=()=>{if(confirm('Clear all saved memory?')){memory=[];styleExamples=[];persist();renderMemoryList()}};
$('#exportMemory').onclick=()=>downloadFile('roblox-brain-memory.json',JSON.stringify({memory,styleExamples},null,2));
$('#modelSelect').onchange=e=>{settings.model=e.target.value;persist()};$('#reasoningSelect').onchange=e=>{settings.reasoning=e.target.value;persist()};$('#themeSelect').onchange=e=>{settings.theme=e.target.value;persist();applyTheme()};$('#densitySelect').onchange=e=>{settings.density=e.target.value;persist();applyTheme()};$('#autoMemory').onchange=e=>{settings.autoMemory=e.target.checked;persist()};$('#timestamps').onchange=e=>{settings.timestamps=e.target.checked;persist();renderMessages()};$('#customInstructions').onchange=e=>{settings.customInstructions=e.target.value;persist()};
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
function syncSettingsUI(){ $('#modelSelect').value=settings.model;$('#reasoningSelect').value=settings.reasoning;$('#themeSelect').value=settings.theme;$('#densitySelect').value=settings.density;$('#autoMemory').checked=settings.autoMemory;$('#timestamps').checked=settings.timestamps;$('#customInstructions').value=settings.customInstructions; }
ensureChat();syncSettingsUI();renderAll();
