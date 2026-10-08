/* ───── Workout plan: what you train each weekday, the home card ("Today / Tomorrow") and the month calendar ───── */
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ς/g,'σ').trim();
const emptyDays=()=>Array.from({length:7},()=>({groups:[],exercises:[]}));

const DAY_WORDS=[
  ['δευτερα','δευ','monday','mon'],['τριτη','τρι','tuesday','tue','tues'],['τεταρτη','τετ','wednesday','wed'],
  ['πεμπτη','πεμ','thursday','thu','thur','thurs'],['παρασκευη','παρ','friday','fri'],['σαββατο','σαβ','saturday','sat'],['κυριακη','κυρ','sunday','sun'],
];
const GROUP_WORDS=[
  ['Chest',['στηθοσ','στηθουσ','chest','pecs','pec']],
  ['Lats',['ραχιαιοι','ραχιαιουσ','ραχιαιο','ραχιαιων','lats','lat']],
  ['Back',['πλατη','πλατησ','back','traps','τραπεζοειδεισ']],
  ['Shoulders',['ωμοι','ωμουσ','ωμων','shoulders','shoulder','delts','δελτοειδεισ']],
  ['Biceps',['δικεφαλα','δικεφαλουσ','biceps','bis']],
  ['Triceps',['τρικεφαλα','τρικεφαλουσ','τρικεφαλοι','triceps','tris']],
  ['Legs',['ποδια','ποδιων','legs','leg','quads','hamstrings','glutes','γλουτοι','τετρακεφαλοι','γαμπεσ','calves']],
  ['Abs',['κοιλιακοι','κοιλιακουσ','κοιλιακα','abs','core']],
];
const COMBOS=[
  [['push','ωθηση'],['Chest','Shoulders','Triceps']],[['pull','ελξη'],['Back','Lats','Biceps']],
  [['upper','ανω κορμοσ','ανω σωμα','πανω σωμα'],['Chest','Back','Lats','Shoulders','Biceps','Triceps']],
  [['lower','κατω κορμοσ','κατω σωμα'],['Legs','Abs']],[['full body','fullbody','ολοσωμη','ολοσωμο'],['Chest','Back','Legs','Shoulders']],
];
const REST_WORDS=['rest','off','ξεκουραση','ρεπο','αποθεραπεια','recovery'];

const dayOf=w=>DAY_WORDS.findIndex(ws=>ws.includes(norm(w).replace(/[.:,]/g,'')));
function groupsIn(text){
  const n=` ${norm(text).replace(/[^\p{L}\p{N}]+/gu,' ')} `,found=new Set();
  COMBOS.forEach(([ws,gs])=>{if(ws.some(w=>n.includes(` ${w} `)))gs.forEach(g=>found.add(g))});
  GROUP_WORDS.forEach(([g,ws])=>{if(ws.some(w=>n.includes(` ${w} `)))found.add(g)});
  Object.keys(exercises).filter(g=>!GROUP_ORDER.includes(g)).forEach(g=>{if(n.includes(` ${norm(g)} `))found.add(g)});
  return orderedGroups([...found]);
}
/** "Bench Press 4x8-10" → {name, sets, reps} */
function parseExerciseLine(line){
  const clean=line.replace(/^\s*([-*•·▪–]|\d+[.)])\s*/,'').trim();if(!clean)return null;
  const m=clean.match(/^(.*?)[\s:–-]*(\d{1,2})\s*[x×χΧ*]\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)\s*(reps|επαν\.?|επαναληψεισ)?\s*$/i);
  if(m&&m[1].trim())return{name:m[1].trim(),sets:Number(m[2]),reps:m[3].replace(/\s/g,'').replace('–','-')};
  return{name:clean};
}
const exText=e=>`${e.name}${e.sets?` ${e.sets}x${e.reps||''}`:''}`;
const findGroupOf=name=>Object.keys(exercises).find(g=>exercises[g].some(n=>norm(n)===norm(name)));
/** planned exercises not in your list yet go under the day's first group */
function addPlanExercises(p){
  p.days.forEach(d=>{const g=d.groups[0];if(!g)return;d.exercises.forEach(e=>{if(findGroupOf(e.name))return;(exercises[g]||(exercises[g]=[])).push(e.name)})});
}

/** One day per line ("Δευτέρα: Στήθος, Τρικέφαλα"), exercises below it ("- Bench Press 4x8"); or our own JSON. */
function importPlan(text){
  text=String(text||'').trim();if(!text)return null;
  if(text.startsWith('{')){
    try{
      const j=JSON.parse(text),days=j.training?.days||j.days;
      if(Array.isArray(days)&&days.length===7)return{days:days.map(d=>({groups:Array.isArray(d?.groups)?d.groups.map(String):[],exercises:Array.isArray(d?.exercises)?d.exercises.filter(e=>e&&e.name).map(e=>({name:String(e.name),sets:Number(e.sets)||undefined,reps:e.reps?String(e.reps):undefined})):[]})),since:today()};
    }catch{}
    return null;
  }
  const days=emptyDays();let cur=-1,found=0;
  text.split(/\r?\n/).forEach(raw=>{
    const line=raw.trim();if(!line)return;
    const head=line.match(/^([\p{L}.]+)\s*[:–\-—]?\s*(.*)$/u),d=head?dayOf(head[1]):-1;
    if(d>=0){
      cur=d;found++;
      const rest=head[2],isRest=REST_WORDS.some(w=>norm(rest).includes(w));
      days[d]={groups:isRest?[]:groupsIn(rest),exercises:[]};
      return;
    }
    if(cur<0)return;
    const ex=parseExerciseLine(line);if(ex)days[cur].exercises.push(ex);
  });
  if(!found)return null;
  // exercises without a group line: take the groups from your exercise list
  days.forEach(day=>{if(day.groups.length||!day.exercises.length)return;day.groups=orderedGroups(day.exercises.map(e=>findGroupOf(e.name)).filter(Boolean))});
  return{days,since:today()};
}

const PRESETS={
  ppl:{name:'Push / Pull / Legs',days:[['Chest','Shoulders','Triceps'],['Back','Lats','Biceps'],['Legs','Abs'],[],['Chest','Shoulders','Triceps'],['Back','Lats','Biceps'],[]]},
  ul:{name:'Upper / Lower',days:[['Chest','Back','Lats','Shoulders'],['Legs','Abs'],[],['Chest','Back','Biceps','Triceps'],['Legs','Abs'],[],[]]},
  bro:{name:L('Μία ομάδα τη μέρα','One group a day'),days:[['Chest'],['Back','Lats'],['Shoulders','Abs'],['Legs'],['Biceps','Triceps'],[],[]]},
  full:{name:'Full body 3×',days:[['Chest','Back','Legs'],[],['Shoulders','Lats','Legs'],[],['Chest','Back','Biceps','Triceps'],[],[]]},
};

const planFor=d=>training?training.days[weekdayIdx(d)]:null;
function planProgress(day,d=today()){
  if(!day||!day.groups.length)return{done:[],total:0};
  const trained=new Set(logs.filter(l=>l.date===d).map(l=>l.group));
  return{done:day.groups.filter(g=>trained.has(g)),total:day.groups.length};
}
function nextTraining(from=today()){
  if(!training)return null;
  for(let i=1;i<=7;i++){const d=addDays(from,i),p=planFor(d);if(p?.groups.length)return{offset:i,date:d,day:p}}
  return null;
}
/** planned exercise for today matching this name, if any */
const plannedToday=ex=>planFor(today())?.exercises.find(e=>norm(e.name)===norm(ex));
/** next planned exercise of a group that you haven't logged today */
function nextPlannedExercise(g){
  const day=planFor(today());if(!day)return null;
  const done=new Set(logs.filter(l=>l.date===today()).map(l=>norm(l.exercise)));
  return day.exercises.find(e=>findGroupOf(e.name)===g&&!done.has(norm(e.name))&&exercises[g]?.some(n=>norm(n)===norm(e.name)))?.name||null;
}
/** planned days you trained on during the last 4 weeks (since the plan started) */
function planAdherence(){
  if(!training)return null;
  const t=today();let planned=0,hit=0;
  for(let d=[training.since||t,addDays(t,-28)].sort()[1];d<t;d=addDays(d,1)){const p=planFor(d);if(!p?.groups.length)continue;planned++;if(logs.some(l=>l.date===d))hit++}
  return planned?{planned,hit}:null;
}

/* ───── month grid ("Stay consistent"): trained days fill green, view-only ───── */
function monthGridHtml(ym,trained,{title=true,small=false}={}){
  const[y,m]=ym.split('-').map(Number),first=`${ym}-01`,daysIn=new Date(y,m,0).getDate(),lead=weekdayIdx(first),t=today();
  let cells='';
  for(let i=0;i<lead;i++)cells+='<i class="mc empty"></i>';
  for(let i=0;i<daysIn;i++){
    const d=addDays(first,i),on=trained.has(d);
    cells+=`<i class="mc${on?' on':''}${d===t?' today':''}${d>t?' future':''}"${on?` style="--g:${trained.get?.(d)||'var(--brand)'}"`:''}>${i+1}</i>`;
  }
  const head=title?`<div class="mcTitle">${monthNom(ym,y!==new Date().getFullYear())}</div>`:'';
  return`<div class="monthGrid${small?' small':''}">${head}<div class="mcGrid">${cells}</div></div>`;
}
const weekdayHead=()=>`<div class="mcGrid mcHead">${[0,1,2,3,4,5,6].map(i=>`<b>${dayName(i,'narrow')}</b>`).join('')}</div>`;
/** "Οκτώβριος" (nominative; Greek month:'long' alone gives the genitive "Οκτωβρίου") */
const monthNom=(ym,withYear)=>{const t=parseDay(ym+'-01').toLocaleDateString(LOC,{month:'long',year:'numeric'});return cap(withYear?t:t.replace(/\s*\d{4}$/,''))};
const monthKeyOf=(off=0)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+off);return`${d.getFullYear()}-${pad(d.getMonth()+1)}`};

/* ───── home card on the log screen ───── */
let homeMonthOff=0;
function renderHome(){
  const t=today(),h=new Date().getHours();
  $('#helloTxt').textContent=h<12?L('Καλημέρα','Good morning'):h<18?L('Καλό απόγευμα','Good afternoon'):L('Καλησπέρα','Good evening');
  $('#todayDate').textContent=cap(longDate(t));
  const day=planFor(t),pr=planProgress(day),next=nextTraining(t),trainedToday=new Set(logs.filter(l=>l.date===t).map(l=>norm(l.exercise)));
  let html='';
  if(!training){
    html=`<div class="hero empty"><b>${L('🗓️ Πρόγραμμα προπόνησης','🗓️ Workout plan')}</b><span>${L('Όρισε τι γυμνάζεις κάθε μέρα (ή κάνε import το πρόγραμμα του γυμναστή σου) και θα βλέπεις εδώ «Αύριο: Πλάτη · Δικέφαλα».','Set what you train each day (or import your coach’s plan) and you’ll see "Tomorrow: Back · Biceps" here.')}</span><button type="button" class="secondary small" data-open-training>${L('Στήσε το πρόγραμμα','Set up your plan')}</button></div>`;
  }else{
    const nextG=day?.groups.find(g=>!pr.done.includes(g));
    html=`<div class="hero"><small>${L('Σήμερα','Today')}</small>`;
    if(day?.groups.length){
      html+=`<b class="heroTitle">${day.groups.map(gName).join(' · ')}</b>`;
      if(day.exercises.length)html+=`<ul class="heroEx">${day.exercises.slice(0,8).map(e=>`<li class="${trainedToday.has(norm(e.name))?'done':''}">${escapeHtml(e.name)}${e.sets?` <em>${e.sets}×${escapeHtml(e.reps||'')}</em>`:''}</li>`).join('')}</ul>`;
      if(pr.done.length)html+=`<div class="heroProg"><span>${pr.done.length===pr.total?L('✓ Ολοκληρώθηκε σήμερα','✓ Done today'):L(`${pr.done.length}/${pr.total} ομάδες έγιναν`,`${pr.done.length}/${pr.total} groups done`)}</span><div class="wBar"><i style="width:${pr.done.length/pr.total*100}%"></i></div></div>`;
      if(nextG)html+=`<button type="button" class="heroBtn" data-start="${escapeHtml(nextG)}">${pr.done.length?L('Συνέχισε','Continue'):L('Ξεκίνα','Start')} · ${escapeHtml(gName(nextG))}</button>`;
    }else html+=`<b class="heroTitle">${L('Μέρα ξεκούρασης 😴','Rest day 😴')}</b><span class="heroSub">${L('Οι μύες χτίζονται όταν ξεκουράζονται. Περπάτημα και νερό σήμερα.','Muscles grow while you rest. A walk and plenty of water today.')}</span>`;
    if(next)html+=`<div class="heroNext"><small>${next.offset===1?L('Αύριο','Tomorrow'):`${L('Επόμενη','Next')} · ${cap(dayName(weekdayIdx(next.date)))}`}</small><b>${next.day.groups.map(gName).join(' · ')}</b></div>`;
    html+='</div>';
  }
  $('#planToday').innerHTML=html;

  // this week: planned groups as dots, ✓ where you trained
  const ws=weekStart(t),w=weekData(),kcal=kcalSum(w.ls);
  $('#weekPlanHead').innerHTML=`<span>${L('Εβδομάδα','This week')}</span><b>${w.days.size}/${settings.goalWorkouts}</b> ${L('προπονήσεις','workouts')}${kcal?` · 🔥 <b>${fmtN(kcal)}</b> kcal`:''}`;
  $('#weekPlan').innerHTML=[0,1,2,3,4,5,6].map(i=>{
    const d=addDays(ws,i),p=training?.days[i],gs=[...new Set(logs.filter(l=>l.date===d).map(l=>l.group))];
    const dots=(p?.groups.length?p.groups:gs).slice(0,4).map(g=>`<i style="background:${groupColor(g)}"></i>`).join('');
    return`<div class="wpDay${d===t?' today':''}${gs.length?' done':''}${d>t?' future':''}"><span>${dayName(i,'narrow')}</span><div class="wpDot">${gs.length?'✓':parseDay(d).getDate()}</div><div class="wpGroups">${dots}</div></div>`;
  }).join('');

  // the coach's most important note
  const top=coachInsights().find(x=>x.kind!=='goal'&&x.kind!=='start');
  $('#coachLine').innerHTML=top?`<button type="button" class="coachLine ${top.tone}" data-goto-stats>🤖 <b>${escapeHtml(insightText(top)[0])}</b><span>›</span></button>`:'';

  // month calendar (collapsible, remembered)
  const ym=monthKeyOf(homeMonthOff),tr=new Map(logs.map(l=>[l.date,'var(--brand)']));
  const n=[...new Set(logs.filter(l=>l.date.startsWith(ym)).map(l=>l.date))].length;
  $('#homeCal').open=!!settings.homeCal;
  $('#homeCalSum').innerHTML=`📅 ${L('Συνέπεια','Consistency')} <span>· ${monthNom(ym)}: ${n} ${n===1?L('μέρα','day'):L('μέρες','days')}</span>`;
  $('#homeMonth').innerHTML=`<div class="mcNav"><button type="button" class="secondary small" data-mon="-1" aria-label="${L('Προηγούμενος μήνας','Previous month')}">‹</button><b>${cap(parseDay(ym+'-01').toLocaleDateString(LOC,{month:'long',year:'numeric'}))}</b><button type="button" class="secondary small" data-mon="1" ${homeMonthOff>=0?'disabled':''} aria-label="${L('Επόμενος μήνας','Next month')}">›</button></div>${weekdayHead()}${monthGridHtml(ym,tr,{title:false})}`;
}
$('#todayCard').addEventListener('click',e=>{
  if(e.target.closest('[data-open-training]')||e.target.closest('#planEditBtn'))return openTraining();
  if(e.target.closest('[data-goto-stats]')){switchTab('stats');return}
  const s=e.target.closest('[data-start]');
  if(s){startGroup(s.dataset.start);return}
  const m=e.target.closest('[data-mon]');
  if(m){homeMonthOff=Math.min(0,homeMonthOff+Number(m.dataset.mon));renderHome()}
});
$('#homeCal').addEventListener('toggle',()=>{if(settings.homeCal!==$('#homeCal').open){settings.homeCal=$('#homeCal').open;persist()}});
/** pick a group (and its next planned exercise) in the form and scroll to it */
function startGroup(g){
  if(!exercises[g])exercises[g]=[];
  fillGroups(g);
  const ex=nextPlannedExercise(g);if(ex)fillExercises(ex);
  $('#logCard').scrollIntoView({behavior:'smooth',block:'start'});
}

/* ───── plan editor ───── */
const trainingDlg=$('#trainingDialog');
function openTraining(){renderTrainingEditor();trainingDlg.showModal()}
function ensureTraining(){if(!training)training={days:emptyDays(),since:today()};return training}
function renderTrainingEditor(){
  const days=training?.days||emptyDays();
  $('#trainingDays').innerHTML=days.map((d,i)=>`<div class="dayEdit" data-day="${i}">
    <div class="dayEditHead"><b>${cap(dayName(i))}</b><span>${d.groups.length?d.groups.map(gName).join(' · '):L('Ξεκούραση','Rest')}</span></div>
    <div class="chips wrap">${orderedGroups().map(g=>`<button type="button" class="chip${d.groups.includes(g)?' on':''}" data-g="${escapeHtml(g)}" style="--c:${groupColor(g)}">${escapeHtml(gName(g))}</button>`).join('')}</div>
    ${d.groups.length?`<textarea rows="${Math.max(2,d.exercises.length+1)}" data-ex placeholder="${L('Ασκήσεις (προαιρετικά), μία ανά γραμμή: Bench Press 4x8','Exercises (optional), one per line: Bench Press 4x8')}">${escapeHtml(d.exercises.map(exText).join('\n'))}</textarea>`:''}
  </div>`).join('');
  $('#trainingClear').hidden=!training;$('#trainingShare').hidden=!training;
}
$('#trainingDays').addEventListener('click',e=>{
  const b=e.target.closest('[data-g]');if(!b)return;
  const i=Number(b.closest('[data-day]').dataset.day),day=ensureTraining().days[i],g=b.dataset.g;
  day.groups=day.groups.includes(g)?day.groups.filter(x=>x!==g):orderedGroups([...day.groups,g]);
  persist();renderTrainingEditor();
});
$('#trainingDays').addEventListener('change',e=>{
  const ta=e.target.closest('[data-ex]');if(!ta)return;
  const day=ensureTraining().days[Number(ta.closest('[data-day]').dataset.day)];
  day.exercises=ta.value.split(/\r?\n/).map(parseExerciseLine).filter(Boolean);
  addPlanExercises(training);persist();
});
$('#trainingPresets').addEventListener('click',e=>{
  const b=e.target.closest('[data-preset]');if(!b)return;
  if(training&&training.days.some(d=>d.groups.length)&&!confirm(L('Να αντικατασταθεί το τωρινό πρόγραμμα;','Replace your current plan?')))return;
  const p=PRESETS[b.dataset.preset];
  training={name:p.name,since:today(),days:p.days.map(gs=>({groups:[...gs],exercises:[]}))};
  persist();renderTrainingEditor();toast(`✅ ${p.name}`);
});
function doImport(text){
  const p=importPlan(text);
  if(!p)return toast(L('Δεν βρήκα μέρες. Γράψε π.χ. «Δευτέρα: Στήθος, Τρικέφαλα».','No days found. Write e.g. "Monday: Chest, Triceps".'));
  if(training&&training.days.some(d=>d.groups.length)&&!confirm(L('Να αντικατασταθεί το τωρινό πρόγραμμα;','Replace your current plan?')))return;
  training=p;addPlanExercises(p);persist();fillGroups(group.value);renderTrainingEditor();
  $('#trainingImportText').value='';
  const dn=p.days.filter(d=>d.groups.length).length,en=p.days.reduce((a,d)=>a+d.exercises.length,0);
  toast(L(`✅ Πρόγραμμα: ${dn} μέρες προπόνησης, ${en} ασκήσεις`,`✅ Plan: ${dn} training days, ${en} exercises`));
}
$('#trainingImportBtn').onclick=()=>doImport($('#trainingImportText').value);
$('#trainingFileBtn').onclick=()=>$('#trainingFile').click();
$('#trainingFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)doImport(await f.text())};
$('#trainingShare').onclick=async()=>{
  if(!training)return;
  const txt=training.days.map((d,i)=>[`${cap(dayName(i))}: ${d.groups.length?d.groups.map(gName).join(', '):L('Ξεκούραση','Rest')}`,...d.exercises.map(e=>`- ${exText(e)}`)].join('\n')).join('\n');
  try{if(navigator.share)await navigator.share({title:L('Πρόγραμμα προπόνησης','Workout plan'),text:txt});else{await navigator.clipboard.writeText(txt);toast(L('📋 Αντιγράφηκε','📋 Copied'))}}catch{}
};
$('#trainingClear').onclick=()=>{
  if(!confirm(L('Να διαγραφεί το πρόγραμμα προπόνησης;','Delete your workout plan?')))return;
  training=null;persist();renderTrainingEditor();
};
const closeTraining=()=>{trainingDlg.close()};
trainingDlg.querySelectorAll('[data-training-close]').forEach(b=>b.onclick=closeTraining);
trainingDlg.addEventListener('close',()=>{
  // a plan with no training days at all is no plan
  if(training&&!training.days.some(d=>d.groups.length)){training=null;persist()}
  renderHome();
});
