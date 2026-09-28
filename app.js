const defaults={"Chest":["Bench Press","Incline Dumbbell Press","Chest Press","Cable Fly"],"Back":["Lat Pulldown","Seated Cable Row","Chest Supported Row","One Arm Dumbbell Row"],"Shoulders":["Shoulder Press","Lateral Raise","Rear Delt Fly"],"Biceps":["Barbell Curl","Dumbbell Curl","Hammer Curl"],"Triceps":["Cable Pushdown","Overhead Extension","Skull Crusher"],"Legs":["Leg Press","Leg Extension","Leg Curl","Romanian Deadlift","Calf Raise"],"Abs":["Cable Crunch","Leg Raise","Plank"]};
const GROUP_COLORS={Chest:'#ff5d73',Back:'#3b82f6',Shoulders:'#f59e0b',Biceps:'#10b981',Triceps:'#06b6d4',Legs:'#8b5cf6',Abs:'#ec4899'};
const EXTRA_COLORS=['#f97316','#14b8a6','#6366f1','#84cc16','#e11d48'];
const DAY_LETTERS=['Δ','Τ','Τ','Π','Π','Σ','Κ'];

function load(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
let exercises=load('wt_exercises',null),logs=load('wt_logs',[]);
if(!exercises||typeof exercises!=='object'||Array.isArray(exercises))exercises=defaults;
if(!Array.isArray(logs))logs=[];
let settings={goalWorkouts:4,goalSets:60,lastExport:0,...load('wt_settings',{})};
let editingId=null,historyFilter='all',historyLimit=30,chartExercise=null,chartMetric='kg';

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
function renderHistory(){
  renderFilters();
  const status=computeStatuses();
  const all=logs.filter(x=>historyFilter==='all'||x.group===historyFilter).sort(byNewest),arr=all.slice(0,historyLimit);
  $('#history').innerHTML=arr.length?arr.map(x=>{
    const s=status.get(x.id),id=escapeHtml(x.id);
    return`<div class="historyItem ${s.cls}" style="--c:${groupColor(x.group)}"><div class="historyTop"><div><div class="historyTitle">${escapeHtml(x.exercise)}</div><div class="historyMeta"><i class="gdot"></i>${formatDate(x.date)} · ${escapeHtml(x.group)}${isWeighted(x)?` · Όγκος ${fmt(volume(x))}kg`:''}</div><span class="badge">${badgeText(s)}</span></div><div class="itemBtns"><button class="remove" data-act="edit" data-id="${id}" aria-label="Επεξεργασία">✎</button><button class="remove" data-act="del" data-id="${id}" aria-label="Διαγραφή">✕</button></div></div><div class="historySets">${x.sets.map((t,i)=>`<span class="pill${i===s.idx?' top':''}"><small>S${i+1}</small>${setText(t)}</span>`).join('')}</div>${x.notes?`<div class="historyNotes">📝 ${escapeHtml(x.notes)}</div>`:''}</div>`;
  }).join(''):'<div class="empty">Καμία καταγραφή εδώ ακόμα.</div>';
  $('#moreBtn').hidden=all.length<=historyLimit;
}
$('#filters').onclick=e=>{const b=e.target.closest('[data-g]');if(!b)return;historyFilter=b.dataset.g;historyLimit=30;renderHistory()};
$('#moreBtn').onclick=()=>{historyLimit+=30;renderHistory()};
$('#history').onclick=e=>{
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
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Γράφημα προόδου"><defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d4dff" stop-opacity=".28"/><stop offset="1" stop-color="#6d4dff" stop-opacity="0"/></linearGradient><linearGradient id="lineG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d4dff"/><stop offset="1" stop-color="#c026d3"/></linearGradient></defs>${ticks}<path d="${area}" fill="url(#areaG)"/><path class="line" d="${line}"/>${dots}<text x="${L}" y="${H-8}" text-anchor="start">${shortDate(pts[0].date)}</text>${n>1?`<text x="${W-R}" y="${H-8}" text-anchor="end">${shortDate(pts[n-1].date)}</text>`:''}</svg>`;
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
  $('#donut').innerHTML=`<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Κατανομή sets ανά μυϊκή ομάδα"><circle cx="60" cy="60" r="${r}" fill="none" stroke="#f3f1fb" stroke-width="16"/>${arcs}</svg><div class="donutCenter"><b>${total}</b><span>sets</span></div></div><ul class="donutLegend">${rows.map(([g,n])=>`<li style="--c:${groupColor(g)}"><i></i><span>${escapeHtml(g)}</span><em>${n} · ${Math.round(n/total*100)}%</em></li>`).join('')}</ul>`;
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
function renderStats(){renderRings();renderTiles();renderChart();renderDonut();renderRecords()}

/* ───── tabs ───── */
function switchTab(t){
  ['log','history','stats'].forEach(v=>$('#view-'+v).hidden=v!==t);
  document.querySelectorAll('.tab').forEach(b=>{
    const on=b.dataset.tab===t;b.classList.toggle('active',on);
    on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');
  });
  if(t==='history')renderHistory();
  if(t==='stats')renderStats();
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));

/* ───── settings & data ───── */
const settingsDlg=$('#settingsDialog');
async function openSettings(){
  $('#goalWorkouts').value=settings.goalWorkouts;$('#goalSets').value=settings.goalSets;
  settingsDlg.showModal();
  const kb=Math.max(1,Math.round((['wt_logs','wt_exercises','wt_settings'].reduce((a,k)=>a+(localStorage.getItem(k)||'').length,0))/1024));
  let persisted=false;try{persisted=await navigator.storage.persisted()}catch{}
  $('#storageInfo').innerHTML=`📦 ${logs.length} καταγραφές · ~${kb} KB<br>📅 Τελευταίο backup: ${settings.lastExport?formatDate(dayKey(new Date(settings.lastExport))):'ποτέ'}<br>${persisted?'🔒 Ο browser δεν θα σβήσει αυτόματα τα δεδομένα.':'ℹ️ Στο iPhone πρόσθεσέ το στην Οθόνη Αφετηρίας για πιο σταθερή αποθήκευση και κάνε Export πού και πού.'}`;
}
$('#settingsBtn').onclick=openSettings;
settingsDlg.addEventListener('close',()=>{
  settings.goalWorkouts=clamp(Number($('#goalWorkouts').value),1,7,4);
  settings.goalSets=clamp(Number($('#goalSets').value),5,300,60);
  persist();if(!$('#view-stats').hidden)renderStats();
});

function checkBackup(){
  const days=(Date.now()-(settings.lastExport||0))/864e5;
  $('#backupBanner').hidden=!(logs.length>=5&&days>30);
}
async function exportData(){
  const json=JSON.stringify({version:2,exportedAt:new Date().toISOString(),exercises,logs,settings},null,2);
  const file=new File([json],`workout-backup-${today()}.json`,{type:'application/json'});
  try{
    if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Workout backup'});
    else{const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();URL.revokeObjectURL(a.href)}
    settings.lastExport=Date.now();persist();checkBackup();toast('✅ Το backup είναι έτοιμο');
  }catch(e){if(e.name!=='AbortError')toast('⚠️ Το backup απέτυχε')}
}
$('#exportBtn').onclick=exportData;
$('#bannerExport').onclick=exportData;

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
    if(!confirm(`Βρέθηκαν ${fresh.length} νέες καταγραφές (από ${d.logs.length} στο αρχείο). Συγχώνευση με τις υπάρχουσες;`))return;
    logs.push(...fresh);
    Object.entries(d.exercises||{}).forEach(([g,list])=>{if(Array.isArray(list))exercises[g]=[...new Set([...(exercises[g]||[]),...list.map(String)])]});
    fresh.forEach(l=>{const list=exercises[l.group]||(exercises[l.group]=[]);if(!list.includes(l.exercise))list.push(l.exercise)});
    persist();fillGroups(group.value);renderHistory();checkBackup();toast(`✅ Προστέθηκαν ${fresh.length} καταγραφές`);
  }catch{alert('Το αρχείο δεν φαίνεται να είναι σωστό backup.')}
};

$('#clearBtn').onclick=()=>{
  if(!confirm('Να διαγραφεί ΟΛΟ το ιστορικό; Αυτό δεν αναιρείται (κάνε πρώτα Export αν θες backup).'))return;
  logs=[];persist();settingsDlg.close();resetForm();renderHistory();checkBackup();
};

/* ───── init ───── */
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  tickTimer();
  if(!editingId&&!$('#view-log').hidden&&date.value<today()&&sets.querySelectorAll('input:not(:placeholder-shown)').length===0)date.value=today();
});
try{navigator.storage?.persist?.()?.catch(()=>{})}catch{}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
date.value=today();fillGroups();checkBackup();
