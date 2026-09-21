const defaults={"Chest":["Bench Press","Incline Dumbbell Press","Chest Press","Cable Fly"],"Back":["Lat Pulldown","Seated Cable Row","Chest Supported Row","One Arm Dumbbell Row"],"Shoulders":["Shoulder Press","Lateral Raise","Rear Delt Fly"],"Biceps":["Barbell Curl","Dumbbell Curl","Hammer Curl"],"Triceps":["Cable Pushdown","Overhead Extension","Skull Crusher"],"Legs":["Leg Press","Leg Extension","Leg Curl","Romanian Deadlift","Calf Raise"],"Abs":["Cable Crunch","Leg Raise","Plank"]};
let exercises=JSON.parse(localStorage.getItem('wt_exercises')||'null')||defaults;let logs=JSON.parse(localStorage.getItem('wt_logs')||'[]');
const $=s=>document.querySelector(s),group=$('#group'),exercise=$('#exercise'),sets=$('#sets'),date=$('#date');date.value=new Date().toISOString().slice(0,10);

function persist(){localStorage.setItem('wt_exercises',JSON.stringify(exercises));localStorage.setItem('wt_logs',JSON.stringify(logs))}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatDate(d){return new Date(d+'T12:00:00').toLocaleDateString('el-GR')}
function fmt(n){return String(Number(n.toFixed(2)))}

function fillGroups(){group.innerHTML=Object.keys(exercises).map(g=>`<option>${escapeHtml(g)}</option>`).join('');fillExercises()}
function fillExercises(){exercise.innerHTML=exercises[group.value].map(x=>`<option>${escapeHtml(x)}</option>`).join('');showLast();renderHistory()}
function addSet(kg='',reps=''){let n=sets.children.length+1;sets.insertAdjacentHTML('beforeend',`<tr><td>${n}</td><td><input class="setInput kg" inputmode="decimal" type="number" step="0.5" min="0" value="${kg}"></td><td><input class="setInput reps" inputmode="numeric" type="number" min="0" value="${reps}"></td><td><button class="remove" aria-label="remove">✕</button></td></tr>`)}
function renumber(){[...sets.children].forEach((r,i)=>r.children[0].textContent=i+1)}
function showLast(){let l=logs.filter(x=>x.exercise===exercise.value).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created)[0];$('#last').textContent=l?`Τελευταία φορά (${formatDate(l.date)}): `+l.sets.map(s=>`${s.kg}kg × ${s.reps}`).join('  •  '):'Δεν υπάρχει προηγούμενη καταγραφή.'}

/* Sector-style status: compares the top set (kg) of each session with the previous
   session of the same exercise, and with the best of all earlier sessions.
   record = new all-time best (purple), up = higher than last time (green),
   down = lower than last time (yellow), same/first = neutral. */
function computeStatuses(){
  const result=new Map(),state={};
  [...logs].sort((a,b)=>a.date.localeCompare(b.date)||(a.created||0)-(b.created||0)).forEach(l=>{
    const top=Math.max(...l.sets.map(s=>s.kg));
    const st=state[l.exercise]||(state[l.exercise]={prev:null,best:null});
    let cls='first',delta=0;
    if(st.prev!==null){
      delta=top-st.prev;
      if(top>st.best)cls='record';
      else if(top>st.prev)cls='up';
      else if(top<st.prev)cls='down';
      else cls='same';
    }
    result.set(l.id,{cls,delta,top});
    st.prev=top;st.best=st.best===null?top:Math.max(st.best,top);
  });
  return result;
}
function badgeText(s){
  switch(s.cls){
    case'record':return`🏆 Record +${fmt(s.delta)}kg`;
    case'up':return`▲ +${fmt(s.delta)}kg`;
    case'down':return`▼ −${fmt(Math.abs(s.delta))}kg`;
    case'same':return'= Ίδια κιλά';
    default:return'Πρώτη καταγραφή';
  }
}

function renderHistory(){
  const status=computeStatuses();
  let arr=logs.filter(x=>x.group===group.value).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);
  $('#history').innerHTML=arr.length?arr.map(x=>{
    const s=status.get(x.id),topIdx=x.sets.findIndex(t=>t.kg===s.top);
    return`<div class="historyItem ${s.cls}"><div class="historyTop"><div><div class="historyTitle">${escapeHtml(x.exercise)}</div><div class="historyMeta">${formatDate(x.date)} · ${escapeHtml(x.group)}</div><span class="badge">${badgeText(s)}</span></div><button class="remove deleteLog" data-id="${x.id}" aria-label="Διαγραφή">✕</button></div><div class="historySets">${x.sets.map((t,i)=>`<span class="pill${i===topIdx?' top':''}"><small>S${i+1}</small>${t.kg}kg × ${t.reps}</span>`).join('')}</div>${x.notes?`<div class="historyNotes">📝 ${escapeHtml(x.notes)}</div>`:''}</div>`;
  }).join(''):'<div class="empty">Καμία καταγραφή σε αυτή τη μυϊκή ομάδα.</div>';
}

group.onchange=fillExercises;exercise.onchange=showLast;$('#addSetBtn').onclick=()=>addSet();sets.onclick=e=>{if(e.target.classList.contains('remove')){e.target.closest('tr').remove();renumber()}};
$('#saveBtn').onclick=()=>{let data=[...sets.querySelectorAll('tr')].map(r=>({kg:Number(r.querySelector('.kg').value),reps:Number(r.querySelector('.reps').value)})).filter(s=>s.kg>=0&&s.reps>0);if(!data.length)return alert('Βάλε τουλάχιστον ένα set με επαναλήψεις.');logs.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),created:Date.now(),date:date.value,group:group.value,exercise:exercise.value,sets:data,notes:$('#notes').value.trim()});persist();showLast();renderHistory();sets.innerHTML='';$('#notes').value='';addSet();addSet();addSet();};
$('#history').onclick=e=>{if(e.target.classList.contains('deleteLog')&&confirm('Διαγραφή αυτής της καταγραφής;')){logs=logs.filter(x=>x.id!==e.target.dataset.id);persist();showLast();renderHistory()}};
$('#clearBtn').onclick=()=>{if(confirm('Να διαγραφεί ΟΛΟ το ιστορικό;')){logs=[];persist();showLast();renderHistory()}};
const dlg=$('#exerciseDialog');$('#addExerciseBtn').onclick=()=>{ $('#newExercise').value='';dlg.showModal()};$('#confirmExercise').onclick=e=>{e.preventDefault();let n=$('#newExercise').value.trim();if(!n)return;if(!exercises[group.value].includes(n))exercises[group.value].push(n);persist();fillExercises();exercise.value=n;showLast();dlg.close()};
$('#exportBtn').onclick=()=>{let blob=new Blob([JSON.stringify({exercises,logs},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='workout-tracker-backup.json';a.click();URL.revokeObjectURL(a.href)};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');fillGroups();addSet();addSet();addSet();
