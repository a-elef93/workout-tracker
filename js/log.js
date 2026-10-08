/* ───── Log form: date & time, group, exercise, sets with steppers, live record feedback, rest timer ───── */
const group=$('#group'),exercise=$('#exercise'),sets=$('#sets'),date=$('#date'),timeIn=$('#time');
let editingId=null;
const lastOf=ex=>logs.filter(x=>x.exercise===ex&&x.id!==editingId).sort(byNewest)[0];

function fillGroups(keep){
  group.innerHTML=orderedGroups().map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(gName(g))}</option>`).join('');
  if(keep&&exercises[keep])group.value=keep;
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
  if(empty&&!editingId)resetSets(Math.min(8,Math.max(plannedToday(exercise.value)?.sets||3,lastOf(exercise.value)?.sets.length||0)));
  else placeholders();
  updateLiveStatus();
}
function addSet(kg='',reps=''){
  const n=sets.children.length+1;
  sets.insertAdjacentHTML('beforeend',`<tr><td><span class="setNum">${n}</span></td><td><div class="stepperField"><button type="button" class="stepBtn minus" data-f="kg" aria-label="${L('Λιγότερα κιλά','Less weight')}">−</button><input class="setInput kg" inputmode="decimal" type="number" step="0.5" min="0" value="${kg}"><button type="button" class="stepBtn plus" data-f="kg" aria-label="${L('Περισσότερα κιλά','More weight')}">+</button></div></td><td><div class="stepperField"><button type="button" class="stepBtn minus" data-f="reps" aria-label="${L('Λιγότερα reps','Fewer reps')}">−</button><input class="setInput reps" inputmode="numeric" type="number" min="0" value="${reps}"><button type="button" class="stepBtn plus" data-f="reps" aria-label="${L('Περισσότερα reps','More reps')}">+</button></div></td><td><button class="remove" aria-label="${L('Αφαίρεση set','Remove set')}">✕</button></td></tr>`);
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
  // a plateau from the coach beats the generic hint
  const a=analyseExercise(l.exercise);
  if(a?.kind==='plateau')return`${L(`Plateau ${a.sessions} προπονήσεων`,`${a.sessions}-session plateau`)}: ${FIX_TEXT[a.fix](a.next)}`;
  if(a?.kind==='regression')return insightText(a)[1];
  if(!isWeighted(l))return L('Στόχος: +1 rep σε κάθε set σε σχέση με την τελευταία φορά.','Goal: +1 rep on every set compared with last time.');
  if(l.sets.every(s=>s.reps>=10))return L(`Έκανες 10+ reps σε όλα τα sets — δοκίμασε ${fmt(topKg(l)+2.5)}kg στο top set.`,`You did 10+ reps on every set — try ${fmt(topKg(l)+2.5)}kg on the top set.`);
  return L('Στόχος: ίδια κιλά με +1 rep σε κάποιο set, ή ανέβασε 2,5kg αν ήταν εύκολο.','Goal: same weight with +1 rep on a set, or add 2.5kg if it felt easy.');
}
function showLast(){
  const l=lastOf(exercise.value),pl=plannedToday(exercise.value);
  const planTxt=pl?`<div class="planNote">🗓️ ${L('Πρόγραμμα','Plan')}: <b>${pl.sets?`${pl.sets}×${escapeHtml(pl.reps||'')}`:L('σήμερα','today')}</b></div>`:'';
  $('#lastText').innerHTML=(l
    ?`<b>${L('Τελευταία φορά','Last time')}</b> · ${formatDate(l.date)}${timeOf(l)?` · ${timeOf(l)}`:''}<div class="lastSets">${l.sets.map((s,i)=>`<span class="pill"><small>S${i+1}</small>${setText(s)}</span>`).join('')}</div>`
    :L('Δεν υπάρχει προηγούμενη καταγραφή.','No previous entry yet.'))+planTxt;
  $('#hint').hidden=!l;if(l)$('#hint').textContent='💡 '+hintFor(l);
  $('#copyLastBtn').hidden=!l;
}

function startEdit(id){
  const l=logs.find(x=>String(x.id)===id);if(!l)return;
  editingId=l.id;
  if(!exercises[l.group])exercises[l.group]=[];
  if(!exercises[l.group].includes(l.exercise))exercises[l.group].push(l.exercise);
  date.value=l.date;timeIn.value=timeOf(l)||'';
  fillGroups(l.group);fillExercises(l.exercise);
  sets.innerHTML='';l.sets.forEach(s=>addSet(s.kg>0?s.kg:'',s.reps));
  $('#notes').value=l.notes||'';
  $('#editBanner').hidden=false;$('#saveBtn').textContent=L('Ενημέρωση καταγραφής','Update entry');
  switchTab('log');
  $('#logCard').scrollIntoView({block:'start'});
}
function stopEditing(){
  editingId=null;$('#editBanner').hidden=true;$('#saveBtn').textContent=L('Αποθήκευση προπόνησης','Save workout');
}
function resetForm(){
  stopEditing();$('#notes').value='';showLast();
  resetSets(Math.min(8,Math.max(plannedToday(exercise.value)?.sets||3,lastOf(exercise.value)?.sets.length||0)));
}

group.onchange=()=>{fillExercises(nextPlannedExercise(group.value)||undefined)};
exercise.onchange=onExerciseChange;
// "+ Set" copies the last row that actually has numbers in it
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
$('#nowBtn').onclick=()=>{timeIn.value=nowTime()};

/* ───── steppers: tap ±2.5kg / ±1 rep, hold to repeat fast ───── */
let stepTimer=null,stepInterval=null;
function clearStepTimers(){clearTimeout(stepTimer);clearInterval(stepInterval);stepTimer=stepInterval=null}
function bumpInput(input,delta){
  // an empty field starts from the ghost (previous session) value, not from 0
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

/* ───── live record feedback under the sets ───── */
function liveBadgeText(s){
  const suffix=s.cls==='record'?'':` · record ${fmt(s.best)}${s.unit}`;
  switch(s.cls){
    case'record':return`🏆 ${L('Νέο record','New record')} · +${fmt(s.delta)}${s.unit}`;
    case'up':return`▲ ${L('Πάνω','Up')} · +${fmt(s.delta)}${s.unit}${suffix}`;
    case'down':return`▼ ${L('Κάτω','Down')} · −${fmt(Math.abs(s.delta))}${s.unit}${suffix}`;
    default:return`${s.unit==='kg'?L('= Ίδια κιλά','= Same weight'):L('= Ίδια reps','= Same reps')}${suffix}`;
  }
}
function markRecordRow(idx){
  [...sets.children].forEach((r,i)=>{
    const num=r.querySelector('.setNum');
    if(i===idx){
      num.textContent='✓';num.classList.add('rec');
      if(num.dataset.rec!=='on'){num.classList.remove('pop');void num.offsetWidth;num.classList.add('pop');num.dataset.rec='on'}
    }else{num.textContent=i+1;num.classList.remove('rec','pop');delete num.dataset.rec}
  });
}
function updateLiveStatus(){
  const box=$('#liveStatus');
  const relevant=logs.filter(x=>x.exercise===exercise.value&&x.id!==editingId);
  if(!relevant.length){box.hidden=true;renumber();return}
  const prevEntry=relevant.slice().sort(byNewest)[0];
  const weighted=isWeighted(prevEntry),unitStr=weighted?'kg':'reps',valOf=v=>weighted?v.kg:v.reps;
  // a weighted exercise isn't compared until the row has kg — reps alone would read as "0 kg, way down"
  const filled=[...sets.querySelectorAll('tr')].map((r,i)=>({i,kg:Number(r.querySelector('.kg').value)||0,reps:Number(r.querySelector('.reps').value)||0})).filter(v=>v.reps>0&&(!weighted||v.kg>0));
  if(!filled.length){box.hidden=true;renumber();return}
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
  unlockAudio();   // this tap lets the rest-timer chime play later
  if(!exercise.value)return alert(L('Πρόσθεσε πρώτα μια άσκηση.','Add an exercise first.'));
  const data=[...sets.querySelectorAll('tr')].map(r=>({kg:Number(r.querySelector('.kg').value),reps:Number(r.querySelector('.reps').value)})).filter(s=>s.kg>=0&&s.reps>0);
  if(!data.length)return alert(L('Βάλε τουλάχιστον ένα set με επαναλήψεις.','Add at least one set with reps.'));
  const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),created:Date.now(),date:date.value||today(),time:validTime(timeIn.value)?timeIn.value:undefined,group:group.value,exercise:exercise.value,sets:data,notes:$('#notes').value.trim()};
  const i=editingId?logs.findIndex(x=>x.id===editingId):-1;
  if(i>=0){entry.id=logs[i].id;entry.created=logs[i].created;logs[i]=entry}else logs.push(entry);
  persist();
  const st=computeStatuses().get(entry.id),wasEdit=i>=0;
  // on to the next exercise of today's plan, if there is one
  const nextEx=!wasEdit&&entry.date===today()?nextPlannedExercise(entry.group):null;
  if(nextEx)fillExercises(nextEx);
  resetForm();renderHistory();checkBackup();renderReadyHint();renderHome();
  if(st.cls==='record'){confetti();navigator.vibrate?.([40,60,40,60,120]);toast(`${badgeText(st)} · ${entry.exercise}`)}
  else toast(wasEdit?L('✅ Ενημερώθηκε','✅ Updated'):`✅ ${L('Αποθηκεύτηκε','Saved')} · ${badgeText(st)}${nextEx?` → ${nextEx}`:''}`);
  if(!wasEdit&&settings.restAuto)startTimer(settings.restDefault);
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
  if(!confirm(L(`Να αφαιρεθεί η άσκηση "${ex}" από τη λίστα; Οι καταγραφές της μένουν στο ιστορικό.`,`Remove "${ex}" from the list? Its entries stay in History.`)))return;
  exercises[group.value]=exercises[group.value].filter(x=>x!==ex);persist();fillExercises();
};

/* ───── rest timer ─────
   The chime is made with Web Audio. On iPhone the page asks for a "transient" audio session,
   so music (Spotify, Apple Music) ducks while it plays instead of covering it, and the chime
   itself is loud, low-pitched and repeated so it cuts through. */
let timerEnd=0,timerTotal=0,timerInt=null,audioCtx=null;
function unlockAudio(){
  try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume()}catch{}
}
function startTimer(sec){
  unlockAudio();
  timerTotal=sec;timerEnd=Date.now()+sec*1000;
  clearInterval(timerInt);timerInt=setInterval(tickTimer,250);
  $('#timerPill').hidden=false;tickTimer();
  document.querySelectorAll('.timerChip').forEach(b=>b.classList.toggle('on',Number(b.dataset.sec)===sec));
}
function stopTimer(){clearInterval(timerInt);timerInt=null;timerEnd=0;$('#timerPill').hidden=true;document.querySelectorAll('.timerChip').forEach(b=>b.classList.remove('on'))}
function tickTimer(){
  if(!timerEnd)return;
  const left=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));
  $('#timerLeft').textContent=`${Math.floor(left/60)}:${pad(left%60)}`;
  $('#timerBar').style.width=`${Math.max(0,Math.min(100,left/timerTotal*100))}%`;
  if(!left){
    // back from the background long after it ended: no chime, just clear it
    const late=Date.now()-timerEnd>15000;
    stopTimer();
    if(late)return;
    navigator.vibrate?.([300,120,300,120,300]);chime();
    toast(L('⏱ Τέλος ξεκούρασης — επόμενο set!','⏱ Rest is over — next set!'));
  }
}
function chime(){
  if(!settings.restSound||!audioCtx)return;
  try{if(navigator.audioSession)navigator.audioSession.type='transient'}catch{}   // Safari: duck the music while we play
  audioCtx.resume?.();
  const t0=audioCtx.currentTime+.05,out=audioCtx.createDynamicsCompressor();
  out.connect(audioCtx.destination);
  // three rising two-tone notes, twice — lower notes carry better over music than a thin 880 Hz beep
  [0,1.1].forEach(rep=>[[0,660],[.22,880],[.44,1175]].forEach(([dt,f],k)=>{
    const t=t0+rep+dt;
    [f,f*1.5].forEach((freq,j)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type=j?'sine':'triangle';o.frequency.value=freq;
      const peak=(j?.35:.9)*(k===2?1:.85);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+(k===2?.55:.2));
      o.connect(g);g.connect(out);o.start(t);o.stop(t+.6);
    });
  }));
  setTimeout(()=>{try{if(navigator.audioSession)navigator.audioSession.type='auto'}catch{}},2600);
}
document.querySelectorAll('.timerChip').forEach(b=>b.onclick=()=>{const s=Number(b.dataset.sec);settings.restDefault=s;persist();startTimer(s)});
$('#timerStop').onclick=stopTimer;
$('#timerPlus').onclick=()=>{timerEnd+=30000;timerTotal+=30;tickTimer()};

/* log screen: one tap on a rested group picks it */
function renderReadyHint(){
  const r=groupRecovery(),ready=Object.entries(r).filter(([,x])=>x.status==='ready').sort((a,b)=>b[1].hours-a[1].hours).map(([g])=>g).filter(g=>exercises[g]).slice(0,4);
  $('#readyHint').hidden=!ready.length;
  $('#readyHint').innerHTML=ready.length?`<span>🟢 ${L('Έτοιμα σήμερα','Ready today')}</span>${ready.map(g=>`<button type="button" class="chip" data-ready="${escapeHtml(g)}" style="--c:${groupColor(g)}">${escapeHtml(gName(g))}</button>`).join('')}`:'';
}
$('#readyHint').onclick=e=>{const b=e.target.closest('[data-ready]');if(!b)return;startGroup(b.dataset.ready)};
