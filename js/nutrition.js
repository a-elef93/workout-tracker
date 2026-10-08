/* ───── Nutrition: water bottle, weigh-ins, the dietitian's plan with meals to check off, weekly summary ───── */
const dayWater=d=>(water[d]||[]).reduce((a,x)=>a+x.ml,0);
const waterToday=()=>dayWater(today());
const BOTTLE_TOP=58,BOTTLE_BOTTOM=212;   // inner fill range of the bottle body in the SVG
function bottleSvg(){
  const body='M50 30H70V44C70 52 98 58 98 76V196Q98 212 82 212H38Q22 212 22 196V76C22 58 50 52 50 44Z';
  return`<svg viewBox="0 0 150 222" role="img" aria-label="${L('Μπουκάλι νερού','Water bottle')}">
  <defs><clipPath id="bottleClip"><path d="${body}"/></clipPath>
  <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd6bd"/><stop offset="1" stop-color="#1f8f7f"/></linearGradient></defs>
  <path d="${body}" style="fill:var(--glass)"/>
  <g clip-path="url(#bottleClip)"><g id="waterLevel" class="waterLevel" style="transform:translateY(${BOTTLE_BOTTOM}px)">
    <path class="wave w2" d="M0 6Q15 0 30 6T60 6T90 6T120 6T150 6T180 6T210 6T240 6V240H0Z" fill="#9fe3d2"/>
    <path class="wave w1" d="M0 8Q15 2 30 8T60 8T90 8T120 8T150 8T180 8T210 8T240 8V240H0Z" fill="url(#waterG)"/>
  </g></g>
  <g id="bottleTicks"></g>
  <rect x="29" y="84" width="6" height="96" rx="3" fill="#fff" opacity=".45"/>
  <path d="${body}" fill="none" style="stroke:var(--glass-line)" stroke-width="3"/>
  <rect x="46" y="8" width="28" height="24" rx="6" fill="#7b5236"/><rect x="46" y="26" width="28" height="4" fill="#5c3b24"/>
  </svg>`;
}
function renderWater(){
  const box=$('#bottle'),goal=settings.goalWater,total=waterToday(),pct=total/goal;
  if(!box.firstChild)box.innerHTML=bottleSvg();
  const y=BOTTLE_BOTTOM-Math.min(1,pct)*(BOTTLE_BOTTOM-BOTTLE_TOP);
  $('#waterLevel').style.transform=`translateY(${y.toFixed(1)}px)`;
  let ticks='';
  for(let ml=500;ml<goal;ml+=500){
    const ty=BOTTLE_BOTTOM-(ml/goal)*(BOTTLE_BOTTOM-BOTTLE_TOP),whole=ml%1000===0;
    ticks+=`<line x1="${whole?84:88}" x2="98" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#7b5236" stroke-width="2" opacity=".55"/>`+(whole?`<text x="104" y="${(ty+4).toFixed(1)}" class="tickTxt">${ml/1000} L</text>`:'');
  }
  ticks+=`<text x="104" y="${BOTTLE_TOP+4}" class="tickTxt goal">${fmtL(goal)} L</text>`;
  $('#bottleTicks').innerHTML=ticks;
  $('#waterNow').textContent=fmtL(total);
  $('#waterGoalTxt').textContent=` / ${fmtL(goal)} L`;
  $('#waterGoalBtn').textContent=`${L('Στόχος','Goal')} ${fmtL(goal)} L`;
  const left=goal-total;
  $('#waterPct').innerHTML=left>0?`<b>${Math.round(pct*100)}%</b> · ${L('λείπουν','to go')} ${fmtL(left)} L`:`<span class="goalOk">✓ ${L('Στόχος','Goal')}</span>${left<0?` +${fmtL(-left)} L`:''}`;
  $('#waterPct').classList.toggle('met',left<=0);
  const list=(water[today()]||[]).slice().reverse();
  $('#waterLog').innerHTML=list.length?list.map(x=>`<span class="waterChip">${new Date(x.t).toLocaleTimeString(LOC,{hour:'2-digit',minute:'2-digit',hour12:false})} · ${x.ml} ml<button type="button" class="remove" data-t="${x.t}" aria-label="${L('Αφαίρεση','Remove')}">✕</button></span>`).join(''):`<span class="empty">${L('Πάτα ένα κουμπί κάθε φορά που πίνεις νερό.','Tap a button every time you drink water.')}</span>`;
}
function addWater(ml){
  ml=Math.round(Number(ml));if(!(ml>=10&&ml<=3000))return toast(L('Βάλε ποσότητα από 10 έως 3000 ml','Enter 10 to 3000 ml'));
  const before=waterToday(),t=today();
  (water[t]||(water[t]=[])).push({t:Date.now(),ml});
  persist();renderWater();renderNutritionWeek();
  if(before<settings.goalWater&&waterToday()>=settings.goalWater){confetti();navigator.vibrate?.([40,60,120]);toast(L('💧 Έπιασες τον στόχο νερού για σήμερα!','💧 You hit today’s water goal!'))}
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

/* ───── weigh-ins ───── */
const parseKg=v=>{const n=parseFloat(String(v).replace(',','.'));return Number.isFinite(n)?Math.round(n*10)/10:NaN};
const weightDays=()=>Object.keys(weights).sort();
function latestWeight(before){const ds=weightDays().filter(d=>!before||d<before);return ds.length?{date:ds[ds.length-1],kg:weights[ds[ds.length-1]]}:null}
function goalStart(){
  if(settings.weightGoalStart!=null)return settings.weightGoalStart;
  const ds=weightDays();if(!ds.length)return null;
  const at=settings.weightGoalSetAt;if(!at)return weights[ds[0]];
  return weights[ds.find(d=>d>=at)??ds[ds.length-1]];
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
const deltaTxt=d=>Math.abs(d)<0.05?L('= ίδιο','= same'):`${d<0?'▼':'▲'} ${fmtKg(Math.abs(d))} kg`;
function weightChart(pts,goal){
  const W=320,H=150,Lm=34,R=44,T=12,B=24,n=pts.length,vals=pts.map(p=>p.v).concat(goal==null?[]:[goal]);
  const min=Math.min(...vals)-.5,max=Math.max(...vals)+.5;
  const x=i=>Lm+(n===1?(W-Lm-R)/2:i*(W-Lm-R)/(n-1)),y=v=>T+(1-(v-min)/(max-min))*(H-T-B);
  const line=pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area=`${line}L${x(n-1).toFixed(1)} ${H-B}L${x(0).toFixed(1)} ${H-B}Z`;
  const ticks=[min,(min+max)/2,max].map(v=>`<line class="grid" x1="${Lm}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${Lm-6}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${fmtKg(v)}</text>`).join('');
  const g=goal==null?'':`<line class="wGoal" x1="${Lm}" x2="${W-R}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/><text class="wGoalTxt" x="${W-R+4}" y="${(y(goal)+3).toFixed(1)}">🎯 ${fmtKg(goal)}</text>`;
  const dots=pts.map((p,i)=>`<circle class="wPt${i===n-1?' last':''}" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i===n-1?5:3.5}"/>`).join('');
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Γράφημα βάρους','Weight chart')}"><defs><linearGradient id="wArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22a55f" stop-opacity=".25"/><stop offset="1" stop-color="#22a55f" stop-opacity="0"/></linearGradient></defs>${ticks}${g}<path d="${area}" fill="url(#wArea)"/><path class="wLine" d="${line}"/>${dots}<text x="${Lm}" y="${H-6}">${shortDate(pts[0].date)}</text>${n>1?`<text x="${W-R}" y="${H-6}" text-anchor="end">${shortDate(pts[n-1].date)}</text>`:''}</svg>`;
}
function renderWeight(){
  const last=latestWeight(),g=settings.weightGoal;
  $('#weightGoalBtn').textContent=g==null?`🎯 ${L('Στόχος','Goal')}`:`🎯 ${fmtKg(g)} kg`;
  $('#weightKg').placeholder=last?fmtKg(last.kg):L('π.χ. 82,4','e.g. 82.4');
  if(!$('#weightDate').value||$('#weightDate').value>today())$('#weightDate').value=today();
  $('#weightDate').max=today();
  if(!last){
    $('#weightNow').innerHTML=`<span class="empty">${L('Πέρασε το πρώτο σου ζύγισμα για να ξεκινήσει το log.','Add your first weigh-in to start the log.')}</span>`;
    $('#weightProgress').innerHTML=g==null?'':`🎯 ${L('Στόχος','Goal')}: <b>${fmtKg(g)} kg</b>`;
    $('#weightChart').innerHTML='';$('#weightLog').innerHTML='';return;
  }
  const prev=latestWeight(last.date);
  $('#weightNow').innerHTML=`<b>${fmtKg(last.kg)}</b><span>kg</span>${prev?`<span class="wDelta ${towardCls(last.kg,prev.kg)}">${deltaTxt(last.kg-prev.kg)}</span>`:''}<small>${formatDate(last.date)}${prev?` · ${L('σε σχέση με','vs')} ${formatDate(prev.date)}`:''}</small>`;
  const p=goalProgress(last.kg);
  $('#weightProgress').innerHTML=g==null?L('Βάλε <b>🎯 στόχο κιλών</b> για να βλέπεις πόσο απέχεις.','Set a <b>🎯 weight goal</b> to see how far you are.')
    :p.reached?`🎉 <b>${L(`Έπιασες τον στόχο των ${fmtKg(g)} kg!`,`You reached your ${fmtKg(g)} kg goal!`)}</b><div class="wBar"><i style="width:100%"></i></div>`
    :`${Math.abs(p.changed)<0.05?L('Ίδιο βάρος με την αρχή','Same weight as the start'):`${p.changed<0?L('Έχασες','You lost'):L('Πήρες','You gained')} <b>${fmtKg(Math.abs(p.changed))} kg</b>`} ${L(`από τα ${fmtKg(p.start)} · απομένουν <b>${fmtKg(p.left)} kg</b> για τα ${fmtKg(g)}`,`from ${fmtKg(p.start)} · <b>${fmtKg(p.left)} kg</b> to go to ${fmtKg(g)}`)}<div class="wBar"><i style="width:${(p.pct*100).toFixed(1)}%"></i></div>`;
  const since=addDays(today(),-89),pts=weightDays().filter(d=>d>=since).map(d=>({date:d,v:weights[d]}));
  $('#weightChart').innerHTML=pts.length>1?weightChart(pts,g):'';
  $('#weightLog').innerHTML=weightDays().slice(-6).reverse().map(d=>`<span class="waterChip wChip">${shortDate(d)} · ${fmtKg(weights[d])} kg<button type="button" class="remove" data-d="${d}" aria-label="${L('Διαγραφή ζυγίσματος','Delete weigh-in')}">✕</button></span>`).join('');
}
$('#weightForm').onsubmit=e=>{
  e.preventDefault();
  const d=$('#weightDate').value,kg=parseKg($('#weightKg').value);
  if(!validDay(d)||d>today())return toast(L('Διάλεξε ημέρα μέχρι σήμερα','Pick a day up to today'));
  if(!(kg>=25&&kg<=350))return toast(L('Γράψε τα κιλά σου, π.χ. 82,4','Type your weight, e.g. 82.4'));
  const wasReached=goalProgress(latestWeight()?.kg)?.reached;
  weights[d]=kg;persist();
  $('#weightKg').value='';$('#weightKg').blur();$('#weightDate').value=today();
  renderWeight();renderNutritionWeek();
  if(!wasReached&&goalProgress(latestWeight().kg)?.reached){confetti();navigator.vibrate?.([40,60,120]);toast(L('🎯 Έπιασες τον στόχο βάρους!','🎯 You reached your weight goal!'))}
  else toast(`⚖️ ${fmtKg(kg)} kg · ${formatDate(d)}`);
};
$('#weightLog').onclick=e=>{const b=e.target.closest('[data-d]');if(!b)return;delete weights[b.dataset.d];persist();renderWeight();renderNutritionWeek()};
$('#weightGoalBtn').onclick=()=>{openSettings();setTimeout(()=>$('#goalWeight').focus(),50)};

function renderNutritionWeek(){
  const t=today(),ws=weekStart(t),goalW=settings.goalWater;
  const week=w=>{
    const days=[...Array(7)].map((_,i)=>addDays(w,i)).filter(d=>d<=t),wd=days.filter(d=>d in weights);
    const pd=planDays(days),planned=plan.meals.length*pd.length;
    return{w,days:days.length,pd:pd.length,water:days.filter(d=>dayWater(d)>=goalW).length,hasWater:days.some(d=>water[d]),weighIns:wd.length,avg:wd.length?wd.reduce((a,d)=>a+weights[d],0)/wd.length:null,
      adherence:planned?pd.reduce((a,d)=>a+dayFood(d).meals.length,0)/planned:null,protDays:plan.proteinGoal&&pd.length?pd.filter(d=>dayTotals(d).protein>=plan.proteinGoal).length:null,hasFood:days.some(d=>food[d])};
  };
  const cur=week(ws),last=latestWeight(),p=goalProgress(last?.kg);
  $('#nutWeekRange').textContent=`${shortDate(ws)} – ${shortDate(addDays(ws,6))}`;
  const items=[
    {label:L('Νερό: μέρες στόχου','Water: goal days'),v:cur.water,goal:7,txt:`${cur.water}<small> / 7</small>`,color:'#1f8f7f',r:60},
    {label:L('Ζυγίσματα','Weigh-ins'),v:cur.weighIns,goal:3,txt:`${cur.weighIns}<small> / 3</small>`,color:'var(--coffee)',r:46},
    {label:L('Πρόοδος στόχου κιλών','Weight goal progress'),v:p?p.pct:0,goal:1,txt:p?`${Math.round(p.pct*100)}<small>%</small>`:'—',color:'var(--brand)',r:32},
  ];
  const center=cur.avg!=null?fmtKg(cur.avg):last?fmtKg(last.kg):'—';
  $('#nutRings').innerHTML=`<svg viewBox="0 0 140 140" role="img" aria-label="${L('Εβδομάδα διατροφής','Nutrition week')}">${items.map(i=>ringSvg(i.r,i.v/i.goal,i.color)).join('')}<text x="70" y="66" text-anchor="middle" font-size="17" font-weight="800" style="fill:var(--text);font-family:inherit">${center}</text><text x="70" y="84" text-anchor="middle" font-size="10" font-weight="700" style="fill:var(--muted);font-family:inherit">${cur.avg!=null?L('kg μ.ό.','kg avg'):last?'kg':''}</text></svg>`;
  $('#nutRingLegend').innerHTML=items.map(i=>`<li style="--c:${i.color}"><i></i><b>${i.txt}</b><span>${i.label}</span></li>`).join('');
  const rows=[];
  for(let i=0;i<12&&rows.length<8;i++){const r=week(addDays(ws,-7*i));if(i===0||r.avg!=null||r.hasWater||r.hasFood)rows.push(r)}
  rows.forEach((r,i)=>{const older=rows.slice(i+1).find(o=>o.avg!=null);r.delta=r.avg!=null&&older?r.avg-older.avg:null;r.olderAvg=older?.avg});
  const notes=[],now=rows[0];
  if(now.avg!=null&&now.delta!=null){
    const cls=towardCls(now.avg,now.olderAvg);
    notes.push(`${L('Μ.Ο. εβδομάδας','Week average')} <b>${fmtKg(now.avg)} kg</b> · ${deltaTxt(now.delta)} ${L('από την προηγούμενη','vs the week before')}${cls==='good'?L(' — <b>πλησιάζεις τον στόχο</b> 👍',' — <b>closer to your goal</b> 👍'):cls==='bad'?L(' — απομακρύνεσαι από τον στόχο',' — further from your goal'):''}`);
  }else if(!cur.weighIns)notes.push(L('Ζυγίσου 2–3 φορές την εβδομάδα, το πρωί μετά την τουαλέτα, για πιο σταθερό μέσο όρο.','Weigh yourself 2–3 times a week, in the morning after the bathroom, for a steadier average.'));
  if(p&&!p.reached)notes.push(L(`🎯 Απομένουν <b>${fmtKg(p.left)} kg</b> για τα ${fmtKg(p.goal)} kg`,`🎯 <b>${fmtKg(p.left)} kg</b> to go to ${fmtKg(p.goal)} kg`));
  if(now.adherence!=null)notes.push(`🍽️ ${L('Τήρηση προγράμματος','Plan followed')}: <b>${Math.round(now.adherence*100)}%</b>${now.protDays!=null?L(` · πρωτεΐνη σε <b>${now.protDays}/${now.pd}</b> μέρες`,` · protein on <b>${now.protDays}/${now.pd}</b> days`):''}`);
  $('#nutWeekNote').innerHTML=notes.map(x=>`<div>${x}</div>`).join('');
  $('#nutWeeks').innerHTML=rows.map((r,i)=>`<div class="weekRow"><div class="wr1"><b>${i===0?L('Αυτή η εβδομάδα','This week'):`${shortDate(r.w)} – ${shortDate(addDays(r.w,6))}`}</b>${i===0?`<span>${shortDate(r.w)} – ${shortDate(addDays(r.w,6))}</span>`:''}</div><div class="wr2">${r.avg!=null?`${fmtKg(r.avg)} kg`:'—'}${r.delta!=null?`<span class="wDelta ${towardCls(r.avg,r.olderAvg)}">${deltaTxt(r.delta)}</span>`:''}</div><div class="wr3"><span>💧 ${r.water}/${r.days}</span>${r.adherence!=null?`<span>🍽️ ${Math.round(r.adherence*100)}%</span>`:''}${r.protDays!=null?`<span>🥩 ${r.protDays}/${r.pd}</span>`:''}</div></div>`).join('');
}
function renderNutrition(){renderFood();renderWeight();renderWater();renderNutritionWeek()}

/* ───── nutrition plan: the dietitian's file, meals to check off, calories & protein vs target ───── */
const fileDB=(()=>{
  let dbp=null;
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('gympilot',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
  const run=(mode,fn)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction('files',mode),q=fn(t.objectStore('files'));t.oncomplete=()=>res(q.result);t.onerror=()=>rej(t.error)}));
  return{get:k=>run('readonly',st=>st.get(k)),put:(k,v)=>run('readwrite',st=>st.put(v,k)),del:k=>run('readwrite',st=>st.delete(k))};
})();
let planFile=null,planFileURL=null;   // kept in memory so a backup can include it without waiting
fileDB.get('plan').then(f=>{planFile=f||null;if(!$('#view-nutrition').hidden)renderFood()}).catch(()=>{});
const fileURL=()=>planFile?(planFileURL||(planFileURL=URL.createObjectURL(new Blob([planFile.data],{type:planFile.type})))):null;
const resetFileURL=()=>{if(planFileURL){URL.revokeObjectURL(planFileURL);planFileURL=null}};
const bufToB64=buf=>{const b=new Uint8Array(buf);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(s)};

const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:null};
const dayFood=d=>food[d]||{meals:[],extras:[]};
const planDays=days=>plan.meals.length?days.filter(d=>!plan.since||d>=plan.since):[];
function dayTotals(d){const f=dayFood(d),all=[...f.meals,...f.extras];return{kcal:all.reduce((a,x)=>a+(x.kcal||0),0),protein:all.reduce((a,x)=>a+(x.protein||0),0)}}
const proteinSuggestion=()=>{const w=latestWeight();return w?Math.round(w.kg*1.8/5)*5:null};   // ~1.8 g per kg

function miniRing(v,goal,color,label,unitTxt){
  const r=46,c=2*Math.PI*r,p=goal?Math.min(1,v/goal):0;
  return`<div class="fRing"><div class="fRingSvg"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" fill="none" style="stroke:${color}" stroke-opacity=".15" stroke-width="12"/>${p>0?`<circle class="ringArc" cx="60" cy="60" r="${r}" fill="none" style="stroke:${color};--c:${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-p)}" transform="rotate(-90 60 60)"/>`:''}</svg><div class="fRingTxt"><b>${fmtN(v)}</b><span>${goal?`/ ${fmtN(goal)}`:''} ${unitTxt}</span></div></div><div class="fRingLbl">${label}${goal&&v>=goal?' ✓':''}</div></div>`;
}
function renderFood(){
  const t=today(),f=dayFood(t),tot=dayTotals(t),doneIds=new Set(f.meals.map(m=>m.id));
  $('#foodRings').innerHTML=miniRing(tot.kcal,plan.kcalGoal,'var(--coffee)',L('Θερμίδες','Calories'),'kcal')+miniRing(tot.protein,plan.proteinGoal,'var(--brand)',L('Πρωτεΐνη','Protein'),'g')
    +(plan.kcalGoal||plan.proteinGoal?'':`<p class="foodHint">${L('Βάλε στόχους θερμίδων και πρωτεΐνης στο <b>📄 Πρόγραμμα</b>.','Set calorie and protein targets in <b>📄 Plan</b>.')}</p>`);
  const burnt=caloriesByDay(logs.filter(l=>l.date===t))[t]?.kcal;
  $('#burnLine').hidden=!burnt;
  if(burnt)$('#burnLine').innerHTML=L(`🔥 Η σημερινή προπόνηση έκαψε ~<b>${fmtN(burnt)} kcal</b>`,`🔥 Today’s workout burnt ~<b>${fmtN(burnt)} kcal</b>`);
  $('#mealList').innerHTML=plan.meals.length
    ?`<div class="mealHead">${L('Γεύματα σήμερα','Meals today')} · <b>${plan.meals.filter(m=>doneIds.has(m.id)).length}/${plan.meals.length}</b></div>`+plan.meals.map(m=>{
      const done=doneIds.has(m.id),sub=[m.time,m.desc].filter(Boolean).map(escapeHtml).join(' · ');
      return`<button type="button" class="meal${done?' done':''}" data-meal="${m.id}" aria-pressed="${done}"><span class="mCheck">✓</span><span class="mInfo"><b>${escapeHtml(m.name||L('Γεύμα','Meal'))}</b>${sub?`<small>${sub}</small>`:''}</span>${m.kcal||m.protein?`<span class="mMacro">${m.kcal?`${fmtN(m.kcal)} kcal`:''}${m.kcal&&m.protein?'<br>':''}${m.protein?`${fmtN(m.protein)} ${L('g πρωτ.','g protein')}`:''}</span>`:''}</button>`;
    }).join('')
    :`<div class="empty">${L('Πρόσθεσε τα γεύματα του προγράμματός σου για να τα τσεκάρεις κάθε μέρα.','Add the meals of your plan to check them off every day.')}</div><button type="button" class="secondary wide" data-open-plan>${L('📄 Στήσε το πρόγραμμα','📄 Set up your plan')}</button>`;
  $('#extraLog').innerHTML=f.extras.slice().reverse().map(x=>`<span class="waterChip wChip">${escapeHtml(x.label||L('Εκτός προγράμματος','Off-plan'))}${x.kcal?` · ${fmtN(x.kcal)} kcal`:''}${x.protein?` · ${fmtN(x.protein)} g`:''}<button type="button" class="remove" data-x="${x.t}" aria-label="${L('Αφαίρεση','Remove')}">✕</button></span>`).join('');
}
$('#mealList').onclick=e=>{
  if(e.target.closest('[data-open-plan]'))return openPlan();
  const b=e.target.closest('[data-meal]');if(!b)return;
  const t=today(),m=plan.meals.find(x=>x.id===b.dataset.meal);if(!m)return;
  const f=food[t]||(food[t]={meals:[],extras:[]}),i=f.meals.findIndex(x=>x.id===m.id);
  if(i>=0)f.meals.splice(i,1);else f.meals.push({id:m.id,name:m.name,kcal:m.kcal||0,protein:m.protein||0});
  if(!f.meals.length&&!f.extras.length)delete food[t];
  persist();renderFood();renderNutritionWeek();
  if(i>=0)return;
  if(plan.meals.every(p=>(food[t]?.meals||[]).some(x=>x.id===p.id))){confetti();toast(L('🍽️ Όλα τα γεύματα της ημέρας! 💪','🍽️ Every meal of the day! 💪'))}
  else toast(`✅ ${m.name||L('Γεύμα','Meal')}`);
};
$('#extraForm').onsubmit=e=>{
  e.preventDefault();
  const kcal=num($('#extraKcal').value),protein=num($('#extraProt').value),label=$('#extraLabel').value.trim();
  if(!kcal&&!protein)return toast(L('Βάλε θερμίδες ή πρωτεΐνη','Add calories or protein'));
  if((kcal||0)>5000||(protein||0)>400)return toast(L('Έλεγξε τις τιμές','Check the values'));
  const t=today(),f=food[t]||(food[t]={meals:[],extras:[]});
  f.extras.push({t:Date.now(),label,kcal:Math.round(kcal||0),protein:Math.round((protein||0)*10)/10});
  persist();['#extraLabel','#extraKcal','#extraProt'].forEach(id=>$(id).value='');$('#extraFood').open=false;
  renderFood();renderNutritionWeek();toast(L('➕ Προστέθηκε','➕ Added'));
};
$('#extraLog').onclick=e=>{
  const b=e.target.closest('[data-x]'),t=today(),f=food[t];if(!b||!f)return;
  f.extras=f.extras.filter(x=>String(x.t)!==b.dataset.x);
  if(!f.meals.length&&!f.extras.length)delete food[t];
  persist();renderFood();renderNutritionWeek();
};

const planDlg=$('#planDialog');
function openPlan(){
  $('#planKcal').value=plan.kcalGoal??'';$('#planProt').value=plan.proteinGoal??'';
  const sug=proteinSuggestion();
  $('#protHint').textContent=sug
    ?L(`Πρόταση πρωτεΐνης: ~${sug} g (1,8 g ανά κιλό, με βάρος ${fmtKg(latestWeight().kg)} kg). Αν ο διατροφολόγος σου έχει δώσει στόχο, βάλε εκείνον.`,`Suggested protein: ~${sug} g (1.8 g per kg at ${fmtKg(latestWeight().kg)} kg). If your dietitian gave you a target, use that.`)
    :L('Βάλε τους στόχους του διατροφολόγου σου. Με ένα ζύγισμα θα σου προτείνουμε και στόχο πρωτεΐνης.','Enter your dietitian’s targets. With a weigh-in we’ll also suggest a protein target.');
  renderPlanFile();renderMealEditor();planDlg.showModal();
}
function closePlan(){
  const k=num($('#planKcal').value),p=num($('#planProt').value);
  plan.kcalGoal=k>=500&&k<=10000?Math.round(k):null;
  plan.proteinGoal=p>=10&&p<=500?Math.round(p):null;
  persist();planDlg.close();renderFood();renderNutritionWeek();
}
planDlg.querySelectorAll('[data-plan-close]').forEach(b=>b.onclick=closePlan);
planDlg.addEventListener('cancel',e=>{e.preventDefault();closePlan()});   // Esc saves too
$('#planBtn').onclick=openPlan;
function renderMealEditor(){
  $('#mealEditor').innerHTML=plan.meals.map(m=>`<div class="mealEdit" data-id="${m.id}">
    <div class="row two"><label>${L('Γεύμα','Meal')}<input data-f="name" value="${escapeHtml(m.name||'')}" placeholder="${L('π.χ. Πρωινό','e.g. Breakfast')}" autocomplete="off"></label><label>${L('Ώρα','Time')}<input data-f="time" type="time" value="${escapeHtml(m.time||'')}"></label></div>
    <label>${L('Τι περιλαμβάνει','What’s in it')}<textarea data-f="desc" rows="2" placeholder="${L('π.χ. 60g βρώμη, 2 αυγά, 1 μπανάνα','e.g. 60g oats, 2 eggs, 1 banana')}">${escapeHtml(m.desc||'')}</textarea></label>
    <div class="row two"><label>${L('Θερμίδες','Calories')}<input data-f="kcal" inputmode="numeric" value="${m.kcal||''}" placeholder="kcal" autocomplete="off"></label><label>${L('Πρωτεΐνη (g)','Protein (g)')}<input data-f="protein" inputmode="decimal" value="${m.protein||''}" placeholder="g" autocomplete="off"></label></div>
    <button type="button" class="dangerGhost" data-del-meal>${L('Αφαίρεση γεύματος','Remove meal')}</button></div>`).join('')||`<div class="empty">${L('Δεν έχεις γεύματα ακόμα.','No meals yet.')}</div>`;
}
$('#mealEditor').oninput=e=>{
  const row=e.target.closest('[data-id]'),f=e.target.dataset.f;if(!row||!f)return;
  const m=plan.meals.find(x=>x.id===row.dataset.id);if(!m)return;
  m[f]=f==='kcal'||f==='protein'?(num(e.target.value)??0):e.target.value;
  persist();
};
$('#mealEditor').onclick=e=>{
  const b=e.target.closest('[data-del-meal]');if(!b)return;
  const id=b.closest('[data-id]').dataset.id;plan.meals=plan.meals.filter(m=>m.id!==id);persist();renderMealEditor();
};
$('#addMealBtn').onclick=()=>{
  const names=L('Πρωινό|Δεκατιανό|Μεσημεριανό|Απογευματινό|Βραδινό','Breakfast|Snack|Lunch|Afternoon snack|Dinner').split('|');
  if(!plan.since)plan.since=today();
  plan.meals.push({id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:names[plan.meals.length]||'',time:'',desc:'',kcal:0,protein:0});
  persist();renderMealEditor();
  const rows=$('#mealEditor').querySelectorAll('.mealEdit');rows[rows.length-1]?.scrollIntoView({block:'center'});
};
function renderPlanFile(){
  const box=$('#planFileBox');
  if(!planFile){box.innerHTML=`<button type="button" class="secondary wide" data-file="add">${L('📎 Ανέβασε PDF ή φωτογραφία','📎 Upload a PDF or photo')}</button><p class="backupHint">${L('Το αρχείο μένει μόνο σε αυτό το κινητό (και στο backup σου).','The file stays on this phone only (and in your backup).')}</p>`;return}
  const url=fileURL(),img=planFile.type.startsWith('image/');
  box.innerHTML=`<div class="fileCard">${img?`<img src="${url}" alt="${L('Πρόγραμμα διατροφής','Nutrition plan')}" class="planImg">`:`<iframe src="${url}" title="${L('Πρόγραμμα διατροφής','Nutrition plan')}" class="planPdf"></iframe>`}
    <div class="fileMeta"><b>${escapeHtml(planFile.name)}</b><span>${Math.max(1,Math.round(planFile.size/1024))} KB · ${formatDate(dayKey(new Date(planFile.added)))}</span></div>
    <div class="fileBtns"><a class="btnLink" href="${url}" target="_blank" rel="noopener">${L('Άνοιγμα','Open')}</a><button type="button" class="secondary" data-file="add">${L('Αλλαγή','Change')}</button><button type="button" class="secondary" data-file="del">${L('Αφαίρεση','Remove')}</button></div></div>`;
}
$('#planFileBox').onclick=async e=>{
  const b=e.target.closest('[data-file]');if(!b)return;
  if(b.dataset.file==='add')return $('#planFile').click();
  if(!confirm(L('Να αφαιρεθεί το αρχείο του προγράμματος;','Remove the plan file?')))return;
  await fileDB.del('plan').catch(()=>{});planFile=null;resetFileURL();renderPlanFile();
};
async function savePlanFile(rec){await fileDB.put('plan',rec);planFile=rec;resetFileURL()}
$('#planFile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>15*1024*1024)return toast(L('Το αρχείο είναι πάνω από 15 MB','The file is over 15 MB'));
  try{await savePlanFile({name:f.name,type:f.type||'application/octet-stream',size:f.size,added:Date.now(),data:await f.arrayBuffer()});renderPlanFile();toast(L('📄 Το πρόγραμμα αποθηκεύτηκε','📄 Plan saved'))}
  catch{toast(L('⚠️ Δεν αποθηκεύτηκε το αρχείο','⚠️ The file wasn’t saved'))}
};
