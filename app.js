const defaults={"Chest":["Bench Press","Incline Dumbbell Press","Chest Press","Cable Fly"],"Back":["Lat Pulldown","Seated Cable Row","Chest Supported Row","One Arm Dumbbell Row"],"Shoulders":["Shoulder Press","Lateral Raise","Rear Delt Fly"],"Biceps":["Barbell Curl","Dumbbell Curl","Hammer Curl"],"Triceps":["Cable Pushdown","Overhead Extension","Skull Crusher"],"Legs":["Leg Press","Leg Extension","Leg Curl","Romanian Deadlift","Calf Raise"],"Abs":["Cable Crunch","Leg Raise","Plank"]};
const GROUP_COLORS={Chest:'#d9734e',Back:'#2a9d8f',Shoulders:'#e0a336',Biceps:'#3fb56b',Triceps:'#7a9e3f',Legs:'#6a7fa0',Abs:'#c98b6b'};
const EXTRA_COLORS=['#b5835a','#3e8e7e','#9aa84a','#a0522d','#6f8f72'];
const DAY_LETTERS=['Δ','Τ','Τ','Π','Π','Σ','Κ'];

function load(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
let exercises=load('wt_exercises',null),logs=load('wt_logs',[]);
if(!exercises||typeof exercises!=='object'||Array.isArray(exercises))exercises=defaults;
if(!Array.isArray(logs))logs=[];
let weights=load('wt_weight',{});   // {"2026-10-02": 82.4} — one weigh-in per day
if(!weights||typeof weights!=='object'||Array.isArray(weights))weights={};
let water=load('wt_water',{});   // {"2026-10-02":[{t:1759400000000,ml:250},…]} — each drink, so any one can be undone
if(!water||typeof water!=='object'||Array.isArray(water))water={};
let steps=load('wt_steps',{});   // {"2026-09-28": 8234} — daily totals from Apple Health or typed in
if(!steps||typeof steps!=='object'||Array.isArray(steps))steps={};
let settings={goalWorkouts:4,goalSets:60,goalSteps:8000,goalWater:2500,weightGoal:null,weightGoalSetAt:null,weightGoalStart:null,lastExport:0,stepsSyncedAt:0,stepsShortcut:false,stepsLastClip:0,...load('wt_settings',{})};
let editingId=null,historyFilter='all',historyLimit=15,chartExercise=null,chartMetric='kg';
const sessionOpen=new Map();   // workout key → open/closed the user picked; otherwise only the latest is open

const $=s=>document.querySelector(s),group=$('#group'),exercise=$('#exercise'),sets=$('#sets'),date=$('#date');

/* ───── helpers ───── */
const pad=n=>String(n).padStart(2,'0');
const dayKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>dayKey(new Date());
const parseDay=s=>new Date(s+'T12:00:00');
const addDays=(s,n)=>{const d=parseDay(s);d.setDate(d.getDate()+n);return dayKey(d)};
const weekStart=s=>addDays(s,-((parseDay(s).getDay()+6)%7));
const formatDate=d=>parseDay(d).toLocaleDateString('el-GR');
const shortDate=d=>parseDay(d).toLocaleDateString('el-GR',{day:'numeric',month:'short'});
const byNewest=(a,b)=>b.date.localeCompare(a.date)||(b.created||0)-(a.created||0);
const byOldest=(a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0);
const clamp=(v,min,max,d)=>Number.isFinite(v)&&v>0?Math.min(max,Math.max(min,Math.round(v))):d;
const groupColor=g=>GROUP_COLORS[g]||EXTRA_COLORS[[...g].reduce((a,c)=>a+c.charCodeAt(0),0)%EXTRA_COLORS.length];

function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmt(n){return String(Number(n.toFixed(2)))}

function persist(){
  try{
    localStorage.setItem('wt_exercises',JSON.stringify(exercises));
    localStorage.setItem('wt_logs',JSON.stringify(logs));
    localStorage.setItem('wt_settings',JSON.stringify(settings));
    localStorage.setItem('wt_steps',JSON.stringify(steps));
    localStorage.setItem('wt_water',JSON.stringify(water));
    localStorage.setItem('wt_weight',JSON.stringify(weights));
  }catch{toast('⚠️ Δεν αποθηκεύτηκε — ίσως γέμισε ο χώρος. Κάνε Export.')}
}

/* ───── metrics ───── */
const topKg=l=>Math.max(...l.sets.map(s=>s.kg));
const isWeighted=l=>topKg(l)>0;
const score=l=>isWeighted(l)?topKg(l):Math.max(...l.sets.map(s=>s.reps));   // bodyweight moves are compared by reps
const unit=l=>isWeighted(l)?'kg':'reps';
const topIndex=l=>l.sets.findIndex(s=>isWeighted(l)?s.kg===topKg(l):s.reps===score(l));
const e1rm=s=>s.reps===1?s.kg:s.kg*(1+s.reps/30);   // Epley
const bestE1rm=l=>Math.max(...l.sets.map(e1rm));
const volume=l=>isWeighted(l)?l.sets.reduce((a,s)=>a+s.kg*s.reps,0):l.sets.reduce((a,s)=>a+s.reps,0);
const setText=s=>s.kg>0?`${fmt(s.kg)}kg × ${s.reps}`:`${s.reps} reps`;
const lastOf=ex=>logs.filter(x=>x.exercise===ex&&x.id!==editingId).sort(byNewest)[0];

/* Sector-style status: compares the top set (kg) of each session with the previous
   session of the same exercise, and with the best of all earlier sessions.
   record = new all-time best (purple), up = higher than last time (green),
   down = lower than last time (yellow), same/first = neutral. */
function computeStatuses(){
  const result=new Map(),state={};
  [...logs].sort(byOldest).forEach(l=>{
    const top=score(l);
    const st=state[l.exercise]||(state[l.exercise]={prev:null,best:null});
    let cls='first',delta=0;
    if(st.prev!==null){
      delta=top-st.prev;
      if(top>st.best)cls='record';
      else if(top>st.prev)cls='up';
      else if(top<st.prev)cls='down';
      else cls='same';
    }
    result.set(l.id,{cls,delta,top,unit:unit(l),idx:topIndex(l)});
    st.prev=top;st.best=st.best===null?top:Math.max(st.best,top);
  });
  return result;
}
function badgeText(s){
  switch(s.cls){
    case'record':return`🏆 Record +${fmt(s.delta)}${s.unit}`;
    case'up':return`▲ +${fmt(s.delta)}${s.unit}`;
    case'down':return`▼ −${fmt(Math.abs(s.delta))}${s.unit}`;
    case'same':return`= Ίδια ${s.unit==='kg'?'κιλά':'reps'}`;
    default:return'Πρώτη καταγραφή';
  }
}

/* ───── toast, confetti ───── */
let toastTimer;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800)}
function confetti(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const box=document.createElement('div'),colors=Object.values(GROUP_COLORS);box.className='confetti';
  for(let i=0;i<40;i++){
    const p=document.createElement('i');
    p.style.cssText=`--x:${Math.random()*100}vw;--dx:${(Math.random()-.5)*40}vw;--r:${Math.random()*720-360}deg;--d:${1.1+Math.random()*.9}s;--dl:${Math.random()*.3}s;background:${colors[i%colors.length]}`;
    box.appendChild(p);
  }
  document.body.appendChild(box);setTimeout(()=>box.remove(),2500);
}

/* ───── log form ───── */
function fillGroups(keep){
  group.innerHTML=Object.keys(exercises).map(g=>`<option>${escapeHtml(g)}</option>`).join('');
  if(keep)group.value=keep;
  fillExercises();
}
function fillExercises(keep){
  exercise.innerHTML=(exercises[group.value]||[]).map(x=>`<option>${escapeHtml(x)}</option>`).join('');
  if(keep)exercise.value=keep;
  $('#logCard').style.setProperty('--c',groupColor(group.value));
  onExerciseChange();
}
function onExerciseChange(){
  showLast();
  const empty=[...sets.querySelectorAll('input')].every(i=>!i.value);
  if(empty&&!editingId)resetSets(Math.min(8,Math.max(3,lastOf(exercise.value)?.sets.length||0)));
  else placeholders();
  updateLiveStatus();
}
function addSet(kg='',reps=''){
  const n=sets.children.length+1;
  sets.insertAdjacentHTML('beforeend',`<tr><td><span class="setNum">${n}</span></td><td><div class="stepperField"><button type="button" class="stepBtn minus" data-f="kg" aria-label="Λιγότερα κιλά">−</button><input class="setInput kg" inputmode="decimal" type="number" step="0.5" min="0" value="${kg}"><button type="button" class="stepBtn plus" data-f="kg" aria-label="Περισσότερα κιλά">+</button></div></td><td><div class="stepperField"><button type="button" class="stepBtn minus" data-f="reps" aria-label="Λιγότερα reps">−</button><input class="setInput reps" inputmode="numeric" type="number" min="0" value="${reps}"><button type="button" class="stepBtn plus" data-f="reps" aria-label="Περισσότερα reps">+</button></div></td><td><button class="remove" aria-label="Αφαίρεση set">✕</button></td></tr>`);
  placeholders();
  updateLiveStatus();
}
function resetSets(n=3){sets.innerHTML='';for(let i=0;i<n;i++)addSet()}
function renumber(){[...sets.children].forEach((r,i)=>{const num=r.querySelector('.setNum');num.textContent=i+1;num.classList.remove('rec','pop');delete num.dataset.rec})}
// faint numbers from the last session, so you know what to beat
function placeholders(){
  const l=lastOf(exercise.value);
  [...sets.children].forEach((r,i)=>{
    const p=l&&(l.sets[i]||l.sets[l.sets.length-1]);
    r.querySelector('.kg').placeholder=p?fmt(p.kg):'–';
    r.querySelector('.reps').placeholder=p?p.reps:'–';
  });
}
function hintFor(l){
  if(!isWeighted(l))return'Στόχος: +1 rep σε κάθε set σε σχέση με την τελευταία φορά.';
  if(l.sets.every(s=>s.reps>=10))return`Έκανες 10+ reps σε όλα τα sets — δοκίμασε ${fmt(topKg(l)+2.5)}kg στο top set.`;
  return'Στόχος: ίδια κιλά με +1 rep σε κάποιο set, ή ανέβασε 2.5kg αν ήταν εύκολο.';
}
function showLast(){
  const l=lastOf(exercise.value);
  $('#lastText').innerHTML=l
    ?`<b>Τελευταία φορά</b> · ${formatDate(l.date)}<div class="lastSets">${l.sets.map((s,i)=>`<span class="pill"><small>S${i+1}</small>${setText(s)}</span>`).join('')}</div>`
    :'Δεν υπάρχει προηγούμενη καταγραφή.';
  $('#hint').hidden=!l;if(l)$('#hint').textContent='💡 '+hintFor(l);
  $('#copyLastBtn').hidden=!l;
}

function startEdit(id){
  const l=logs.find(x=>String(x.id)===id);if(!l)return;
  editingId=l.id;
  if(!exercises[l.group])exercises[l.group]=[];
  if(!exercises[l.group].includes(l.exercise))exercises[l.group].push(l.exercise);
  date.value=l.date;
  fillGroups(l.group);fillExercises(l.exercise);
  sets.innerHTML='';l.sets.forEach(s=>addSet(s.kg>0?s.kg:'',s.reps));
  $('#notes').value=l.notes||'';
  $('#editBanner').hidden=false;$('#saveBtn').textContent='Ενημέρωση καταγραφής';
  switchTab('log');
}
function stopEditing(){
  editingId=null;$('#editBanner').hidden=true;$('#saveBtn').textContent='Αποθήκευση προπόνησης';
}
function resetForm(){
  stopEditing();$('#notes').value='';showLast();
  resetSets(Math.min(8,Math.max(3,lastOf(exercise.value)?.sets.length||0)));
}

group.onchange=()=>fillExercises();
exercise.onchange=onExerciseChange;
// "+ Set" copies the last row that actually has numbers in it, so you keep typing the same weight/reps
$('#addSetBtn').onclick=()=>{
  const rows=[...sets.querySelectorAll('tr')];
  let src=null;
  for(let i=rows.length-1;i>=0;i--){
    const kg=rows[i].querySelector('.kg').value,reps=rows[i].querySelector('.reps').value;
    if(kg||reps){src={kg,reps};break}
  }
  addSet(src?.kg||'',src?.reps||'');
};
$('#removeSetBtn').onclick=()=>{if(sets.children.length>1){sets.lastElementChild.remove();renumber();updateLiveStatus()}};
sets.onclick=e=>{if(e.target.classList.contains('remove')){e.target.closest('tr').remove();renumber();updateLiveStatus()}};
sets.addEventListener('input',updateLiveStatus);
$('#copyLastBtn').onclick=()=>{const l=lastOf(exercise.value);if(!l)return;sets.innerHTML='';l.sets.forEach(s=>addSet(s.kg>0?s.kg:'',s.reps))};
$('#cancelEditBtn').onclick=resetForm;

/* ───── steppers: tap ±2.5kg / ±1 rep, hold to repeat fast ───── */
let stepTimer=null,stepInterval=null;
function clearStepTimers(){clearTimeout(stepTimer);clearInterval(stepInterval);stepTimer=stepInterval=null}
function bumpInput(input,delta){
  // empty field starts from the ghost (previous session) value, not from 0
  const base=input.value!==''?Number(input.value):(Number(input.placeholder)||0);
  let val=Math.max(0,base+delta);
  val=input.classList.contains('kg')?Math.round(val*2)/2:Math.round(val);
  input.value=fmt(val);
  input.dispatchEvent(new Event('input',{bubbles:true}));
}
sets.addEventListener('pointerdown',e=>{
  const btn=e.target.closest('.stepBtn');if(!btn)return;
  e.preventDefault();
  const row=btn.closest('tr'),input=row.querySelector('.'+btn.dataset.f);
  const dir=btn.classList.contains('plus')?1:-1,step=btn.dataset.f==='kg'?2.5:1;
  const apply=()=>bumpInput(input,dir*step);
  apply();clearStepTimers();
  stepTimer=setTimeout(()=>{stepInterval=setInterval(apply,90)},450);
});
document.addEventListener('pointerup',clearStepTimers);
document.addEventListener('pointercancel',clearStepTimers);

/* ───── live record feedback: colours the box under Sets as you type ───── */
function liveBadgeText(s){
  const suffix=s.cls==='record'?'':` · record ${fmt(s.best)}${s.unit}`;
  switch(s.cls){
    case'record':return`🏆 Νέο record · +${fmt(s.delta)}${s.unit}`;
    case'up':return`▲ Πάνω · +${fmt(s.delta)}${s.unit}${suffix}`;
    case'down':return`▼ Κάτω · −${fmt(Math.abs(s.delta))}${s.unit}${suffix}`;
    default:return`= Ίδια ${s.unit==='kg'?'κιλά':'reps'}${suffix}`;
  }
}
function markRecordRow(idx){
  [...sets.children].forEach((r,i)=>{
    const num=r.querySelector('.setNum');
    if(i===idx){
      num.textContent='✓';num.classList.add('rec');
      if(num.dataset.rec!=='on'){num.classList.remove('pop');void num.offsetWidth;num.classList.add('pop');num.dataset.rec='on'}
    }else{
      num.textContent=i+1;num.classList.remove('rec','pop');delete num.dataset.rec;
    }
  });
}
function updateLiveStatus(){
  const box=$('#liveStatus');
  const relevant=logs.filter(x=>x.exercise===exercise.value&&x.id!==editingId);
  const filled=[...sets.querySelectorAll('tr')].map((r,i)=>({i,kg:Number(r.querySelector('.kg').value)||0,reps:Number(r.querySelector('.reps').value)||0})).filter(v=>v.reps>0);
  if(!relevant.length||!filled.length){box.hidden=true;renumber();return}
  const prevEntry=relevant.slice().sort(byNewest)[0];
  const weighted=isWeighted(prevEntry),unitStr=weighted?'kg':'reps',valOf=v=>weighted?v.kg:v.reps;
  let top=filled[0],topVal=valOf(top);
  filled.forEach(v=>{const val=valOf(v);if(val>topVal){top=v;topVal=val}});
  const prevTop=score(prevEntry),best=Math.max(...relevant.map(score));
  let cls='same';
  if(topVal>best)cls='record';else if(topVal>prevTop)cls='up';else if(topVal<prevTop)cls='down';
  box.hidden=false;box.className='liveStatus '+cls;
  box.textContent=liveBadgeText({cls,delta:topVal-prevTop,best,unit:unitStr});
  markRecordRow(cls==='record'?top.i:-1);
}

$('#saveBtn').onclick=()=>{
  if(!exercise.value)return alert('Πρόσθεσε πρώτα μια άσκηση.');
  const data=[...sets.querySelectorAll('tr')].map(r=>({kg:Number(r.querySelector('.kg').value),reps:Number(r.querySelector('.reps').value)})).filter(s=>s.kg>=0&&s.reps>0);
  if(!data.length)return alert('Βάλε τουλάχιστον ένα set με επαναλήψεις.');
  const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),created:Date.now(),date:date.value||today(),group:group.value,exercise:exercise.value,sets:data,notes:$('#notes').value.trim()};
  const i=editingId?logs.findIndex(x=>x.id===editingId):-1;
  if(i>=0){entry.id=logs[i].id;entry.created=logs[i].created;logs[i]=entry}else logs.push(entry);
  persist();
  const st=computeStatuses().get(entry.id);
  const wasEdit=i>=0;
  resetForm();renderHistory();checkBackup();
  if(st.cls==='record'){confetti();navigator.vibrate?.([40,60,40,60,120]);toast(`${badgeText(st)} · ${entry.exercise}`)}
  else toast(wasEdit?'✅ Ενημερώθηκε':`✅ Αποθηκεύτηκε · ${badgeText(st)}`);
};

/* exercise list management */
const exDlg=$('#exerciseDialog');
$('#addExerciseBtn').onclick=()=>{$('#newExercise').value='';exDlg.showModal()};
$('#cancelExercise').onclick=()=>exDlg.close();
$('#exerciseForm').onsubmit=e=>{
  e.preventDefault();
  const n=$('#newExercise').value.trim();if(!n)return;
  if(!exercises[group.value])exercises[group.value]=[];
  if(!exercises[group.value].includes(n))exercises[group.value].push(n);
  persist();fillExercises(n);exDlg.close();
};
$('#removeExerciseBtn').onclick=()=>{
  const ex=exercise.value;if(!ex)return;
  if(!confirm(`Να αφαιρεθεί η άσκηση "${ex}" από τη λίστα; Οι καταγραφές της μένουν στο ιστορικό.`))return;
  exercises[group.value]=exercises[group.value].filter(x=>x!==ex);persist();fillExercises();
};

/* ───── rest timer ───── */
let timerEnd=0,timerTotal=0,timerInt=null,audioCtx=null;
function startTimer(sec){
  try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume()}catch{}   // unlocked by this tap, so the beep can play later
  timerTotal=sec;timerEnd=Date.now()+sec*1000;
  clearInterval(timerInt);timerInt=setInterval(tickTimer,250);
  $('#timerPill').hidden=false;tickTimer();
}
function stopTimer(){clearInterval(timerInt);timerInt=null;timerEnd=0;$('#timerPill').hidden=true}
function tickTimer(){
  if(!timerEnd)return;
  const left=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));
  $('#timerLeft').textContent=`${Math.floor(left/60)}:${pad(left%60)}`;
  $('#timerBar').style.width=`${Math.max(0,Math.min(100,left/timerTotal*100))}%`;
  if(!left){stopTimer();navigator.vibrate?.([250,120,250]);beep();toast('⏱ Τέλος ξεκούρασης — επόμενο set!')}
}
function beep(){
  if(!audioCtx)return;
  [0,.3,.6].forEach(t=>{
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.frequency.value=880;g.gain.value=.15;o.connect(g);g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime+t);o.stop(audioCtx.currentTime+t+.18);
  });
}
document.querySelectorAll('.timerChip').forEach(b=>b.onclick=()=>startTimer(Number(b.dataset.sec)));
$('#timerStop').onclick=stopTimer;
$('#timerPlus').onclick=()=>{timerEnd+=30000;timerTotal+=30;tickTimer()};

/* ───── history ───── */
function renderFilters(){
  $('#filters').innerHTML=['all',...Object.keys(exercises)].map(g=>`<button class="chip${historyFilter===g?' on':''}" data-g="${escapeHtml(g)}" style="--c:${g==='all'?'var(--brand)':groupColor(g)}">${g==='all'?'Όλα':escapeHtml(g)}</button>`).join('');
}
function historyItemHtml(x,s){
  const id=escapeHtml(x.id);
  return`<div class="historyItem ${s.cls}"><div class="historyTop"><div><div class="historyTitle">${escapeHtml(x.exercise)}</div>${isWeighted(x)?`<div class="historyMeta">Όγκος ${fmt(volume(x))}kg</div>`:''}<span class="badge">${badgeText(s)}</span></div><div class="itemBtns"><button class="remove" data-act="edit" data-id="${id}" aria-label="Επεξεργασία">✎</button><button class="remove" data-act="del" data-id="${id}" aria-label="Διαγραφή">✕</button></div></div><div class="historySets">${x.sets.map((t,i)=>`<span class="pill${i===s.idx?' top':''}"><small>S${i+1}</small>${setText(t)}</span>`).join('')}</div>${x.notes?`<div class="historyNotes">📝 ${escapeHtml(x.notes)}</div>`:''}</div>`;
}
// one box per workout = same day + same muscle group, exercises in the order they were logged
function sessionHtml(items,status,isLatest){
  const {date:d,group:g}=items[0],key=d+'|'+g,open=sessionOpen.get(key)??isLatest;
  const sameYear=d.slice(0,4)===today().slice(0,4);
  const day=parseDay(d).toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long',...(sameYear?{}:{year:'numeric'})});
  const setsN=items.reduce((a,x)=>a+x.sets.length,0);
  const vol=items.filter(isWeighted).reduce((a,x)=>a+volume(x),0);
  const recs=items.filter(x=>status.get(x.id).cls==='record').length;
  const meta=[`${items.length} ${items.length===1?'άσκηση':'ασκήσεις'}`,`${setsN} sets`];
  if(vol)meta.push(`Όγκος ${vol>=1000?`${fmt(vol/1000)}t`:`${fmt(vol)}kg`}`);
  return`<section class="session${open?'':' closed'}" style="--c:${groupColor(g)}" data-key="${escapeHtml(key)}"><div class="sessionHead"><div><div class="sessionTitle"><i class="gdot"></i>${escapeHtml(g)}</div><div class="sessionDay">${day}</div><div class="sessionMeta">${meta.join(' · ')}</div></div><div class="sessionSide">${recs?`<span class="sessionRec">🏆 ${recs}</span>`:''}<button type="button" class="chev" aria-expanded="${open}" aria-label="${open?'Κλείσιμο':'Άνοιγμα'} προπόνησης"></button></div></div><div class="sessionBody"><div class="sessionInner">${items.map(x=>historyItemHtml(x,status.get(x.id))).join('')}</div></div></section>`;
}
function renderHistory(){
  renderFilters();
  const status=computeStatuses(),byKey=new Map();
  logs.filter(x=>historyFilter==='all'||x.group===historyFilter).forEach(l=>{
    const k=l.date+'|'+l.group;
    if(!byKey.has(k))byKey.set(k,[]);
    byKey.get(k).push(l);
  });
  const sessions=[...byKey.values()].map(a=>a.sort(byOldest)).sort((a,b)=>byNewest(a[a.length-1],b[b.length-1]));
  const shown=sessions.slice(0,historyLimit);
  $('#history').innerHTML=shown.length?shown.map((a,i)=>sessionHtml(a,status,i===0)).join(''):'<div class="empty">Καμία καταγραφή εδώ ακόμα.</div>';
  $('#moreBtn').hidden=sessions.length<=historyLimit;
}
$('#filters').onclick=e=>{const b=e.target.closest('[data-g]');if(!b)return;historyFilter=b.dataset.g;historyLimit=15;renderHistory()};
$('#moreBtn').onclick=()=>{historyLimit+=15;renderHistory()};
function toggleSession(sec){
  const open=sec.classList.toggle('closed')===false,btn=sec.querySelector('.chev');
  sessionOpen.set(sec.dataset.key,open);
  btn.setAttribute('aria-expanded',open);btn.setAttribute('aria-label',`${open?'Κλείσιμο':'Άνοιγμα'} προπόνησης`);
}
$('#history').onclick=e=>{
  const head=e.target.closest('.sessionHead');
  if(head)return toggleSession(head.closest('.session'));
  const b=e.target.closest('[data-act]');if(!b)return;
  if(b.dataset.act==='edit')return startEdit(b.dataset.id);
  if(!confirm('Διαγραφή αυτής της καταγραφής;'))return;
  logs=logs.filter(x=>String(x.id)!==b.dataset.id);
  if(String(editingId)===b.dataset.id)resetForm();
  persist();showLast();renderHistory();
};

/* ───── stats ───── */
function weekData(offset=0){
  const start=addDays(weekStart(today()),offset*7),end=addDays(start,6);
  const ls=logs.filter(l=>l.date>=start&&l.date<=end);
  return{start,ls,days:new Set(ls.map(l=>l.date)),sets:ls.reduce((a,l)=>a+l.sets.length,0),groups:new Set(ls.map(l=>l.group))};
}
function weeklyStreak(){
  const per={};
  logs.forEach(l=>{const w=weekStart(l.date);(per[w]||(per[w]=new Set())).add(l.date)});
  const met=w=>(per[w]?.size||0)>=settings.goalWorkouts;
  let w=weekStart(today()),n=0;
  if(!met(w))w=addDays(w,-7);   // current week is still in progress
  while(met(w)&&n<520){n++;w=addDays(w,-7)}
  return n;
}
function ringSvg(r,p,color){
  const c=2*Math.PI*r;
  return`<circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-opacity=".18" stroke-width="12"/>`+(p>0?`<circle class="ringArc" cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-Math.min(1,p))}" style="--c:${c}" transform="rotate(-90 70 70)"/>`:'');
}
function renderRings(){
  const w=weekData(),totalGroups=Object.keys(exercises).length||1;
  const items=[
    {label:'Προπονήσεις',v:w.days.size,goal:settings.goalWorkouts,color:'var(--ring-1)',r:60},
    {label:'Sets',v:w.sets,goal:settings.goalSets,color:'var(--ring-2)',r:46},
    {label:'Μυϊκές ομάδες',v:w.groups.size,goal:totalGroups,color:'var(--ring-3)',r:32},
  ];
  const pct=Math.round(items.reduce((a,i)=>a+Math.min(1,i.v/i.goal),0)/items.length*100);
  $('#rings').innerHTML=`<svg viewBox="0 0 140 140" role="img" aria-label="Πρόοδος εβδομάδας ${pct}%">${items.map(i=>ringSvg(i.r,i.v/i.goal,i.color)).join('')}<text x="70" y="70" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="800" fill="currentColor" style="font-family:inherit">${pct}%</text></svg>`;
  $('#ringLegend').innerHTML=items.map(i=>`<li style="--c:${i.color}"><i></i><b>${i.v}<small> / ${i.goal}</small></b><span>${i.label}</span></li>`).join('');
  const t=today();
  $('#weekStrip').innerHTML=DAY_LETTERS.map((L,i)=>{
    const d=addDays(w.start,i),gs=[...new Set(w.ls.filter(l=>l.date===d).map(l=>l.group))];
    let bg='';
    if(gs.length){const step=100/gs.length;bg=` style="background:conic-gradient(${gs.map((g,k)=>`${groupColor(g)} ${k*step}% ${(k+1)*step}%`).join(',')})"`}
    return`<div class="wd${gs.length?' done':''}${d===t?' today':''}"><div class="wc"${bg}>${gs.length?'✓':''}</div>${L}</div>`;
  }).join('');
}
function renderTiles(){
  const days=new Set(logs.map(l=>l.date)).size;
  const vol=logs.reduce((a,l)=>a+l.sets.reduce((b,s)=>b+s.kg*s.reps,0),0);
  const records=[...computeStatuses().values()].filter(s=>s.cls==='record').length;
  const streak=weeklyStreak();
  $('#tiles').innerHTML=[
    ['🔥',streak,`εβδομάδες σερί (στόχος ${settings.goalWorkouts}×)`],
    ['💪',days,'προπονήσεις συνολικά'],
    ['🏋️',vol>=1000?`${fmt(vol/1000)} t`:`${fmt(vol)} kg`,'συνολικός όγκος'],
    ['🏆',records,'νέα records'],
  ].map(([i,v,l])=>`<div class="tile"><div class="ti2">${i}</div><b>${v}</b><span>${l}</span></div>`).join('');
}

function seriesFor(ex,metric){
  return logs.filter(l=>l.exercise===ex).sort(byOldest).slice(-20).map(l=>({date:l.date,unit:unit(l),v:metric==='kg'?score(l):metric==='e1rm'?bestE1rm(l):volume(l)}));
}
function lineChart(pts){
  const W=320,H=170,L=34,R=12,T=12,B=26,n=pts.length;
  let min=Math.min(...pts.map(p=>p.v)),max=Math.max(...pts.map(p=>p.v));
  if(min===max){min-=1;max+=1}
  const pad=(max-min)*.15;min=Math.max(0,min-pad);max+=pad;
  const x=i=>L+(n===1?(W-L-R)/2:i*(W-L-R)/(n-1)),y=v=>T+(1-(v-min)/(max-min))*(H-T-B);
  const line=pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area=`${line}L${x(n-1).toFixed(1)} ${H-B}L${x(0).toFixed(1)} ${H-B}Z`;
  const ticks=[min,(min+max)/2,max].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L-6}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${fmt(Math.round(v*2)/2)}</text>`).join('');
  let runMax=-Infinity;
  const dots=pts.map((p,i)=>{const pr=p.v>runMax&&i>0;runMax=Math.max(runMax,p.v);return`<circle class="pt${i===n-1?' last':''}${pr?' pr':''}" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i===n-1?5:3.5}"/>`}).join('');
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Γράφημα προόδου"><defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22a55f" stop-opacity=".28"/><stop offset="1" stop-color="#22a55f" stop-opacity="0"/></linearGradient><linearGradient id="lineG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34c07a"/><stop offset="1" stop-color="#15844a"/></linearGradient></defs>${ticks}<path d="${area}" fill="url(#areaG)"/><path class="line" d="${line}"/>${dots}<text x="${L}" y="${H-8}" text-anchor="start">${shortDate(pts[0].date)}</text>${n>1?`<text x="${W-R}" y="${H-8}" text-anchor="end">${shortDate(pts[n-1].date)}</text>`:''}</svg>`;
}
function renderChart(){
  const names=[...new Set([...logs].sort(byNewest).map(l=>l.exercise))];
  const sel=$('#chartExercise');
  if(!names.length){sel.innerHTML='';$('#chart').innerHTML='<div class="empty">Κάνε την πρώτη καταγραφή για να δεις γράφημα προόδου.</div>';$('#chartSummary').innerHTML='';return}
  if(!names.includes(chartExercise))chartExercise=names[0];
  sel.innerHTML=names.map(n=>`<option${n===chartExercise?' selected':''}>${escapeHtml(n)}</option>`).join('');
  const bodyweight=!logs.some(l=>l.exercise===chartExercise&&isWeighted(l));
  $('[data-m="e1rm"]').hidden=bodyweight;
  if(bodyweight&&chartMetric==='e1rm')chartMetric='kg';
  document.querySelectorAll('#metricChips .chip').forEach(b=>b.classList.toggle('on',b.dataset.m===chartMetric));
  const pts=seriesFor(chartExercise,chartMetric),u=pts[pts.length-1].unit,vs=pts.map(p=>p.v),delta=vs[vs.length-1]-vs[0];
  $('#chart').innerHTML=lineChart(pts);
  $('#chartSummary').innerHTML=`<div><b>${fmt(Math.max(...vs))}${u}</b><span>Καλύτερο</span></div><div><b>${fmt(vs[vs.length-1])}${u}</b><span>Τελευταίο</span></div><div class="${delta>0?'plus':delta<0?'minus':''}"><b>${delta>0?'+':delta<0?'−':''}${fmt(Math.abs(delta))}${u}</b><span>Από την αρχή</span></div>`;
}
$('#chartExercise').onchange=e=>{chartExercise=e.target.value;renderChart()};
$('#metricChips').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;chartMetric=b.dataset.m;renderChart()};

function renderDonut(){
  const since=addDays(today(),-29),per={};
  logs.filter(l=>l.date>=since).forEach(l=>per[l.group]=(per[l.group]||0)+l.sets.length);
  const rows=Object.entries(per).sort((a,b)=>b[1]-a[1]),total=rows.reduce((a,r)=>a+r[1],0);
  if(!total){$('#donut').innerHTML='<div class="empty">Καμία καταγραφή τις τελευταίες 30 ημέρες.</div>';return}
  const r=48,c=2*Math.PI*r;let acc=0;
  const arcs=rows.map(([g,n])=>{
    const len=n/total*c,gap=rows.length>1?Math.min(3,len*.4):0;
    const s=`<circle cx="60" cy="60" r="${r}" fill="none" stroke="${groupColor(g)}" stroke-width="16" stroke-dasharray="${len-gap} ${c-len+gap}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)"/>`;
    acc+=len;return s;
  }).join('');
  $('#donut').innerHTML=`<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Κατανομή sets ανά μυϊκή ομάδα"><circle cx="60" cy="60" r="${r}" fill="none" stroke="#eef5ec" stroke-width="16"/>${arcs}</svg><div class="donutCenter"><b>${total}</b><span>sets</span></div></div><ul class="donutLegend">${rows.map(([g,n])=>`<li style="--c:${groupColor(g)}"><i></i><span>${escapeHtml(g)}</span><em>${n} · ${Math.round(n/total*100)}%</em></li>`).join('')}</ul>`;
}

function renderRecords(){
  const map={};
  logs.forEach(l=>{
    const r=map[l.exercise]||(map[l.exercise]={ex:l.exercise,group:l.group,last:l.date,kg:0,reps:0,date:l.date,e1:0});
    if(l.date>r.last){r.last=l.date;r.group=l.group}
    l.sets.forEach(s=>{
      if(s.kg>r.kg||(s.kg===r.kg&&s.reps>r.reps)){r.kg=s.kg;r.reps=s.reps;r.date=l.date}
      if(s.kg>0)r.e1=Math.max(r.e1,e1rm(s));
    });
  });
  const rows=Object.values(map).sort((a,b)=>b.last.localeCompare(a.last));
  $('#prList').innerHTML=rows.length?rows.map(r=>`<div class="pr" style="--c:${groupColor(r.group)}"><div class="prMain"><b>${escapeHtml(r.ex)}</b><span>${formatDate(r.date)}${r.e1?` · εκτ. 1RM ${fmt(Math.round(r.e1*2)/2)}kg`:''}</span></div><div class="prVal"><b>${setText({kg:r.kg,reps:r.reps})}</b></div></div>`).join(''):'<div class="empty">Τα records σου θα εμφανιστούν εδώ.</div>';
}
/* ───── steps (Apple Health via a Shortcut, or typed in) ─────
   A web app can't read HealthKit, so a Shortcut named "WT Steps" copies
   "WTSTEPS\n2026-09-28 8234\n..." to the clipboard and ↻ imports it.
   Huawei/Garmin/Fitbit watches reach us by syncing into Apple Health. */
const STEPS_SHORTCUT='WT Steps',STEPS_MARKER='WTSTEPS';
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const fmtInt=n=>Math.round(n).toLocaleString('el-GR');
const shortK=n=>n>=1000?`${(n/1000).toFixed(1).replace('.',',')}k`:String(n);
const validDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&dayKey(parseDay(d))===d;
let awaitingShortcut=false;

function toSteps(tok){
  tok=tok.replace(/[  ]/g,'').replace(/[.,]+$/,'');
  if(/^\d{1,3}([.,]\d{3})+$/.test(tok))return Number(tok.replace(/[.,]/g,''));   // 8.234 / 8,234 = thousands
  return Math.round(Number(tok.replace(',','.')));
}
// one "yyyy-mm-dd … number" per line; the last number on the line wins (skips times like 00:00)
function parseSteps(text){
  const out={};
  String(text||'').split(/[\r\n;]+/).forEach(line=>{
    const m=line.match(/\d{4}-\d{2}-\d{2}/);if(!m)return;
    const d=m[0];if(!validDay(d)||d>today())return;
    const toks=line.slice(m.index+d.length).match(/\d[\d.,  ]*/g);if(!toks)return;
    const n=toSteps(toks[toks.length-1]);
    if(Number.isFinite(n)&&n>=0&&n<=200000)out[d]=n;
  });
  return out;
}
const textHash=t=>{let h=0;for(const c of t)h=(h*31+c.charCodeAt(0))|0;return h};
function applySteps(found){
  const n=Object.keys(found).length;
  Object.assign(steps,found);settings.stepsSyncedAt=Date.now();
  persist();renderSteps();$('#stepsSyncBtn').classList.remove('pulse');
  toast(`✅ Βήματα: ενημερώθηκαν ${n} ${n===1?'μέρα':'μέρες'}`);
}
async function syncSteps(){
  let text='';
  try{text=await navigator.clipboard.readText()}catch{}
  const fresh=text.includes(STEPS_MARKER)&&textHash(text)!==settings.stepsLastClip;   // same text as last time = stale, go get new numbers
  if(fresh){
    const found=parseSteps(text);
    if(Object.keys(found).length){settings.stepsLastClip=textHash(text);settings.stepsShortcut=true;return applySteps(found)}
    openStepsDialog(true);$('#stepsPaste').value=text;
    return toast('⚠️ Το Shortcut έδωσε κείμενο χωρίς βήματα — δες τη μορφή');
  }
  if(isIOS&&settings.stepsShortcut){
    awaitingShortcut=true;
    location.href='shortcuts://run-shortcut?name='+encodeURIComponent(STEPS_SHORTCUT);
    return;
  }
  openStepsDialog(!settings.stepsShortcut);
}

function stepsChart(days,goal,gymDays,t){
  const W=320,H=150,top=16,base=112,slot=W/days.length,bw=24;
  const max=Math.max(goal,...days.map(d=>steps[d]||0))*1.1,y=v=>base-(v/max)*(base-top);
  const bars=days.map((d,i)=>{
    const v=steps[d],cx=slot*i+slot/2,x=(cx-bw/2).toFixed(1);
    const cls=v==null?'none':v>=goal?'met':'under',h=v==null?3:Math.max(3,base-y(v));
    const L=DAY_LETTERS[(parseDay(d).getDay()+6)%7];
    return `<rect class="bar ${cls}" x="${x}" y="${(base-h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="6"/>`+
      (v!=null?`<text x="${cx}" y="${(base-h-5).toFixed(1)}" text-anchor="middle">${shortK(v)}</text>`:'')+
      `<text class="${d===t?'today':''}" x="${cx}" y="${base+16}" text-anchor="middle">${d===t?'Σήμ':L}</text>`+
      (gymDays.has(d)?`<circle class="gym" cx="${cx}" cy="${base+28}" r="3.5"/>`:'');
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Βήματα 7 ημερών"><line class="goal" x1="0" x2="${W}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/>${bars}</svg>`;
}
function renderSteps(){
  const body=$('#stepsBody'),t=today(),goal=settings.goalSteps;
  if(!Object.keys(steps).length){
    body.innerHTML=`<div class="empty">Σύνδεσε το Apple Health — και μέσω αυτού Huawei, Garmin, Fitbit — για να βλέπεις βήματα δίπλα στις προπονήσεις σου. Ή πέρασέ τα με το ✎.</div><button type="button" class="secondary stepsSetup" data-steps-setup>Πώς το συνδέω</button>`;
    return;
  }
  const tv=steps[t],pct=tv==null?0:Math.min(100,tv/goal*100),met=tv!=null&&tv>=goal;
  const s=settings.stepsSyncedAt,when=!s?'':dayKey(new Date(s))===t?`σήμερα ${new Date(s).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})}`:formatDate(dayKey(new Date(s)));
  const gymDays=new Set(logs.map(l=>l.date));
  const last7=[...Array(7)].map((_,i)=>addDays(t,i-6));
  // insights use finished days only — today's count is still growing
  const done=n=>[...Array(n)].map((_,i)=>addDays(t,-n+i)).filter(d=>steps[d]!=null);
  const avg=a=>a.reduce((x,d)=>x+steps[d],0)/a.length;
  const d7=done(7),d30=done(30),gym=d30.filter(d=>gymDays.has(d)),rest=d30.filter(d=>!gymDays.has(d));
  const tips=[];
  if(d7.length)tips.push(`Μ.Ο. 7 ημερών: <b>${fmtInt(avg(d7))}</b> · στόχος σε <b>${d7.filter(d=>steps[d]>=goal).length}/${d7.length}</b> μέρες`);
  if(gym.length>=2&&rest.length>=2)tips.push(`🏋️ Μέρες προπόνησης: <b>${fmtInt(avg(gym))}</b> βήματα · ξεκούρασης: <b>${fmtInt(avg(rest))}</b>`);
  body.innerHTML=`<div class="stepsToday"><div class="stNum"><b>${tv==null?'—':fmtInt(tv)}</b><span>/ ${fmtInt(goal)} σήμερα</span>${met?'<span class="goalOk">✓ Στόχος</span>':''}</div><div class="stepsBar${met?' met':''}"><i style="width:${pct}%"></i></div>${when?`<small>Τελευταίος συγχρονισμός: ${when}</small>`:''}</div>
  <div class="stepsChart">${stepsChart(last7,goal,gymDays,t)}</div>
  <div class="legend stepsLegend"><span><i class="dot met"></i>Στόχος</span><span><i class="dot under"></i>Κάτω από στόχο</span><span><i class="dot gym"></i>Προπόνηση</span></div>
  ${tips.length?`<div class="stepsInsight">${tips.map(x=>`<div>${x}</div>`).join('')}</div>`:''}`;
}

const stepsDlg=$('#stepsDialog');
function openStepsDialog(showHelp){
  $('#stepsDate').value=today();$('#stepsDate').max=today();
  $('#stepsValue').value=steps[today()]??'';$('#stepsPaste').value='';
  $('#stepsHowto').open=!!showHelp;stepsDlg.showModal();
}
$('#stepsSyncBtn').onclick=syncSteps;
$('#stepsClose').onclick=()=>stepsDlg.close();
$('#stepsEditBtn').onclick=()=>openStepsDialog(false);
$('#stepsBody').onclick=e=>{if(e.target.closest('[data-steps-setup]'))openStepsDialog(true)};
$('#stepsDate').onchange=()=>{$('#stepsValue').value=steps[$('#stepsDate').value]??''};
$('#stepsSaveDay').onclick=()=>{
  const d=$('#stepsDate').value;if(!validDay(d)||d>today())return toast('Διάλεξε ημέρα μέχρι σήμερα');
  const v=$('#stepsValue').value;
  if(v==='')delete steps[d];   // empty = remove that day
  else{const n=Math.round(Number(v));if(!(n>=0&&n<=200000))return toast('Μη έγκυρος αριθμός βημάτων');steps[d]=n}
  persist();renderSteps();stepsDlg.close();toast('✅ Αποθηκεύτηκε');
};
$('#stepsImport').onclick=()=>{
  const found=parseSteps($('#stepsPaste').value);
  if(!Object.keys(found).length)return toast('Δεν βρέθηκαν βήματα — κάθε γραμμή: 2026-09-28 8234');
  stepsDlg.close();applySteps(found);
};

function renderStats(){renderRings();renderSteps();renderTiles();renderChart();renderDonut();renderRecords()}

/* ───── water: a bottle whose capacity is the daily goal and fills with every drink ───── */
const fmtL=ml=>(ml/1000).toLocaleString('el-GR',{maximumFractionDigits:2});
const dayWater=d=>(water[d]||[]).reduce((a,x)=>a+x.ml,0);
const waterToday=()=>dayWater(today());
const BOTTLE_TOP=58,BOTTLE_BOTTOM=212;   // inner fill range of the bottle body in the SVG
function bottleSvg(){
  const body='M50 30H70V44C70 52 98 58 98 76V196Q98 212 82 212H38Q22 212 22 196V76C22 58 50 52 50 44Z';
  return`<svg viewBox="0 0 150 222" role="img" aria-label="Μπουκάλι νερού">
  <defs><clipPath id="bottleClip"><path d="${body}"/></clipPath>
  <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd6bd"/><stop offset="1" stop-color="#1f8f7f"/></linearGradient></defs>
  <path d="${body}" fill="#eef7f3"/>
  <g clip-path="url(#bottleClip)"><g id="waterLevel" class="waterLevel" style="transform:translateY(${BOTTLE_BOTTOM}px)">
    <path class="wave w2" d="M0 6Q15 0 30 6T60 6T90 6T120 6T150 6T180 6T210 6T240 6V240H0Z" fill="#9fe3d2"/>
    <path class="wave w1" d="M0 8Q15 2 30 8T60 8T90 8T120 8T150 8T180 8T210 8T240 8V240H0Z" fill="url(#waterG)"/>
  </g></g>
  <g id="bottleTicks"></g>
  <rect x="29" y="84" width="6" height="96" rx="3" fill="#fff" opacity=".45"/>
  <path d="${body}" fill="none" stroke="#bfd9cc" stroke-width="3"/>
  <rect x="46" y="8" width="28" height="24" rx="6" fill="#7b5236"/><rect x="46" y="26" width="28" height="4" fill="#5c3b24"/>
  </svg>`;
}
function renderWater(){
  const box=$('#bottle'),goal=settings.goalWater,total=waterToday(),pct=total/goal;
  if(!box.firstChild)box.innerHTML=bottleSvg();
  const y=BOTTLE_BOTTOM-Math.min(1,pct)*(BOTTLE_BOTTOM-BOTTLE_TOP);
  $('#waterLevel').style.transform=`translateY(${y.toFixed(1)}px)`;
  // a tick every 500 ml of the goal, labelled at whole litres
  let ticks='';
  for(let ml=500;ml<goal;ml+=500){
    const ty=BOTTLE_BOTTOM-(ml/goal)*(BOTTLE_BOTTOM-BOTTLE_TOP),whole=ml%1000===0;
    ticks+=`<line x1="${whole?84:88}" x2="98" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#7b5236" stroke-width="2" opacity=".55"/>`+(whole?`<text x="104" y="${(ty+4).toFixed(1)}" class="tickTxt">${ml/1000} L</text>`:'');
  }
  ticks+=`<text x="104" y="${BOTTLE_TOP+4}" class="tickTxt goal">${fmtL(goal)} L</text>`;
  $('#bottleTicks').innerHTML=ticks;
  $('#waterNow').textContent=fmtL(total);
  $('#waterGoalTxt').textContent=` / ${fmtL(goal)} L`;
  $('#waterGoalBtn').textContent=`Στόχος ${fmtL(goal)} L`;
  const left=goal-total;
  $('#waterPct').innerHTML=left>0?`<b>${Math.round(pct*100)}%</b> · λείπουν ${fmtL(left)} L`:`<span class="goalOk">✓ Στόχος</span>${left<0?` +${fmtL(-left)} L`:''}`;
  $('#waterPct').classList.toggle('met',left<=0);
  const list=(water[today()]||[]).slice().reverse();
  $('#waterLog').innerHTML=list.length?list.map(x=>`<span class="waterChip">${new Date(x.t).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit',hour12:false})} · ${x.ml} ml<button type="button" class="remove" data-t="${x.t}" aria-label="Αφαίρεση">✕</button></span>`).join(''):'<span class="empty">Πάτα ένα κουμπί κάθε φορά που πίνεις νερό.</span>';
}
function addWater(ml){
  ml=Math.round(Number(ml));if(!(ml>=10&&ml<=3000))return toast('Βάλε ποσότητα από 10 έως 3000 ml');
  const before=waterToday(),t=today();
  (water[t]||(water[t]=[])).push({t:Date.now(),ml});
  persist();renderWater();renderNutritionWeek();
  if(before<settings.goalWater&&waterToday()>=settings.goalWater){confetti();navigator.vibrate?.([40,60,120]);toast('💧 Έπιασες τον στόχο νερού για σήμερα!')}
  else toast(`💧 +${ml} ml`);
}
document.querySelectorAll('.waterAdd').forEach(b=>b.onclick=()=>addWater(b.dataset.ml));
$('#waterForm').onsubmit=e=>{e.preventDefault();const v=$('#waterMl').value;if(!v)return;addWater(v);$('#waterMl').value='';$('#waterMl').blur()};
$('#waterLog').onclick=e=>{
  const b=e.target.closest('[data-t]');if(!b)return;
  const t=today();water[t]=(water[t]||[]).filter(x=>String(x.t)!==b.dataset.t);
  if(!water[t].length)delete water[t];
  persist();renderWater();renderNutritionWeek();
};
$('#waterGoalBtn').onclick=()=>{openSettings();setTimeout(()=>$('#goalWater').focus(),50)};

/* ───── weigh-ins: goal, progress, chart and a weekly log (weekly averages smooth out daily swings) ───── */
const fmtKg=v=>v.toLocaleString('el-GR',{maximumFractionDigits:1});
const parseKg=v=>{const n=parseFloat(String(v).replace(',','.'));return Number.isFinite(n)?Math.round(n*10)/10:NaN};
const weightDays=()=>Object.keys(weights).sort();
function latestWeight(before){
  const ds=weightDays().filter(d=>!before||d<before);
  return ds.length?{date:ds[ds.length-1],kg:weights[ds[ds.length-1]]}:null;
}
// weight at the moment the goal was set; if there was none yet, the first weigh-in after it
function goalStart(){
  if(settings.weightGoalStart!=null)return settings.weightGoalStart;
  const ds=weightDays();if(!ds.length)return null;
  const at=settings.weightGoalSetAt;
  if(!at)return weights[ds[0]];
  const after=ds.find(d=>d>=at);
  return weights[after??ds[ds.length-1]];
}
function goalProgress(cur){
  const g=settings.weightGoal,st=goalStart();
  if(g==null||st==null||cur==null)return null;
  const losing=g<st,reached=losing?cur<=g:cur>=g;
  const pct=reached?1:st===g?0:Math.max(0,Math.min(1,(st-cur)/(st-g)));
  return{pct,reached,losing,goal:g,start:st,changed:cur-st,left:Math.abs(cur-g)};
}
// closer to the goal = good (green), further = amber; no goal = neutral
const towardCls=(cur,prev)=>settings.weightGoal==null||prev==null?'':Math.abs(cur-settings.weightGoal)<Math.abs(prev-settings.weightGoal)?'good':Math.abs(cur-settings.weightGoal)>Math.abs(prev-settings.weightGoal)?'bad':'';
const deltaTxt=d=>Math.abs(d)<0.05?'= ίδιο':`${d<0?'▼':'▲'} ${fmtKg(Math.abs(d))} kg`;

function weightChart(pts,goal){
  const W=320,H=150,L=34,R=44,T=12,B=24,n=pts.length,vals=pts.map(p=>p.v).concat(goal==null?[]:[goal]);
  let min=Math.min(...vals)-.5,max=Math.max(...vals)+.5;
  const x=i=>L+(n===1?(W-L-R)/2:i*(W-L-R)/(n-1)),y=v=>T+(1-(v-min)/(max-min))*(H-T-B);
  const line=pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area=`${line}L${x(n-1).toFixed(1)} ${H-B}L${x(0).toFixed(1)} ${H-B}Z`;
  const ticks=[min,(min+max)/2,max].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L-6}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${fmtKg(v)}</text>`).join('');
  const g=goal==null?'':`<line class="wGoal" x1="${L}" x2="${W-R}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/><text class="wGoalTxt" x="${W-R+4}" y="${(y(goal)+3).toFixed(1)}">🎯 ${fmtKg(goal)}</text>`;
  const dots=pts.map((p,i)=>`<circle class="wPt${i===n-1?' last':''}" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i===n-1?5:3.5}"/>`).join('');
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Γράφημα βάρους"><defs><linearGradient id="wArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22a55f" stop-opacity=".25"/><stop offset="1" stop-color="#22a55f" stop-opacity="0"/></linearGradient></defs>${ticks}${g}<path d="${area}" fill="url(#wArea)"/><path class="wLine" d="${line}"/>${dots}<text x="${L}" y="${H-6}">${shortDate(pts[0].date)}</text>${n>1?`<text x="${W-R}" y="${H-6}" text-anchor="end">${shortDate(pts[n-1].date)}</text>`:''}</svg>`;
}
function renderWeight(){
  const last=latestWeight(),g=settings.weightGoal;
  $('#weightGoalBtn').textContent=g==null?'🎯 Στόχος':`🎯 ${fmtKg(g)} kg`;
  $('#weightKg').placeholder=last?fmtKg(last.kg):'π.χ. 82,4';
  if(!$('#weightDate').value||$('#weightDate').value>today())$('#weightDate').value=today();
  $('#weightDate').max=today();
  if(!last){
    $('#weightNow').innerHTML='<span class="empty">Πέρασε το πρώτο σου ζύγισμα για να ξεκινήσει το log.</span>';
    $('#weightProgress').innerHTML=g==null?'':`🎯 Στόχος: <b>${fmtKg(g)} kg</b>`;
    $('#weightChart').innerHTML='';$('#weightLog').innerHTML='';return;
  }
  const prev=latestWeight(last.date);
  $('#weightNow').innerHTML=`<b>${fmtKg(last.kg)}</b><span>kg</span>${prev?`<span class="wDelta ${towardCls(last.kg,prev.kg)}">${deltaTxt(last.kg-prev.kg)}</span>`:''}<small>${formatDate(last.date)}${prev?` · σε σχέση με ${formatDate(prev.date)}`:''}</small>`;
  const p=goalProgress(last.kg);
  $('#weightProgress').innerHTML=g==null?'Βάλε <b>🎯 στόχο κιλών</b> για να βλέπεις πόσο απέχεις.'
    :p.reached?`🎉 <b>Έπιασες τον στόχο των ${fmtKg(g)} kg!</b><div class="wBar"><i style="width:100%"></i></div>`
    :`${Math.abs(p.changed)<0.05?'Ίδιο βάρος με την αρχή':`${p.changed<0?'Έχασες':'Πήρες'} <b>${fmtKg(Math.abs(p.changed))} kg</b>`} από τα ${fmtKg(p.start)} · απομένουν <b>${fmtKg(p.left)} kg</b> για τα ${fmtKg(g)}<div class="wBar"><i style="width:${(p.pct*100).toFixed(1)}%"></i></div>`;
  const since=addDays(today(),-89),pts=weightDays().filter(d=>d>=since).map(d=>({date:d,v:weights[d]}));
  $('#weightChart').innerHTML=pts.length>1?weightChart(pts,g):'';
  $('#weightLog').innerHTML=weightDays().slice(-6).reverse().map(d=>`<span class="waterChip wChip">${shortDate(d)} · ${fmtKg(weights[d])} kg<button type="button" class="remove" data-d="${d}" aria-label="Διαγραφή ζυγίσματος">✕</button></span>`).join('');
}
$('#weightForm').onsubmit=e=>{
  e.preventDefault();
  const d=$('#weightDate').value,kg=parseKg($('#weightKg').value);
  if(!validDay(d)||d>today())return toast('Διάλεξε ημέρα μέχρι σήμερα');
  if(!(kg>=25&&kg<=350))return toast('Γράψε τα κιλά σου, π.χ. 82,4');
  const wasReached=goalProgress(latestWeight()?.kg)?.reached;
  weights[d]=kg;persist();
  $('#weightKg').value='';$('#weightKg').blur();$('#weightDate').value=today();
  renderWeight();renderNutritionWeek();
  if(!wasReached&&goalProgress(latestWeight().kg)?.reached){confetti();navigator.vibrate?.([40,60,120]);toast('🎯 Έπιασες τον στόχο βάρους!')}
  else toast(`⚖️ ${fmtKg(kg)} kg · ${formatDate(d)}`);
};
$('#weightLog').onclick=e=>{const b=e.target.closest('[data-d]');if(!b)return;delete weights[b.dataset.d];persist();renderWeight();renderNutritionWeek()};
$('#weightGoalBtn').onclick=()=>{openSettings();setTimeout(()=>$('#goalWeight').focus(),50)};

function renderNutritionWeek(){
  const t=today(),ws=weekStart(t),g=settings.weightGoal,goalW=settings.goalWater;
  const week=w=>{
    const days=[...Array(7)].map((_,i)=>addDays(w,i)).filter(d=>d<=t),wd=days.filter(d=>d in weights);
    return{w,days:days.length,water:days.filter(d=>dayWater(d)>=goalW).length,hasWater:days.some(d=>water[d]),weighIns:wd.length,avg:wd.length?wd.reduce((a,d)=>a+weights[d],0)/wd.length:null};
  };
  const cur=week(ws),last=latestWeight(),p=goalProgress(last?.kg);
  $('#nutWeekRange').textContent=`${shortDate(ws)} – ${shortDate(addDays(ws,6))}`;
  const items=[
    {label:'Νερό: μέρες στόχου',v:cur.water,goal:7,txt:`${cur.water}<small> / 7</small>`,color:'#1f8f7f',r:60},
    {label:'Ζυγίσματα',v:cur.weighIns,goal:3,txt:`${cur.weighIns}<small> / 3</small>`,color:'var(--coffee)',r:46},
    {label:'Πρόοδος στόχου κιλών',v:p?p.pct:0,goal:1,txt:p?`${Math.round(p.pct*100)}<small>%</small>`:'—',color:'var(--brand)',r:32},
  ];
  const center=cur.avg!=null?fmtKg(cur.avg):last?fmtKg(last.kg):'—';
  $('#nutRings').innerHTML=`<svg viewBox="0 0 140 140" role="img" aria-label="Εβδομάδα διατροφής">${items.map(i=>ringSvg(i.r,i.v/i.goal,i.color)).join('')}<text x="70" y="66" text-anchor="middle" font-size="17" font-weight="800" fill="currentColor" style="font-family:inherit">${center}</text><text x="70" y="84" text-anchor="middle" font-size="10" font-weight="700" fill="#6b776c" style="font-family:inherit">${cur.avg!=null?'kg μ.ό.':last?'kg':''}</text></svg>`;
  $('#nutRingLegend').innerHTML=items.map(i=>`<li style="--c:${i.color}"><i></i><b>${i.txt}</b><span>${i.label}</span></li>`).join('');
  // log: this week and up to 7 earlier weeks that have any data
  const rows=[];
  for(let i=0;i<12&&rows.length<8;i++){const r=week(addDays(ws,-7*i));if(i===0||r.avg!=null||r.hasWater)rows.push(r)}
  rows.forEach((r,i)=>{const older=rows.slice(i+1).find(o=>o.avg!=null);r.delta=r.avg!=null&&older?r.avg-older.avg:null;r.olderAvg=older?.avg});
  const notes=[],now=rows[0];
  if(now.avg!=null&&now.delta!=null){
    const cls=towardCls(now.avg,now.olderAvg);
    notes.push(`Μ.Ο. εβδομάδας <b>${fmtKg(now.avg)} kg</b> · ${deltaTxt(now.delta)} από την προηγούμενη${cls==='good'?' — <b>πλησιάζεις τον στόχο</b> 👍':cls==='bad'?' — απομακρύνεσαι από τον στόχο':''}`);
  }else if(!cur.weighIns)notes.push('Ζυγίσου 2–3 φορές την εβδομάδα, το πρωί μετά την τουαλέτα, για πιο σταθερό μέσο όρο.');
  if(p&&!p.reached)notes.push(`🎯 Απομένουν <b>${fmtKg(p.left)} kg</b> για τα ${fmtKg(p.goal)} kg`);
  $('#nutWeekNote').innerHTML=notes.map(x=>`<div>${x}</div>`).join('');
  $('#nutWeeks').innerHTML=rows.map((r,i)=>`<div class="weekRow"><div class="wr1"><b>${i===0?'Αυτή η εβδομάδα':`${shortDate(r.w)} – ${shortDate(addDays(r.w,6))}`}</b>${i===0?`<span>${shortDate(r.w)} – ${shortDate(addDays(r.w,6))}</span>`:''}</div><div class="wr2">${r.avg!=null?`${fmtKg(r.avg)} kg`:'—'}${r.delta!=null?`<span class="wDelta ${towardCls(r.avg,r.olderAvg)}">${deltaTxt(r.delta)}</span>`:''}</div><div class="wr3">💧 ${r.water}/${r.days}</div></div>`).join('');
}
function renderNutrition(){renderWeight();renderWater();renderNutritionWeek()}

/* ───── tabs ───── */
function switchTab(t){
  document.body.classList.toggle('onLog',t==='log');   // the tall header banner is only on the log screen
  ['log','history','stats','nutrition'].forEach(v=>$('#view-'+v).hidden=v!==t);
  document.querySelectorAll('.tab').forEach(b=>{
    const on=b.dataset.tab===t;b.classList.toggle('active',on);
    on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');
  });
  if(t==='history')renderHistory();
  if(t==='stats')renderStats();
  if(t==='nutrition')renderNutrition();
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));

/* ───── settings & data ───── */
const settingsDlg=$('#settingsDialog');
async function openSettings(){
  $('#goalWorkouts').value=settings.goalWorkouts;$('#goalSets').value=settings.goalSets;$('#goalSteps').value=settings.goalSteps;$('#goalWater').value=settings.goalWater;$('#goalWeight').value=settings.weightGoal==null?'':fmtKg(settings.weightGoal);
  settingsDlg.showModal();
  const kb=Math.max(1,Math.round((['wt_logs','wt_exercises','wt_settings','wt_steps','wt_water','wt_weight'].reduce((a,k)=>a+(localStorage.getItem(k)||'').length,0))/1024));
  let persisted=false;try{persisted=await navigator.storage.persisted()}catch{}
  $('#storageInfo').innerHTML=`📦 ${logs.length} καταγραφές · ${Object.keys(steps).length} μέρες βημάτων · ${Object.keys(water).length} μέρες νερού · ${Object.keys(weights).length} ζυγίσματα · ~${kb} KB<br>📅 Τελευταίο backup: ${settings.lastExport?formatDate(dayKey(new Date(settings.lastExport))):'ποτέ'}<br>${persisted?'🔒 Ο browser δεν θα σβήσει αυτόματα τα δεδομένα.':'ℹ️ Στο iPhone πρόσθεσέ το στην Οθόνη Αφετηρίας για πιο σταθερή αποθήκευση και κάνε backup πού και πού.'}`;
}
$('#settingsBtn').onclick=openSettings;
$('#settingsClose').onclick=()=>{saveSettings();settingsDlg.close()};
function saveSettings(){
  settings.goalWorkouts=clamp(Number($('#goalWorkouts').value),1,7,4);
  settings.goalSets=clamp(Number($('#goalSets').value),5,300,60);
  settings.goalSteps=clamp(Number($('#goalSteps').value),1000,50000,8000);
  settings.goalWater=clamp(Number($('#goalWater').value),500,8000,2500);
  const gw=$('#goalWeight').value.trim(),kg=parseKg(gw);
  if(gw===''){settings.weightGoal=null;settings.weightGoalSetAt=null;settings.weightGoalStart=null}
  else if(kg>=25&&kg<=350&&kg!==settings.weightGoal){settings.weightGoal=kg;settings.weightGoalSetAt=today();settings.weightGoalStart=latestWeight()?.kg??null}   // progress is measured from your weight right now
  if(!$('#view-nutrition').hidden)renderNutrition();
  persist();if(!$('#view-stats').hidden)renderStats();
}
settingsDlg.addEventListener('close',saveSettings);   // "Έτοιμο", Esc

// no banner on the main screen any more: a dot on the gear + a note in settings
const backupDue=()=>logs.length>=5&&(Date.now()-(settings.lastExport||0))/864e5>30;
function checkBackup(){
  const due=backupDue();
  $('#settingsBtn').classList.toggle('needsBackup',due);
  $('#backupHint').classList.toggle('due',due);
  $('#backupHint').textContent=due
    ?`⚠️ ${settings.lastExport?'Πάνε πάνω από 30 μέρες από το τελευταίο backup.':'Δεν έχεις κάνει ακόμα backup.'} Τα δεδομένα μένουν μόνο σε αυτό το κινητό.`
    :'Σώζει προπονήσεις, βήματα, νερό και ζυγίσματα σε αρχείο (Αρχεία, iCloud, Drive).';
}
async function exportData(){
  const json=JSON.stringify({version:5,exportedAt:new Date().toISOString(),exercises,logs,steps,water,weights,settings},null,2);
  const file=new File([json],`gympilot-backup-${today()}.json`,{type:'application/json'});
  try{
    if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'GymPilot backup'});
    else{const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();URL.revokeObjectURL(a.href)}
    settings.lastExport=Date.now();persist();checkBackup();toast('✅ Το backup είναι έτοιμο');
  }catch(e){if(e.name!=='AbortError')toast('⚠️ Το backup απέτυχε')}
}
$('#exportBtn').onclick=exportData;

$('#importBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{
    const d=JSON.parse(await f.text());
    if(!Array.isArray(d.logs))throw new Error('bad file');
    const known=new Set(logs.map(l=>String(l.id)));
    const fresh=d.logs.map(l=>l&&{
      id:String(l.id||crypto.randomUUID?.()||Date.now()+Math.random()),created:Number(l.created)||0,
      date:/^\d{4}-\d{2}-\d{2}$/.test(l.date)?l.date:null,group:String(l.group||''),exercise:String(l.exercise||''),
      sets:Array.isArray(l.sets)?l.sets.map(s=>({kg:Math.max(0,Number(s.kg)||0),reps:Number(s.reps)||0})).filter(s=>s.reps>0):[],
      notes:String(l.notes||''),
    }).filter(l=>l&&l.date&&l.group&&l.exercise&&l.sets.length&&!known.has(l.id));
    // steps: only fill days we don't have — what's on the phone is newer
    const newSteps={};
    if(d.steps&&typeof d.steps==='object'&&!Array.isArray(d.steps))Object.entries(d.steps).forEach(([k,v])=>{const n=Math.round(Number(v));if(validDay(k)&&!(k in steps)&&n>=0&&n<=200000)newSteps[k]=n});
    const sn=Object.keys(newSteps).length;
    const newWater={};
    if(d.water&&typeof d.water==='object'&&!Array.isArray(d.water))Object.entries(d.water).forEach(([k,v])=>{
      if(!validDay(k)||k in water||!Array.isArray(v))return;
      const list=v.map(x=>({t:Number(x?.t)||0,ml:Math.round(Number(x?.ml))})).filter(x=>x.ml>=10&&x.ml<=3000);
      if(list.length)newWater[k]=list;
    });
    const wn=Object.keys(newWater).length;
    const newWeights={};
    if(d.weights&&typeof d.weights==='object'&&!Array.isArray(d.weights))Object.entries(d.weights).forEach(([k,v])=>{const kg=parseKg(v);if(validDay(k)&&!(k in weights)&&kg>=25&&kg<=350)newWeights[k]=kg});
    const kn=Object.keys(newWeights).length;
    if(!confirm(`Βρέθηκαν ${fresh.length} νέες καταγραφές (από ${d.logs.length} στο αρχείο)${sn?` και ${sn} μέρες βημάτων`:''}${wn?` και ${wn} μέρες νερού`:''}${kn?` και ${kn} ζυγίσματα`:''}. Συγχώνευση με τις υπάρχουσες;`))return;
    logs.push(...fresh);Object.assign(steps,newSteps);Object.assign(water,newWater);Object.assign(weights,newWeights);
    Object.entries(d.exercises||{}).forEach(([g,list])=>{if(Array.isArray(list))exercises[g]=[...new Set([...(exercises[g]||[]),...list.map(String)])]});
    fresh.forEach(l=>{const list=exercises[l.group]||(exercises[l.group]=[]);if(!list.includes(l.exercise))list.push(l.exercise)});
    persist();fillGroups(group.value);renderHistory();checkBackup();toast(`✅ Προστέθηκαν ${fresh.length} καταγραφές${sn?` · ${sn} μέρες βημάτων`:''}${wn?` · ${wn} μέρες νερού`:''}${kn?` · ${kn} ζυγίσματα`:''}`);
  }catch{alert('Το αρχείο δεν φαίνεται να είναι σωστό backup.')}
};

$('#clearBtn').onclick=()=>{
  if(!confirm('Να διαγραφεί ΟΛΟ το ιστορικό (προπονήσεις, βήματα, νερό και ζυγίσματα); Αυτό δεν αναιρείται (κάνε πρώτα Export αν θες backup).'))return;
  logs=[];steps={};water={};weights={};persist();if(!$('#view-nutrition').hidden)renderNutrition();settingsDlg.close();resetForm();renderHistory();checkBackup();
};

/* ───── init ───── */
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  // back from the Shortcuts app: reading the clipboard needs a tap, so ask for one
  if(awaitingShortcut){awaitingShortcut=false;$('#stepsSyncBtn').classList.add('pulse');toast('Πάτα ξανά ↻ Συγχρονισμός για να περαστούν τα βήματα')}
  tickTimer();
  if(!$('#view-nutrition').hidden)renderNutrition();   // new day = empty bottle, new week = new rings
  if(!editingId&&!$('#view-log').hidden&&date.value<today()&&sets.querySelectorAll('input:not(:placeholder-shown)').length===0)date.value=today();
});
try{navigator.storage?.persist?.()?.catch(()=>{})}catch{}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
date.value=today();fillGroups();checkBackup();
