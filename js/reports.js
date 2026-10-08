/* ───── Steps, weekly report, monthly Wrapped, achievements ───── */

/* ───── steps (Apple Health via a Shortcut, or typed in) ─────
   A web app can't read HealthKit, so a Shortcut named "WT Steps" copies
   "WTSTEPS\n2026-09-28 8234\n..." to the clipboard and ↻ imports it. */
const STEPS_SHORTCUT='WT Steps',STEPS_MARKER='WTSTEPS';
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const shortK=n=>n>=1000?`${(n/1000).toFixed(1).replace('.',lang==='en'?'.':',')}k`:String(n);
let awaitingShortcut=false;
function toSteps(tok){
  tok=tok.replace(/[\s ]/g,'').replace(/[.,]+$/,'');
  if(/^\d{1,3}([.,]\d{3})+$/.test(tok))return Number(tok.replace(/[.,]/g,''));   // 8.234 / 8,234 = thousands
  return Math.round(Number(tok.replace(',','.')));
}
function parseSteps(text){
  const out={};
  String(text||'').split(/[\r\n;]+/).forEach(line=>{
    const m=line.match(/\d{4}-\d{2}-\d{2}/);if(!m)return;
    const d=m[0];if(!validDay(d)||d>today())return;
    const toks=line.slice(m.index+d.length).match(/\d[\d.,\s ]*/g);if(!toks)return;
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
  toast(L(`✅ Βήματα: ενημερώθηκαν ${n} ${n===1?'μέρα':'μέρες'}`,`✅ Steps: ${n} ${n===1?'day':'days'} updated`));
}
async function syncSteps(){
  let text='';
  try{text=await navigator.clipboard.readText()}catch{}
  const fresh=text.includes(STEPS_MARKER)&&textHash(text)!==settings.stepsLastClip;   // same text as last time = stale
  if(fresh){
    const found=parseSteps(text);
    if(Object.keys(found).length){settings.stepsLastClip=textHash(text);settings.stepsShortcut=true;return applySteps(found)}
    openStepsDialog(true);$('#stepsPaste').value=text;
    return toast(L('⚠️ Το Shortcut έδωσε κείμενο χωρίς βήματα — δες τη μορφή','⚠️ The Shortcut gave text without steps — check the format'));
  }
  if(isIOS&&settings.stepsShortcut){awaitingShortcut=true;location.href='shortcuts://run-shortcut?name='+encodeURIComponent(STEPS_SHORTCUT);return}
  openStepsDialog(!settings.stepsShortcut);
}
function stepsChart(days,goal,gymDays,t){
  const W=320,H=150,top=16,base=112,slot=W/days.length,bw=24;
  const max=Math.max(goal,...days.map(d=>steps[d]||0))*1.1,y=v=>base-(v/max)*(base-top);
  const bars=days.map((d,i)=>{
    const v=steps[d],cx=slot*i+slot/2,x=(cx-bw/2).toFixed(1);
    const cls=v==null?'none':v>=goal?'met':'under',h=v==null?3:Math.max(3,base-y(v));
    return`<rect class="bar ${cls}" x="${x}" y="${(base-h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="6"/>`+
      (v!=null?`<text x="${cx}" y="${(base-h-5).toFixed(1)}" text-anchor="middle">${shortK(v)}</text>`:'')+
      `<text class="${d===t?'today':''}" x="${cx}" y="${base+16}" text-anchor="middle">${d===t?L('Σήμ','Tod'):dayName(weekdayIdx(d),'narrow')}</text>`+
      (gymDays.has(d)?`<circle class="gym" cx="${cx}" cy="${base+28}" r="3.5"/>`:'');
  }).join('');
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Βήματα 7 ημερών','Steps, 7 days')}"><line class="goal" x1="0" x2="${W}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/>${bars}</svg>`;
}
function renderSteps(){
  const body=$('#stepsBody'),t=today(),goal=settings.goalSteps;
  if(!Object.keys(steps).length){
    body.innerHTML=`<div class="empty">${L('Σύνδεσε το Apple Health — και μέσω αυτού Huawei, Garmin, Fitbit — για να βλέπεις βήματα δίπλα στις προπονήσεις σου. Ή πέρασέ τα με το ✎.','Connect Apple Health — and through it Huawei, Garmin, Fitbit — to see steps next to your workouts. Or type them in with ✎.')}</div><button type="button" class="secondary stepsSetup" data-steps-setup>${L('Πώς το συνδέω','How to connect')}</button>`;
    return;
  }
  const tv=steps[t],pct=tv==null?0:Math.min(100,tv/goal*100),met=tv!=null&&tv>=goal;
  const s=settings.stepsSyncedAt,when=!s?'':dayKey(new Date(s))===t?`${L('σήμερα','today')} ${new Date(s).toLocaleTimeString(LOC,{hour:'2-digit',minute:'2-digit'})}`:formatDate(dayKey(new Date(s)));
  const gymDays=new Set(logs.map(l=>l.date)),last7=[...Array(7)].map((_,i)=>addDays(t,i-6));
  const done=n=>[...Array(n)].map((_,i)=>addDays(t,-n+i)).filter(d=>steps[d]!=null);   // finished days only
  const avg=a=>a.reduce((x,d)=>x+steps[d],0)/a.length;
  const d7=done(7),d30=done(30),gym=d30.filter(d=>gymDays.has(d)),rest=d30.filter(d=>!gymDays.has(d));
  const tips=[];
  if(d7.length)tips.push(L(`Μ.Ο. 7 ημερών: <b>${fmtN(avg(d7))}</b> · στόχος σε <b>${d7.filter(d=>steps[d]>=goal).length}/${d7.length}</b> μέρες`,`7-day avg: <b>${fmtN(avg(d7))}</b> · goal on <b>${d7.filter(d=>steps[d]>=goal).length}/${d7.length}</b> days`));
  if(gym.length>=2&&rest.length>=2)tips.push(L(`🏋️ Μέρες προπόνησης: <b>${fmtN(avg(gym))}</b> βήματα · ξεκούρασης: <b>${fmtN(avg(rest))}</b>`,`🏋️ Training days: <b>${fmtN(avg(gym))}</b> steps · rest days: <b>${fmtN(avg(rest))}</b>`));
  body.innerHTML=`<div class="stepsToday"><div class="stNum"><b>${tv==null?'—':fmtN(tv)}</b><span>/ ${fmtN(goal)} ${L('σήμερα','today')}</span>${met?`<span class="goalOk">✓ ${L('Στόχος','Goal')}</span>`:''}</div><div class="stepsBar${met?' met':''}"><i style="width:${pct}%"></i></div>${when?`<small>${L('Τελευταίος συγχρονισμός','Last sync')}: ${when}</small>`:''}</div>
  <div class="stepsChart">${stepsChart(last7,goal,gymDays,t)}</div>
  <div class="legend stepsLegend"><span><i class="dot met"></i>${L('Στόχος','Goal')}</span><span><i class="dot under"></i>${L('Κάτω από στόχο','Under goal')}</span><span><i class="dot gym"></i>${L('Προπόνηση','Workout')}</span></div>
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
  const d=$('#stepsDate').value;if(!validDay(d)||d>today())return toast(L('Διάλεξε ημέρα μέχρι σήμερα','Pick a day up to today'));
  const v=$('#stepsValue').value;
  if(v==='')delete steps[d];
  else{const n=Math.round(Number(v));if(!(n>=0&&n<=200000))return toast(L('Μη έγκυρος αριθμός βημάτων','Not a valid step count'));steps[d]=n}
  persist();renderSteps();stepsDlg.close();toast(L('✅ Αποθηκεύτηκε','✅ Saved'));
};
$('#stepsImport').onclick=()=>{
  const found=parseSteps($('#stepsPaste').value);
  if(!Object.keys(found).length)return toast(L('Δεν βρέθηκαν βήματα — κάθε γραμμή: 2026-09-28 8234','No steps found — one line each: 2026-09-28 8234'));
  stepsDlg.close();applySteps(found);
};

/* ───── weekly report: training, steps, water, weight and food on one card ───── */
let reportOffset=0;
function weekReport(off){
  const t=today(),ws=addDays(weekStart(t),off*7),we=addDays(ws,6);
  const days=[...Array(7)].map((_,i)=>addDays(ws,i)).filter(d=>d<=t),st=computeStatuses();
  const wl=logs.filter(l=>l.date>=ws&&l.date<=we),sd=days.filter(d=>steps[d]!=null);
  const wavg=ds=>{const w=ds.filter(d=>d in weights);return w.length?w.reduce((a,d)=>a+weights[d],0)/w.length:null};
  const wAvg=wavg(days),wPrev=wavg([...Array(7)].map((_,i)=>addDays(ws,i-7)));
  const pd=planDays(days),planned=plan.meals.length*pd.length,cal=caloriesByDay(wl);
  return{ws,we,days:days.length,pd:pd.length,
    workouts:new Set(wl.map(l=>l.date)).size,setsN:totalSets(wl),
    vol:wl.filter(isWeighted).reduce((a,l)=>a+volume(l),0),recs:wl.filter(l=>st.get(l.id)?.cls==='record').length,
    kcal:Object.values(cal).reduce((a,d)=>a+d.kcal,0),minutes:Object.values(cal).reduce((a,d)=>a+d.minutes,0),
    stepsAvg:sd.length?sd.reduce((a,d)=>a+steps[d],0)/sd.length:null,stepsMet:sd.filter(d=>steps[d]>=settings.goalSteps).length,stepsDays:sd.length,
    waterMet:days.filter(d=>dayWater(d)>=settings.goalWater).length,waterAny:days.some(d=>water[d]),
    wAvg,wPrev,wDelta:wAvg!=null&&wPrev!=null?wAvg-wPrev:null,
    adherence:planned?pd.reduce((a,d)=>a+dayFood(d).meals.length,0)/planned:null,
    protDays:plan.proteinGoal&&pd.length?pd.filter(d=>dayTotals(d).protein>=plan.proteinGoal).length:null};
}
function reportTiles(r){
  const vol=fmtVol(r.vol);
  return[
    {i:'🏋️',v:`${r.workouts}`,l:L('Προπονήσεις','Workouts'),s:r.workouts?`${r.setsN} sets · ${vol}`:L('καμία ακόμα','none yet')},
    {i:'🔥',v:r.kcal?`${fmtN(r.kcal)}`:'—',l:L('kcal προπόνησης','Workout kcal'),s:r.kcal?L(`~${Math.round(r.minutes)}′ προπόνησης`,`~${Math.round(r.minutes)}′ of training`):L('καμία ακόμα','none yet')},
    {i:'🏆',v:`${r.recs}`,l:L('Νέα records','New records'),s:r.recs?L('συνέχισε έτσι','keep it up'):'—'},
    {i:'👣',v:r.stepsAvg!=null?fmtN(r.stepsAvg):'—',l:L('Βήματα / μέρα','Steps / day'),s:r.stepsDays?L(`στόχος ${r.stepsMet}/${r.stepsDays} μέρες`,`goal ${r.stepsMet}/${r.stepsDays} days`):L('χωρίς δεδομένα','no data')},
    {i:'💧',v:`${r.waterMet}/${r.days}`,l:L('Μέρες στόχου νερού','Water goal days'),s:r.waterAny?L(`στόχος ${fmtL(settings.goalWater)} L`,`goal ${fmtL(settings.goalWater)} L`):L('χωρίς καταγραφές','nothing logged')},
    {i:'⚖️',v:r.wAvg!=null?`${fmtKg(r.wAvg)} kg`:'—',l:L('Μ.Ο. βάρους','Avg weight'),s:r.wDelta!=null?L(`${deltaTxt(r.wDelta)} από την προηγ.`,`${deltaTxt(r.wDelta)} vs last week`):L('χωρίς σύγκριση','nothing to compare'),cls:r.wDelta!=null?towardCls(r.wAvg,r.wPrev):''},
    {i:'🍽️',v:r.adherence!=null?`${Math.round(r.adherence*100)}%`:'—',l:L('Τήρηση διατροφής','Diet followed'),s:r.protDays!=null?L(`πρωτεΐνη ${r.protDays}/${r.pd} μέρες`,`protein ${r.protDays}/${r.pd} days`):r.adherence!=null?L('γεύματα που τσέκαρες','meals you checked off'):L('χωρίς πρόγραμμα','no plan')},
    {i:'🗓️',v:(()=>{const a=planAdherenceWeek(r.ws);return a?`${a.hit}/${a.planned}`:'—'})(),l:L('Προπονήσεις προγράμματος','Plan workouts'),s:training?L('μέρες που έγιναν','days done'):L('χωρίς πρόγραμμα','no plan')},
  ];
}
function planAdherenceWeek(ws){
  if(!training)return null;
  let planned=0,hit=0;
  for(let i=0;i<7;i++){const d=addDays(ws,i);if(d>today())break;if(!planFor(d)?.groups.length)continue;planned++;if(logs.some(l=>l.date===d))hit++}
  return planned?{planned,hit}:null;
}
function renderReport(){
  const r=weekReport(reportOffset);
  document.querySelectorAll('#reportWeeks .chip').forEach(b=>b.classList.toggle('on',Number(b.dataset.w)===reportOffset));
  $('#reportRange').textContent=`${shortDate(r.ws)} – ${shortDate(r.we)}`;
  $('#reportBody').innerHTML=reportTiles(r).map(x=>`<div class="rTile ${x.cls||''}"><span class="rIcon">${x.i}</span><b>${x.v}</b><span class="rLbl">${x.l}</span><small>${x.s}</small></div>`).join('');
}
$('#reportWeeks').onclick=e=>{const b=e.target.closest('[data-w]');if(!b)return;reportOffset=Number(b.dataset.w);renderReport()};

const MARK={ring:'M78 54A32 32 0 1 1 64.35 27.79',bar:'M70 54H78',arrow:'M86 16 39.3 37.3 58 44 64.7 62.7Z',f1:'M86 16 39.3 37.3 58 44Z',f2:'M86 16 58 44 64.7 62.7Z'};
const canvasFont=(w,s)=>`${w} ${s}px -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif`;
function drawMark(g,x,y,s){
  g.save();g.translate(x,y);g.scale(s,s);g.lineCap='round';g.lineJoin='round';
  g.strokeStyle='#fff';g.lineWidth=13;g.stroke(new Path2D(MARK.ring));g.stroke(new Path2D(MARK.bar));
  g.strokeStyle='#2c1e14';g.lineWidth=6;g.stroke(new Path2D(MARK.arrow));
  g.fillStyle='#5fe39a';g.fill(new Path2D(MARK.f1));g.fillStyle='#22a55f';g.fill(new Path2D(MARK.f2));g.restore();
}
function reportImage(r){
  const W=1080,H=1500,c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d'),box=(x,y,w,h,rr)=>{g.beginPath();g.roundRect?g.roundRect(x,y,w,h,rr):g.rect(x,y,w,h)};
  g.fillStyle='#f4f8f2';g.fillRect(0,0,W,H);
  const hg=g.createLinearGradient(0,0,W,360);hg.addColorStop(0,'#24180f');hg.addColorStop(.6,'#3a2719');hg.addColorStop(1,'#4a3322');
  g.fillStyle=hg;box(0,-60,W,420,60);g.fill();
  const glow=g.createRadialGradient(W*.88,0,0,W*.88,0,520);glow.addColorStop(0,'rgba(34,165,95,.33)');glow.addColorStop(1,'rgba(34,165,95,0)');
  g.save();box(0,-60,W,420,60);g.clip();g.fillStyle=glow;g.fillRect(0,0,W,360);g.restore();
  drawMark(g,56,64,1.55);
  g.font=canvasFont(800,72);g.fillStyle='#fff';g.fillText('Gym',230,150);
  const gw=g.measureText('Gym').width;g.fillStyle='#4cd88a';g.fillText('Pilot',230+gw,150);
  g.font=canvasFont(600,34);g.fillStyle='#e9e0d6';g.fillText('Lift. Push. Progress.',232,198);
  g.font=canvasFont(800,52);g.fillStyle='#fff';g.fillText(L('Η εβδομάδα μου','My week'),64,300);
  g.font=canvasFont(600,34);g.fillStyle='#e9e0d6';g.textAlign='right';g.fillText(`${shortDate(r.ws)} – ${shortDate(r.we)}`,W-64,300);g.textAlign='left';
  const tw=(W-128-32)/2,th=230;
  reportTiles(r).forEach((x,i)=>{
    const tx=64+(i%2)*(tw+32),ty=392+Math.floor(i/2)*(th+28);
    g.fillStyle='#fff';box(tx,ty,tw,th,36);g.fill();g.strokeStyle='#dde9da';g.lineWidth=2;g.stroke();
    g.font=canvasFont(400,46);g.fillText(x.i,tx+34,ty+70);
    g.fillStyle=x.cls==='good'?'#15803d':x.cls==='bad'?'#94600f':'#1f2a22';g.font=canvasFont(800,x.v.length>7?58:68);g.fillText(x.v,tx+34,ty+146);
    g.fillStyle='#5c3b24';g.font=canvasFont(700,30);g.fillText(x.l,tx+34,ty+186);
    g.fillStyle='#6b776c';g.font=canvasFont(600,25);g.fillText(x.s,tx+34,ty+218);
  });
  g.fillStyle='#6b776c';g.font=canvasFont(600,28);g.textAlign='center';g.fillText(L('Χωρίς λογαριασμό · τα δεδομένα μένουν στο κινητό','No account · your data stays on your phone'),W/2,H-44);
  return c;
}
const b64ToBuf=b64=>{const s=atob(b64),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u.buffer};
function shareCanvas(canvas,name,title){
  // built and shared straight from the tap (no awaits before share), so iOS allows the share sheet
  const url=canvas.toDataURL('image/png'),file=new File([b64ToBuf(url.split(',')[1])],name,{type:'image/png'});
  if(navigator.canShare?.({files:[file]}))navigator.share({files:[file],title}).catch(()=>{});
  else{const a=document.createElement('a');a.href=url;a.download=name;a.click()}
}
$('#reportShare').onclick=()=>shareCanvas(reportImage(weekReport(reportOffset)),'GymPilot-week.png',L('Η εβδομάδα μου στο GymPilot','My week on GymPilot'));

/* ───── monthly Wrapped ───── */
const LOADS=[{kg:150000,el:['φάλαινα','φάλαινες'],en:['whale','whales']},{kg:12000,el:['λεωφορείο','λεωφορεία'],en:['bus','buses']},{kg:6000,el:['ελέφαντας','ελέφαντες'],en:['elephant','elephants']},{kg:1500,el:['αυτοκίνητο','αυτοκίνητα'],en:['car','cars']},{kg:400,el:['πιάνο','πιάνα'],en:['piano','pianos']}];
function loadCompare(kg){
  const Lo=LOADS.find(x=>kg/x.kg>=1);if(!Lo)return'';
  const n=kg/Lo.kg,r=n>=2?Math.round(n):Math.round(n*10)/10,w=Lo[lang];
  return`${L('όσο','as much as')} ${r.toLocaleString(LOC)} ${r===1?w[0]:w[1]}`;
}
const monthName=(ym,gen)=>{const[y,m]=ym.split('-').map(Number),d=new Date(y,m-1,1);return gen?d.toLocaleDateString(LOC,{month:'long'}):d.toLocaleDateString(LOC,{month:'long',year:'numeric'})};
let wrappedOffset=0;
function monthData(ym){
  const ls=logs.filter(l=>l.date.startsWith(ym)),st=computeStatuses();
  const count={},groupSets={};ls.forEach(l=>{count[l.exercise]=(count[l.exercise]||0)+1;groupSets[l.group]=(groupSets[l.group]||0)+l.sets.length});
  const topEx=Object.entries(count).sort((a,b)=>b[1]-a[1])[0],topGroup=Object.entries(groupSets).sort((a,b)=>b[1]-a[1])[0];
  const recs=ls.map(l=>({l,s:st.get(l.id)})).filter(x=>x.s?.cls==='record'),bestRec=recs.sort((a,b)=>b.s.delta-a.s.delta)[0];
  let heavy=null;ls.forEach(l=>l.sets.forEach(s=>{if(s.kg>0&&(!heavy||s.kg>heavy.kg))heavy={kg:s.kg,ex:l.exercise}}));
  const inMonth=o=>Object.keys(o).filter(d=>d.startsWith(ym));
  const sd=inMonth(steps),wd=inMonth(weights).sort(),cal=caloriesByDay(ls);
  return{ym,workouts:new Set(ls.map(l=>l.date)).size,sets:totalSets(ls),vol:ls.filter(isWeighted).reduce((a,l)=>a+volume(l),0),
    kcal:Object.values(cal).reduce((a,d)=>a+d.kcal,0),records:recs.length,topEx,topGroup,bestRec,heavy,
    waterL:inMonth(water).reduce((a,d)=>a+dayWater(d),0)/1000,stepsTotal:sd.reduce((a,d)=>a+steps[d],0),stepsAvg:sd.length?sd.reduce((a,d)=>a+steps[d],0)/sd.length:null,
    wChange:wd.length>1?weights[wd[wd.length-1]]-weights[wd[0]]:null,hasAny:ls.length>0||sd.length>0||wd.length>0||inMonth(water).length>0};
}
function wrappedItems(m){
  const vol=m.vol>=1000?L(`${fmt(Math.round(m.vol/100)/10)} τόνους`,`${fmt(Math.round(m.vol/100)/10)} tonnes`):`${fmtN(m.vol)} kg`;
  return[
    {i:'🏋️',k:L('Προπονήσεις','Workouts'),v:`${m.workouts}`,s:L(`${m.sets} sets συνολικά`,`${m.sets} sets in total`)},
    {i:'🏗️',k:L('Σήκωσες','You lifted'),v:vol,s:loadCompare(m.vol)},
    m.kcal?{i:'🔥',k:L('Θερμίδες προπόνησης','Workout calories'),v:`~${fmtN(m.kcal)} kcal`,s:L('εκτίμηση από διάρκεια και βάρος','estimated from duration and weight')}:null,
    m.topEx&&{i:'⭐',k:L('Η αγαπημένη σου άσκηση','Your favourite exercise'),v:m.topEx[0],s:`${m.topEx[1]} ${L('φορές','times')}${m.topGroup?` · ${L('περισσότερο','mostly')} ${gName(m.topGroup[0])}`:''}`},
    m.bestRec?{i:'🏆',k:L('Μεγαλύτερο record','Biggest record'),v:`${m.bestRec.l.exercise}`,s:`${badgeText(m.bestRec.s).replace('🏆 ','')} · ${L('σύνολο','total')} ${m.records} records`}:{i:'🏆',k:'Records',v:`${m.records}`,s:m.records?'':L('ο επόμενος μήνας είναι δικός σου','next month is yours')},
    m.heavy&&{i:'💪',k:L('Βαρύτερο set','Heaviest set'),v:`${fmt(m.heavy.kg)} kg`,s:m.heavy.ex},
    m.waterL?{i:'💧',k:L('Νερό','Water'),v:`${fmtL(m.waterL*1000)} L`,s:L(`όσο ${Math.max(1,Math.round(m.waterL/1.5))} μπουκάλια 1,5 L`,`about ${Math.max(1,Math.round(m.waterL/1.5))} 1.5 L bottles`)}:null,
    m.stepsAvg!=null?{i:'👣',k:L('Βήματα','Steps'),v:fmtN(m.stepsTotal),s:L(`${fmtN(m.stepsAvg)} τη μέρα · ~${fmtN(m.stepsTotal*.75/1000)} km`,`${fmtN(m.stepsAvg)} a day · ~${fmtN(m.stepsTotal*.75/1000)} km`)}:null,
    m.wChange!=null?{i:'⚖️',k:L('Βάρος','Weight'),v:`${m.wChange<=0?'−':'+'}${fmtKg(Math.abs(m.wChange))} kg`,s:L('από το πρώτο ως το τελευταίο ζύγισμα του μήνα','from the first to the last weigh-in of the month')}:null,
  ].filter(Boolean);
}
function renderWrapped(){
  document.querySelectorAll('#wrappedMonths .chip').forEach(b=>b.classList.toggle('on',Number(b.dataset.m)===wrappedOffset));
  const m=monthData(monthKeyOf(wrappedOffset));
  $('#wrappedShare').hidden=!m.hasAny;
  $('#wrappedBody').innerHTML=m.hasAny
    ?`<div class="wrapHead"><span>GymPilot Wrapped</span><b>${cap(monthName(m.ym))}</b></div>${wrappedItems(m).map(x=>`<div class="wrapItem"><span class="wrapIcon">${x.i}</span><div><small>${x.k}</small><b>${escapeHtml(x.v)}</b>${x.s?`<span>${escapeHtml(x.s)}</span>`:''}</div></div>`).join('')}`
    :`<div class="empty">${L('Δεν υπάρχουν δεδομένα γι’ αυτόν τον μήνα ακόμα.','No data for this month yet.')}</div>`;
}
$('#wrappedMonths').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;wrappedOffset=Number(b.dataset.m);renderWrapped()};
function wrappedImage(m){
  const W=1080,H=1920,c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d');
  const bg=g.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#24180f');bg.addColorStop(.55,'#3a2719');bg.addColorStop(1,'#14301f');g.fillStyle=bg;g.fillRect(0,0,W,H);
  const glow=g.createRadialGradient(W*.85,120,0,W*.85,120,700);glow.addColorStop(0,'rgba(34,165,95,.35)');glow.addColorStop(1,'rgba(34,165,95,0)');g.fillStyle=glow;g.fillRect(0,0,W,H);
  drawMark(g,70,90,1.3);
  g.font=canvasFont(800,60);g.fillStyle='#fff';g.fillText('Gym',220,160);const gw=g.measureText('Gym').width;g.fillStyle='#4cd88a';g.fillText('Pilot',220+gw,160);
  g.font=canvasFont(700,34);g.fillStyle='#4cd88a';g.fillText('WRAPPED',222,205);
  g.font=canvasFont(800,92);g.fillStyle='#fff';g.fillText(cap(monthName(m.ym)),70,370);
  let y=470;
  wrappedItems(m).slice(0,7).forEach(x=>{
    g.font=canvasFont(400,58);g.fillText(x.i,70,y+62);
    g.fillStyle='#d8cdbf';g.font=canvasFont(700,30);g.fillText(x.k.toUpperCase(),170,y+20);
    g.fillStyle='#fff';let size=70;g.font=canvasFont(800,size);while(g.measureText(x.v).width>840&&size>40){size-=4;g.font=canvasFont(800,size)}g.fillText(x.v,170,y+92);
    if(x.s){g.fillStyle='#4cd88a';g.font=canvasFont(600,30);g.fillText(x.s,170,y+138)}
    g.fillStyle='#fff';y+=196;
  });
  g.fillStyle='#d8cdbf';g.font=canvasFont(600,30);g.textAlign='center';g.fillText('Lift. Push. Progress.',W/2,H-70);
  return c;
}
$('#wrappedShare').onclick=()=>{const m=monthData(monthKeyOf(wrappedOffset));shareCanvas(wrappedImage(m),`GymPilot-Wrapped-${m.ym}.png`,`GymPilot Wrapped · ${monthName(m.ym)}`)};
const wrappedDlg=$('#wrappedDialog');
function maybeShowWrapped(){
  const cur=monthKeyOf(0);
  if(settings.wrappedSeen===cur||document.querySelector('dialog[open]')||midEntry())return;
  const prev=monthKeyOf(-1),m=monthData(prev);
  settings.wrappedSeen=cur;persist();
  if(!m.workouts)return;
  $('#wrappedDlgTitle').textContent=L(`🎁 Το Wrapped του ${monthName(prev,true)}`,`🎁 Your ${monthName(prev,true)} Wrapped`);
  wrappedDlg.showModal();
}
wrappedDlg.querySelectorAll('[data-wd-close]').forEach(b=>b.onclick=()=>wrappedDlg.close());
$('#wrappedOpen').onclick=()=>{wrappedDlg.close();wrappedOffset=-1;switchTab('stats');setTimeout(()=>document.querySelector('.wrappedCard').scrollIntoView({behavior:'smooth',block:'start'}),60)};

/* ───── achievements: worked out from your data; the unlock day is remembered ───── */
const B=(id,i,goal,v,el,en,unit)=>({id,i,goal,v,el,en,unit});
const BADGES=[
  B('first','🎬',1,s=>s.sessions,['Πρώτη προπόνηση','Η πρώτη καταγραφή σου','Το πιο δύσκολο βήμα είναι το πρώτο. Ξεκλειδώνει με την πρώτη άσκηση που αποθηκεύεις.'],['First workout','Your first entry','The hardest step is the first one. Unlocks with the first exercise you save.']),
  B('w10','💪',10,s=>s.days,['10 προπονήσεις','10 μέρες προπόνησης','Μετράνε οι διαφορετικές μέρες που γυμνάστηκες, όχι οι ασκήσεις. Δέκα μέρες και η συνήθεια έχει αρχίσει.'],['10 workouts','10 training days','Counts the different days you trained, not exercises. Ten days and the habit has started.']),
  B('w50','🔥',50,s=>s.days,['50 προπονήσεις','50 μέρες προπόνησης','Πενήντα μέρες στο γυμναστήριο. Σε αυτό το σημείο οι περισσότεροι βλέπουν ξεκάθαρη αλλαγή σε δύναμη και σώμα.'],['50 workouts','50 training days','Fifty days in the gym. By now most people see a clear change in strength and body.']),
  B('w100','🏛️',100,s=>s.days,['100 προπονήσεις','100 μέρες προπόνησης','Εκατό μέρες προπόνησης. Η γυμναστική είναι πια κομμάτι του ποιος είσαι.'],['100 workouts','100 training days','A hundred training days. Training is now part of who you are.']),
  B('sets500','🧱',500,s=>s.sets,['500 sets','Σύνολο sets','Όλα τα sets που έχεις καταγράψει, σε όλες τις ασκήσεις. Κάθε set είναι ένα τούβλο.'],['500 sets','Total sets','Every set you have logged, across all exercises. Each one is a brick.']),
  B('sets2k','🏗️',2000,s=>s.sets,['2.000 sets','Σύνολο sets','Δύο χιλιάδες sets: αυτό είναι χτίσιμο σε βάθος χρόνου.'],['2,000 sets','Total sets','Two thousand sets: that is building over the long run.']),
  B('pr1','🏆',1,s=>s.records,['Πρώτο record','Ξεπέρασες τον εαυτό σου','Record = το top set μιας άσκησης ξεπερνά ό,τι καλύτερο είχες κάνει ποτέ σε αυτή (κιλά, ή επαναλήψεις στις ασκήσεις χωρίς βάρος).'],['First record','You beat yourself','A record is when an exercise’s top set beats your all-time best on it (kg, or reps for bodyweight moves).']),
  B('pr25','👑',25,s=>s.records,['25 records','Νέα records συνολικά','Είκοσι πέντε φορές ξεπέρασες το προσωπικό σου ρεκόρ. Η προοδευτική υπερφόρτωση δουλεύει.'],['25 records','New records in total','Twenty-five times past your personal best. Progressive overload is working.']),
  B('ups10','📈',10,s=>s.ups,['10 φορές πάνω','Ασκήσεις που ανέβηκαν','Κάθε φορά που το top set μιας άσκησης είναι πάνω από την προηγούμενη φορά (▲ ή 🏆 στο Ιστορικό). Δέκα τέτοιες φορές.'],['10 times up','Exercises that went up','Every time an exercise’s top set beats the previous time (▲ or 🏆 in History). Ten of those.']),
  B('club100','💯',100,s=>s.maxKg,['Club 100','100 kg σε ένα set','Ένα set με 100 κιλά ή παραπάνω, σε οποιαδήποτε άσκηση.'],['Club 100','100 kg in one set','One set with 100 kg or more, on any exercise.'],' kg'),
  B('club150','🦍',150,s=>s.maxKg,['Club 150','150 kg σε ένα set','Ένα set με 150 κιλά ή παραπάνω. Σοβαρή δύναμη.'],['Club 150','150 kg in one set','One set with 150 kg or more. Serious strength.'],' kg'),
  B('ton10','🚚',10,s=>s.vol/1000,['10 τόνοι','Συνολικός όγκος','Όγκος = κιλά × επαναλήψεις για κάθε set. Ξεκλειδώνει όταν όλες οι προπονήσεις σου φτάσουν τους 10 τόνους.'],['10 tonnes','Total volume','Volume is kg × reps for every set. Unlocks when all your workouts add up to 10 tonnes.'],' t'),
  B('ton100','🚢',100,s=>s.vol/1000,['100 τόνοι','Συνολικός όγκος','Εκατό τόνοι συνολικά: όσο ένα μικρό πλοίο.'],['100 tonnes','Total volume','A hundred tonnes in total: about a small ship.'],' t'),
  B('kcal5k','🔥',5000,s=>s.kcal,['5.000 kcal','Θερμίδες από προπονήσεις','Εκτίμηση από τη διάρκεια κάθε προπόνησης και το βάρος σου (MET 5). Ξεκλειδώνει όταν το σύνολο φτάσει τις 5.000.'],['5,000 kcal','Calories from workouts','Estimated from each workout’s length and your weight (MET 5). Unlocks when the total reaches 5,000.'],' kcal'),
  B('streak4','📆',4,s=>s.streak,['Σερί 4 εβδομάδων','Ο εβδομαδιαίος στόχος 4 φορές στη σειρά','Πιάνεις τον στόχο προπονήσεων της εβδομάδας (τον ορίζεις στις Ρυθμίσεις) τέσσερις εβδομάδες συνεχόμενα.'],['4-week streak','The weekly goal 4 weeks in a row','Hit your weekly workout goal (set it in Settings) four weeks in a row.']),
  B('streak12','⚡',12,s=>s.streak,['Σερί 12 εβδομάδων','Ο εβδομαδιαίος στόχος 12 φορές στη σειρά','Τρεις μήνες χωρίς να χάσεις εβδομάδα. Αυτή είναι η πραγματική συνέπεια.'],['12-week streak','The weekly goal 12 weeks in a row','Three months without missing a week. That is real consistency.']),
  B('allGroups','🧩',1,s=>s.allGroupsWeek,['Ολόκληρο σώμα','Όλες οι 8 μυϊκές ομάδες σε μία εβδομάδα','Στήθος, πλάτη, ραχιαίοι, ώμοι, δικέφαλα, τρικέφαλα, πόδια και κοιλιακοί, όλα μέσα στην ίδια εβδομάδα (Δευτέρα–Κυριακή).'],['Whole body','All 8 muscle groups in one week','Chest, back, lats, shoulders, biceps, triceps, legs and abs, all within one Monday–Sunday week.']),
  B('lats','🦅',10,s=>s.lats,['Φτερά','10 προπονήσεις ραχιαίων','Δέκα μέρες με άσκηση για ραχιαίους (lat pulldown, pull-ups…). Οι ραχιαίοι δίνουν το σχήμα V.'],['Wings','10 lat workouts','Ten days with a lats exercise (lat pulldown, pull-ups…). Lats give you the V shape.']),
  B('planWeek','🗓️',1,s=>s.planWeek,['Πιστός στο πρόγραμμα','Μια εβδομάδα με όλες τις προπονήσεις του προγράμματος','Στήσε πρόγραμμα προπόνησης και κάνε κάθε προγραμματισμένη μέρα μιας εβδομάδας (Δευτέρα–Κυριακή).'],['Plan keeper','A week with every planned workout','Set up a workout plan and train on every planned day of one Monday–Sunday week.']),
  B('early','🌅',1,s=>s.early,['Πρωινός τύπος','Προπόνηση πριν τις 8:00','Μια προπόνηση με ώρα πριν τις 8 το πρωί.'],['Early bird','A workout before 8:00','A workout logged with a time before 8 in the morning.']),
  B('night','🌙',1,s=>s.night,['Νυχτοπούλι','Προπόνηση μετά τις 22:00','Μια προπόνηση με ώρα από τις 10 το βράδυ και μετά.'],['Night owl','A workout after 22:00','A workout logged with a time from 10 pm onwards.']),
  B('water30','💧',30,s=>s.waterDays,['Υδάτινος','30 μέρες με στόχο νερού','Τριάντα μέρες που έπιασες τον ημερήσιο στόχο νερού (Διατροφή → Νερό).'],['Hydrated','30 days on your water goal','Thirty days that hit your daily water goal (Nutrition → Water).']),
  B('steps10k','👟',10000,s=>s.maxSteps,['10.000 βήματα','Σε μία μέρα','Μια μέρα με 10.000 βήματα ή περισσότερα (Στατιστικά → Βήματα).'],['10,000 steps','In one day','A day with 10,000 steps or more (Stats → Steps).']),
  B('weight','🎯',1,s=>s.weightReached,['Στόχος κιλών','Έπιασες τον στόχο βάρους','Βάλε στόχο κιλών στις Ρυθμίσεις. Ξεκλειδώνει όταν ένα ζύγισμα τον πιάσει.'],['Weight goal','You reached your weight goal','Set a weight goal in Settings. Unlocks when a weigh-in reaches it.']),
  B('meals7','🥗',7,s=>s.fullMeals,['Καθαρή εβδομάδα','7 μέρες με όλα τα γεύματα','Επτά μέρες που τσέκαρες όλα τα γεύματα του προγράμματος διατροφής σου.'],['Clean week','7 days with every meal','Seven days on which you checked off every meal in your nutrition plan.']),
];
const bText=b=>{const[t,d,x]=b[lang];return{t,d,x}};
let badges=load('wt_badges',{});   // {id: "2026-10-04"}
if(!isObj(badges))badges={};
function badgeStats(){
  const st=computeStatuses();let maxKg=0,early=0,night=0;
  logs.forEach(l=>{l.sets.forEach(s=>{if(s.kg>maxKg)maxKg=s.kg});const tm=timeOf(l);if(tm){const h=Number(tm.slice(0,2));if(h<8)early++;if(h>=22)night++}});
  const perWeek={};logs.forEach(l=>{(perWeek[weekStart(l.date)]||(perWeek[weekStart(l.date)]=new Set())).add(l.group)});
  let planWeek=0;
  if(training){
    const days=new Set(logs.map(l=>l.date));
    Object.keys(perWeek).forEach(w=>{
      if(addDays(w,6)>=today())return;   // only finished weeks
      const planned=[0,1,2,3,4,5,6].map(i=>addDays(w,i)).filter(d=>d>=(training.since||'')&&planFor(d)?.groups.length);
      if(planned.length&&planned.every(d=>days.has(d)))planWeek=1;
    });
  }
  const vals=[...st.values()];
  return{sessions:logs.length,days:new Set(logs.map(l=>l.date)).size,sets:totalSets(logs),
    records:vals.filter(x=>x.cls==='record').length,ups:vals.filter(x=>x.cls==='record'||x.cls==='up').length,maxKg,vol:logs.filter(isWeighted).reduce((a,l)=>a+volume(l),0),
    kcal:kcalSum(logs),streak:bestWeekStreak(),early,night,planWeek,
    allGroupsWeek:Object.values(perWeek).some(gs=>GROUP_ORDER.every(g=>gs.has(g)))?1:0,lats:new Set(logs.filter(l=>l.group==='Lats').map(l=>l.date)).size,
    waterDays:Object.keys(water).filter(d=>dayWater(d)>=settings.goalWater).length,
    maxSteps:Math.max(0,...Object.values(steps)),weightReached:goalProgress(latestWeight()?.kg)?.reached?1:0,
    fullMeals:plan.meals.length?Object.values(food).filter(f=>plan.meals.every(m=>f.meals.some(x=>x.id===m.id))).length:0};
}
function checkBadges(silent){
  const s=badgeStats(),fresh=BADGES.filter(b=>!badges[b.id]&&b.v(s)>=b.goal);
  if(!fresh.length)return;
  fresh.forEach(b=>badges[b.id]=today());
  try{localStorage.setItem('wt_badges',JSON.stringify(badges))}catch{}
  if(!$('#view-stats').hidden)renderBadges();
  if(silent)return;
  confetti();toast(fresh.length===1?`🏅 ${L('Νέο επίτευγμα','New achievement')}: ${fresh[0].i} ${bText(fresh[0]).t}`:L(`🏅 ${fresh.length} νέα επιτεύγματα!`,`🏅 ${fresh.length} new achievements!`));
}
let badgeTimer=null;
const scheduleBadges=()=>{clearTimeout(badgeTimer);badgeTimer=setTimeout(()=>checkBadges(false),700)};
const badgeNum=(v,b)=>b.unit===' t'?fmt(Math.round(v*10)/10):fmtN(v);
function badgeList(){
  const s=badgeStats(),list=BADGES.map(b=>({...b,val:b.v(s),at:badges[b.id]}));
  return[...list.filter(b=>b.at).sort((a,b)=>b.at.localeCompare(a.at)),...list.filter(b=>!b.at).sort((a,b)=>b.val/b.goal-a.val/a.goal)];
}
const achHtml=b=>`<button type="button" class="ach${b.at?' got':''}" data-badge="${b.id}"><span class="bIcon">${b.i}</span><b>${bText(b).t}</b><small>${b.at?formatDate(b.at):bText(b).d}</small>${b.at?'':`<div class="bBar"><i style="width:${Math.min(100,b.val/b.goal*100).toFixed(0)}%"></i></div><small class="bProg">${badgeNum(Math.min(b.val,b.goal),b)} / ${badgeNum(b.goal,b)}${b.unit||''}</small>`}</button>`;
function renderBadges(){
  const list=badgeList(),got=list.filter(b=>b.at);
  $('#badgeCount').textContent=`${got.length}/${BADGES.length}`;
  $('#badgeBar').style.width=`${got.length/BADGES.length*100}%`;
  // the card shows the latest earned and the closest to unlock; the full list opens in its own section
  $('#badgeGrid').innerHTML=[...got.slice(0,3),...list.filter(b=>!b.at).slice(0,3)].map(achHtml).join('');
  if($('#achDialog').open)$('#achAll').innerHTML=achSection(list);
}
const achSection=list=>{
  const got=list.filter(b=>b.at),locked=list.filter(b=>!b.at);
  return`${got.length?`<h4>${L('Κερδισμένα','Earned')} · ${got.length}</h4><div class="badgeGrid">${got.map(achHtml).join('')}</div>`:''}<h4>${L('Για ξεκλείδωμα','To unlock')} · ${locked.length}</h4><div class="badgeGrid">${locked.map(achHtml).join('')}</div>`;
};
function openBadge(id){
  const b=badgeList().find(x=>x.id===id);if(!b)return;
  const tx=bText(b),pct=Math.min(100,b.val/b.goal*100);
  $('#badgeDetail').innerHTML=`<div class="bdIcon${b.at?' got':''}">${b.i}</div><h3>${tx.t}</h3><p class="bdDesc">${tx.d}</p>
    <div class="bdStatus ${b.at?'got':''}">${b.at?`✅ ${L('Ξεκλειδώθηκε στις','Unlocked on')} ${formatDate(b.at)}`:`🔒 ${L('Κλειδωμένο','Locked')} · ${badgeNum(Math.min(b.val,b.goal),b)} / ${badgeNum(b.goal,b)}${b.unit||''}`}</div>
    ${b.at?'':`<div class="wBar"><i style="width:${pct.toFixed(0)}%"></i></div>`}
    <h4>${L('Πώς ξεκλειδώνει','How to unlock')}</h4><p class="bdHow">${tx.x}</p>`;
  $('#badgeDialog').showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-badge]');if(b)openBadge(b.dataset.badge)});
$('#achOpen').onclick=()=>{$('#achAll').innerHTML=achSection(badgeList());$('#achDialog').showModal()};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
onPersist=scheduleBadges;
