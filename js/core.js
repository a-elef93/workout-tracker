/* ───── GymPilot core: data, helpers, metrics, calories, coach ───── */
const GROUP_ORDER=['Chest','Back','Lats','Shoulders','Biceps','Triceps','Legs','Abs'];
const defaults={"Chest":["Bench Press","Incline Dumbbell Press","Chest Press","Cable Fly"],"Back":["Seated Cable Row","Chest Supported Row","One Arm Dumbbell Row","Deadlift"],"Lats":["Lat Pulldown","Pull-up","Straight-Arm Pulldown","Single-Arm Lat Row"],"Shoulders":["Shoulder Press","Lateral Raise","Rear Delt Fly"],"Biceps":["Barbell Curl","Dumbbell Curl","Hammer Curl"],"Triceps":["Cable Pushdown","Overhead Extension","Skull Crusher"],"Legs":["Leg Press","Leg Extension","Leg Curl","Romanian Deadlift","Calf Raise"],"Abs":["Cable Crunch","Leg Raise","Plank"]};
const GROUP_COLORS={Chest:'#d9734e',Back:'#2a9d8f',Lats:'#3f7fb6',Shoulders:'#e0a336',Biceps:'#3fb56b',Triceps:'#7a9e3f',Legs:'#6a7fa0',Abs:'#c98b6b'};
const EXTRA_COLORS=['#b5835a','#3e8e7e','#9aa84a','#a0522d','#6f8f72'];

function load(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
let exercises=load('wt_exercises',null),logs=load('wt_logs',[]);
if(!isObj(exercises))exercises=structuredClone(defaults);
if(!exercises.Lats)exercises.Lats=[...defaults.Lats];   // new muscle group for people who already have data
if(!Array.isArray(logs))logs=[];
let plan=load('wt_plan',null);   // dietitian plan: daily goals + meals (the file itself lives in IndexedDB)
if(!isObj(plan)||!Array.isArray(plan.meals))plan={meals:[],kcalGoal:null,proteinGoal:null};
let food=load('wt_food',{});   // {"2026-10-04":{meals:[{id,name,kcal,protein}],extras:[{t,label,kcal,protein}]}} — checked meals are snapshots
if(!isObj(food))food={};
let weights=load('wt_weight',{});   // {"2026-10-02": 82.4} — one weigh-in per day
if(!isObj(weights))weights={};
let water=load('wt_water',{});   // {"2026-10-02":[{t,ml},…]} — each drink, so any one can be undone
if(!isObj(water))water={};
let steps=load('wt_steps',{});   // {"2026-09-28": 8234}
if(!isObj(steps))steps={};
let training=load('wt_training',null);   // weekly workout plan: {days:[7 × {groups,exercises:[{name,sets,reps}]}], since}
if(!isObj(training)||!Array.isArray(training.days)||training.days.length!==7)training=null;
let settings={goalWorkouts:4,goalSets:60,goalSteps:8000,goalWater:2500,weightGoal:null,weightGoalSetAt:null,weightGoalStart:null,lastExport:0,stepsSyncedAt:0,stepsShortcut:false,stepsLastClip:0,
  lang:null,theme:'auto',restDefault:90,restAuto:true,restSound:true,bodyweight:75,homeCal:false,...load('wt_settings',{})};
// Spotify is gone: forget its tokens and client id
try{localStorage.removeItem('wt_spotify');localStorage.removeItem('wt_sp_pkce')}catch{}
delete settings.spotifyClientId;

const $=s=>document.querySelector(s);

/* ───── helpers ───── */
const pad=n=>String(n).padStart(2,'0');
const dayKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>dayKey(new Date());
const nowTime=()=>{const d=new Date();return`${pad(d.getHours())}:${pad(d.getMinutes())}`};
const parseDay=s=>new Date(s+'T12:00:00');
const addDays=(s,n)=>{const d=parseDay(s);d.setDate(d.getDate()+n);return dayKey(d)};
const weekStart=s=>addDays(s,-((parseDay(s).getDay()+6)%7));
const weekdayIdx=s=>(parseDay(s).getDay()+6)%7;   // Monday = 0
const formatDate=d=>parseDay(d).toLocaleDateString(LOC);
const shortDate=d=>parseDay(d).toLocaleDateString(LOC,{day:'numeric',month:'short'});
const longDate=d=>parseDay(d).toLocaleDateString(LOC,{weekday:'long',day:'numeric',month:'long'});
const dayName=(i,style='long')=>parseDay(addDays('2024-01-01',i)).toLocaleDateString(LOC,{weekday:style});   // 2024-01-01 is a Monday
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&dayKey(parseDay(d))===d;
const validTime=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
/** when the workout happened: its time, else its save time that day, else nothing */
const timeOf=l=>l.time||(l.created&&dayKey(new Date(l.created))===l.date?`${pad(new Date(l.created).getHours())}:${pad(new Date(l.created).getMinutes())}`:'');
const byNewest=(a,b)=>b.date.localeCompare(a.date)||timeOf(b).localeCompare(timeOf(a))||(b.created||0)-(a.created||0);
const byOldest=(a,b)=>-byNewest(a,b);
const clamp=(v,min,max,d)=>Number.isFinite(v)&&v>0?Math.min(max,Math.max(min,Math.round(v))):d;
const groupColor=g=>GROUP_COLORS[g]||EXTRA_COLORS[[...g].reduce((a,c)=>a+c.charCodeAt(0),0)%EXTRA_COLORS.length];
/** built-in groups in their order, then your own */
const orderedGroups=(gs=Object.keys(exercises))=>{const s=new Set(gs);return[...GROUP_ORDER.filter(g=>s.has(g)),...[...s].filter(g=>!GROUP_ORDER.includes(g))]};

function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmt(n){return String(Number(n.toFixed(2)))}
const fmtN=n=>Math.round(n).toLocaleString(LOC);
const fmtKg=v=>v.toLocaleString(LOC,{maximumFractionDigits:1});
const fmtL=ml=>(ml/1000).toLocaleString(LOC,{maximumFractionDigits:2});
const fmtVol=v=>v>=1000?`${fmt(Math.round(v/100)/10)} t`:`${fmt(v)} kg`;
const plural=(n,one,many)=>`${n} ${n===1?one:many}`;

let onPersist=null;   // achievements re-check after every save
function persist(){
  try{
    localStorage.setItem('wt_exercises',JSON.stringify(exercises));
    localStorage.setItem('wt_logs',JSON.stringify(logs));
    localStorage.setItem('wt_settings',JSON.stringify(settings));
    localStorage.setItem('wt_steps',JSON.stringify(steps));
    localStorage.setItem('wt_water',JSON.stringify(water));
    localStorage.setItem('wt_weight',JSON.stringify(weights));
    localStorage.setItem('wt_plan',JSON.stringify(plan));
    localStorage.setItem('wt_food',JSON.stringify(food));
    if(training)localStorage.setItem('wt_training',JSON.stringify(training));else localStorage.removeItem('wt_training');
  }catch{toast(L('⚠️ Δεν αποθηκεύτηκε — ίσως γέμισε ο χώρος. Κάνε backup.','⚠️ Not saved — storage may be full. Make a backup.'))}
  onPersist?.();
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
const totalSets=ls=>ls.reduce((a,l)=>a+l.sets.length,0);
const setText=s=>s.kg>0?`${fmt(s.kg)}kg × ${s.reps}`:`${s.reps} reps`;

/* Sector-style status: each session's top set against the previous session of the same exercise
   and the best before it. record = new all-time best, up/down = vs last time, same, or first. */
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
    case'same':return s.unit==='kg'?L('= Ίδια κιλά','= Same weight'):L('= Ίδια reps','= Same reps');
    default:return L('Πρώτη καταγραφή','First entry');
  }
}

/* ───── weeks & streaks ───── */
function weekData(offset=0){
  const start=addDays(weekStart(today()),offset*7),end=addDays(start,6);
  const ls=logs.filter(l=>l.date>=start&&l.date<=end);
  return{start,ls,days:new Set(ls.map(l=>l.date)),sets:totalSets(ls),groups:new Set(ls.map(l=>l.group))};
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
function bestWeekStreak(){
  const per={};logs.forEach(l=>{const w=weekStart(l.date);(per[w]||(per[w]=new Set())).add(l.date)});
  let best=0,run=0,prev=null;
  Object.keys(per).sort().forEach(w=>{const ok=per[w].size>=settings.goalWorkouts;run=ok?(prev&&addDays(prev,7)===w&&run?run+1:1):0;if(ok)prev=w;best=Math.max(best,run)});
  return best;
}

/* ───── workout calories ─────
   MET × bodyweight × hours (Compendium of Physical Activities: weight training ≈ 5 MET).
   Duration: first to last save of the day when you logged live in the gym, else ~2.5 min per set (work + rest). */
const MET=5,MIN_PER_SET=2.5;
function bwAt(d){const ds=Object.keys(weights).sort();if(!ds.length)return null;const b=ds.filter(x=>x<=d);return weights[b.length?b[b.length-1]:ds[0]]}
function workoutMinutes(ls){
  if(!ls.length)return 0;
  const bySets=totalSets(ls)*MIN_PER_SET;
  const saved=ls.filter(l=>l.created&&dayKey(new Date(l.created))===l.date).map(l=>l.created);
  if(saved.length>=2){
    const first=ls.find(l=>l.created===Math.min(...saved));
    const span=(Math.max(...saved)-Math.min(...saved))/6e4+first.sets.length*MIN_PER_SET;
    if(span<=180)return Math.round(Math.max(span,bySets*.6));
  }
  return Math.round(Math.min(bySets,150));
}
function caloriesByDay(ls=logs){
  const per={},out={};
  ls.forEach(l=>(per[l.date]||(per[l.date]=[])).push(l));
  Object.entries(per).forEach(([d,items])=>{
    const minutes=workoutMinutes(items),kg=bwAt(d)??settings.bodyweight;
    out[d]={minutes,kcal:Math.round(MET*kg*minutes/60),sets:totalSets(items)};
  });
  return out;
}
const kcalSum=ls=>Object.values(caloriesByDay(ls)).reduce((a,d)=>a+d.kcal,0);
/** a workout box's share of its day's calories, by sets */
function sessionCalories(items,cal){
  const day=cal[items[0].date];if(!day||!day.sets)return{kcal:0,minutes:0};
  const share=totalSets(items)/day.sets;
  return{kcal:Math.round(day.kcal*share),minutes:Math.round(day.minutes*share)};
}

/* ───── Pilot Coach: plateaus, drops, neglected groups, balance, volume — all on the phone ───── */
const PUSH=['Chest','Shoulders','Triceps'],PULL=['Back','Lats','Biceps'];
function analyseExercise(ex){
  const ss=logs.filter(l=>l.exercise===ex).sort(byOldest);
  if(ss.length<2)return null;
  const last=ss[ss.length-1];
  if(last.date<addDays(today(),-35))return null;   // not training it any more
  const weighted=ss.some(isWeighted),val=l=>weighted?bestE1rm(l):Math.max(...l.sets.map(s=>s.reps)),u=weighted?'kg':' reps';
  let best=-Infinity,lastPR=0;
  ss.forEach((l,i)=>{if(val(l)>best+1e-9){best=val(l);lastPR=i}});
  const since=ss.length-1-lastPR,bestTxt=`${fmt(Math.round(best*2)/2)}${u}`;
  if(since===0){const prev=Math.max(...ss.slice(0,-1).map(val));return{kind:'progress',tone:'good',ex,group:last.group,delta:`+${fmt(Math.round((val(last)-prev)*2)/2)}${u}`}}
  const tail=ss.slice(-2).map(val);
  if(since>=2&&tail.every(v=>v<best*.95))return{kind:'regression',tone:'bad',ex,group:last.group,drop:Math.round((1-tail[tail.length-1]/best)*100),best:bestTxt};
  if(since<3)return null;
  const top=last.sets.reduce((a,s)=>s.kg>a.kg||(s.kg===a.kg&&s.reps>a.reps)?s:a,last.sets[0]);
  let fix='double',next='';
  if(since>=5){fix='deload';if(weighted)next=`${fmt(Math.round(topKg(last)*.9*2)/2)}kg`}
  else if(weighted&&top.reps>=10){fix='addWeight';next=`${fmt(topKg(last)+2.5)}kg`}
  else if(weighted&&top.reps<=5)fix='repRange';
  // a different move for the same muscles, the one you've done least
  const done=n=>logs.filter(l=>l.exercise===n).length;
  const swap=since>=4?(exercises[last.group]||[]).filter(n=>n!==ex).sort((a,b)=>done(a)-done(b))[0]:null;
  return{kind:'plateau',tone:'warn',ex,group:last.group,sessions:since,best:bestTxt,fix,next,swap};
}
function coachInsights(){
  if(!logs.length)return[{kind:'start',tone:'info'}];
  const out=[],t=today();
  const names=[...new Set([...logs].sort(byNewest).map(l=>l.exercise))];
  const per=names.map(analyseExercise).filter(Boolean);
  out.push(...per.filter(x=>x.kind==='regression'),...per.filter(x=>x.kind==='plateau'));
  const lastByGroup={};logs.forEach(l=>{if(!lastByGroup[l.group]||l.date>lastByGroup[l.group])lastByGroup[l.group]=l.date});
  Object.entries(lastByGroup).filter(([,d])=>d<addDays(t,-14)&&d>=addDays(t,-120)).sort((a,b)=>a[1].localeCompare(b[1])).slice(0,2)
    .forEach(([g,d])=>out.push({kind:'neglected',tone:'warn',group:g,days:Math.round((parseDay(t)-parseDay(d))/864e5)}));
  const recent=logs.filter(l=>l.date>addDays(t,-30));
  const push=totalSets(recent.filter(l=>PUSH.includes(l.group))),pull=totalSets(recent.filter(l=>PULL.includes(l.group)));
  if(push+pull>=20&&(push>pull*1.5||pull>push*1.5))out.push({kind:'balance',tone:'info',push,pull,more:push>pull?'push':'pull'});
  const ws=weekStart(t),thisWeek=totalSets(logs.filter(l=>l.date>=ws));
  const avg=[1,2,3,4].map(i=>totalSets(logs.filter(l=>l.date>=addDays(ws,-7*i)&&l.date<addDays(ws,-7*(i-1))))).reduce((a,b)=>a+b,0)/4;
  const dow=weekdayIdx(t);
  if(avg>=10&&dow>=4){const pct=Math.round((thisWeek/avg-1)*100);if(pct>=35)out.push({kind:'volumeUp',tone:'info',pct,sets:thisWeek,avg:Math.round(avg)});if(pct<=-40)out.push({kind:'volumeDown',tone:'info',pct:-pct,sets:thisWeek,avg:Math.round(avg)})}
  const doneDays=new Set(logs.filter(l=>l.date>=ws).map(l=>l.date)).size,left=7-dow;
  out.push({kind:'goal',tone:doneDays>=settings.goalWorkouts?'good':left<settings.goalWorkouts-doneDays?'warn':'info',done:doneDays,goal:settings.goalWorkouts,left});
  out.push(...per.filter(x=>x.kind==='progress'&&logs.some(l=>l.exercise===x.ex&&l.date>=addDays(t,-7))).slice(0,3));
  return out;
}
const FIX_TEXT={
  addWeight:n=>L(`Κάνεις 10+ reps στο top set: ανέβα στα ${n} και ξεκίνα από 6–8 reps.`,`You hit 10+ reps on the top set: go up to ${n} and start at 6–8 reps.`),
  repRange:()=>L('Δουλεύεις βαριά με λίγες επαναλήψεις: κάνε 3 εβδομάδες στα 8–12 reps και μετά γύρνα πίσω.','You train heavy with few reps: spend 3 weeks at 8–12 reps, then come back.'),
  deload:n=>L(`Ώρα για deload: μια εβδομάδα στο ~90%${n?` (${n})`:''} με λιγότερα sets, και μετά χτίζεις ξανά.`,`Time to deload: one week at ~90%${n?` (${n})`:''} with fewer sets, then build back up.`),
  double:()=>L('Διπλή πρόοδος: ίδια κιλά, +1 rep σε ένα set κάθε φορά· όταν φτάσεις 12 σε όλα, +2,5kg.','Double progression: same weight, +1 rep on one set each time; at 12 on every set, add 2.5kg.'),
};
function insightText(x){
  switch(x.kind){
    case'plateau':return[L(`⏸️ Plateau: ${x.ex}`,`⏸️ Plateau: ${x.ex}`),`${L(`${x.sessions} προπονήσεις χωρίς νέο καλύτερο (εκτ. 1RM ${x.best}).`,`${x.sessions} sessions without a new best (est. 1RM ${x.best}).`)} ${FIX_TEXT[x.fix](x.next)}${x.swap?' '+L(`Ή άλλαξε άσκηση για 3–4 εβδομάδες: ${x.swap}.`,`Or swap the exercise for 3–4 weeks: ${x.swap}.`):''}`];
    case'regression':return[L(`📉 Πτώση: ${x.ex}`,`📉 Dropping: ${x.ex}`),L(`Οι 2 τελευταίες είναι ${x.drop}% κάτω από το καλύτερό σου (${x.best}). Συνήθως φταίει κούραση: ύπνος, φαγητό, ή μια ελαφριά εβδομάδα.`,`Your last 2 sessions are ${x.drop}% below your best (${x.best}). Usually it’s fatigue: sleep, food, or an easier week.`)];
    case'progress':return[L(`🚀 Νέο καλύτερο: ${x.ex}`,`🚀 New best: ${x.ex}`),L(`${x.delta} από ό,τι καλύτερο είχες. Συνέχισε με το ίδιο πλάνο.`,`${x.delta} over your previous best. Keep the same plan.`)];
    case'neglected':return[L(`🕰️ ${gName(x.group)}: ${x.days} μέρες χωρίς προπόνηση`,`🕰️ ${gName(x.group)}: ${x.days} days without training`),L('Βάλ’ το στην επόμενη προπόνηση ώστε να μη χαθεί ό,τι έχτισες.','Put it in your next workout so you keep what you built.')];
    case'balance':return[L('⚖️ Ισορροπία ώθησης / έλξης','⚖️ Push / pull balance'),x.more==='push'
      ?L(`Τελευταίες 30 μέρες: ${x.push} sets ώθησης (στήθος, ώμοι, τρικέφαλα) vs ${x.pull} έλξης. Πρόσθεσε κωπηλατικές και έλξεις για υγιείς ώμους.`,`Last 30 days: ${x.push} push sets (chest, shoulders, triceps) vs ${x.pull} pull. Add rows and pulldowns for healthy shoulders.`)
      :L(`Τελευταίες 30 μέρες: ${x.pull} sets έλξης vs ${x.push} ώθησης. Πρόσθεσε λίγη ώθηση για ισορροπία.`,`Last 30 days: ${x.pull} pull sets vs ${x.push} push. Add some pushing for balance.`)];
    case'volumeUp':return[L(`📈 +${x.pct}% όγκος αυτή την εβδομάδα`,`📈 +${x.pct}% volume this week`),L(`${x.sets} sets έναντι ~${x.avg} τις προηγούμενες. Ωραία ένταση — πρόσεξε ύπνο και ξεκούραση.`,`${x.sets} sets vs ~${x.avg} in recent weeks. Great intensity — watch your sleep and recovery.`)];
    case'volumeDown':return[L(`📉 −${x.pct}% όγκος αυτή την εβδομάδα`,`📉 −${x.pct}% volume this week`),L(`${x.sets} sets έναντι ~${x.avg}. Αν είναι deload, τέλεια· αλλιώς μια προπόνηση ακόμα το διορθώνει.`,`${x.sets} sets vs ~${x.avg}. If it’s a deload, perfect; otherwise one more workout fixes it.`)];
    case'goal':return[L(`🎯 ${x.done}/${x.goal} προπονήσεις αυτή την εβδομάδα`,`🎯 ${x.done}/${x.goal} workouts this week`),x.done>=x.goal?L('Έπιασες τον εβδομαδιαίο στόχο. 💪','You hit your weekly goal. 💪'):L(`Μένουν ${x.left} μέρες για να τον πιάσεις.`,`${x.left} days left to hit it.`)];
    default:return[L('👋 Καλώς ήρθες','👋 Welcome'),L('Κατέγραψε 2–3 προπονήσεις και ο Coach θα αρχίσει να εντοπίζει plateau, πτώσεις και ανισορροπίες.','Log 2–3 workouts and the Coach starts spotting plateaus, drops and imbalances.')];
  }
}
function insightHtml(x){const[t,b]=insightText(x);return`<div class="insight ${x.tone}"><b>${escapeHtml(t)}</b><span>${escapeHtml(b)}</span></div>`}

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
