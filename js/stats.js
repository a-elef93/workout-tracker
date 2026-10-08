/* ───── Stats: coach, recovery, week rings, consistency months, progress chart, donut, records, year ───── */
const DAY_LETTERS=()=>[0,1,2,3,4,5,6].map(i=>dayName(i,'narrow'));

function renderCoach(){
  const items=coachInsights();
  $('#coachList').innerHTML=items.map(insightHtml).join('');
  const a=planAdherence();
  $('#coachPlan').hidden=!a;
  if(a)$('#coachPlan').innerHTML=`🗓️ ${L('Τήρηση προγράμματος','Plan followed')}: <b>${a.hit}/${a.planned}</b> ${L('μέρες (4 εβδομάδες)','days (4 weeks)')}`;
}

/* ───── muscle recovery map ───── */
const REC_COLORS={ready:'#2fbf71',almost:'#e0a336',rest:'#e07a5f',never:'var(--rec-never)'};
const logMoment=l=>{const tm=timeOf(l);return tm?new Date(`${l.date}T${tm}:00`).getTime():parseDay(l.date).getTime()+6*36e5};
function groupRecovery(){
  const last={},out={};
  logs.forEach(l=>{const t=logMoment(l),g=last[l.group];if(!g||t>g.t)last[l.group]={t,date:l.date}});
  orderedGroups([...Object.keys(exercises),...Object.keys(last)]).forEach(g=>{
    const Lg=last[g];
    if(!Lg){out[g]={status:'never'};return}
    const sets=totalSets(logs.filter(l=>l.group===g&&l.date===Lg.date));
    const need=sets>=12?72:48,hours=Math.max(0,(Date.now()-Lg.t)/36e5),p=hours/need;   // a big session (12+ sets) needs an extra day
    out[g]={status:p>=1?'ready':p>=.6?'almost':'rest',hours,left:Math.max(0,need-hours),date:Lg.date,sets};
  });
  return out;
}
function bodySvg(c){
  const col=g=>`style="fill:${REC_COLORS[c[g]?.status||'never']}"`;
  const base=`<g style="fill:var(--body)"><circle cx="60" cy="20" r="13"/><rect x="54" y="30" width="12" height="10" rx="3"/><path d="M34 44Q60 36 86 44L84 130Q60 138 36 130Z"/><rect x="17" y="46" width="17" height="46" rx="8"/><rect x="86" y="46" width="17" height="46" rx="8"/><rect x="14" y="92" width="14" height="42" rx="7"/><rect x="92" y="92" width="14" height="42" rx="7"/><circle cx="21" cy="140" r="6"/><circle cx="99" cy="140" r="6"/><rect x="37" y="130" width="22" height="66" rx="10"/><rect x="61" y="130" width="22" height="66" rx="10"/><rect x="39" y="196" width="18" height="46" rx="8"/><rect x="63" y="196" width="18" height="46" rx="8"/></g>`;
  const front=`<g>${base}
    <g ${col('Shoulders')}><ellipse cx="30" cy="52" rx="11" ry="9"/><ellipse cx="90" cy="52" rx="11" ry="9"/></g>
    <g ${col('Chest')}><path d="M38 52Q48 45 58 49L58 74Q47 80 38 72Z"/><path d="M82 52Q72 45 62 49L62 74Q73 80 82 72Z"/></g>
    <g ${col('Biceps')}><ellipse cx="25.5" cy="74" rx="7" ry="14"/><ellipse cx="94.5" cy="74" rx="7" ry="14"/></g>
    <g ${col('Abs')}><rect x="47" y="80" width="26" height="46" rx="7"/></g><path d="M60 82V124M48 95H72M48 110H72" stroke="#fff" stroke-width="1.6" opacity=".8"/>
    <g ${col('Legs')}><rect x="40" y="136" width="17" height="52" rx="8"/><rect x="63" y="136" width="17" height="52" rx="8"/><rect x="42" y="202" width="12" height="34" rx="6"/><rect x="66" y="202" width="12" height="34" rx="6"/></g></g>`;
  // back: upper back (traps, rhomboids, lower back) and the lats as wings underneath
  const back=`<g transform="translate(130 0)">${base}
    <g ${col('Back')}><path d="M40 48Q60 41 80 48L78 70Q60 76 42 70Z"/><rect x="50" y="106" width="20" height="20" rx="5"/></g>
    <g ${col('Lats')}><path d="M41 72Q50 77 58 76L58 104Q48 100 43 92Z"/><path d="M79 72Q70 77 62 76L62 104Q72 100 77 92Z"/></g>
    <g ${col('Shoulders')}><ellipse cx="30" cy="52" rx="11" ry="9"/><ellipse cx="90" cy="52" rx="11" ry="9"/></g>
    <g ${col('Triceps')}><ellipse cx="25.5" cy="76" rx="7" ry="14"/><ellipse cx="94.5" cy="76" rx="7" ry="14"/></g>
    <g ${col('Legs')}><ellipse cx="49" cy="138" rx="11" ry="9"/><ellipse cx="71" cy="138" rx="11" ry="9"/><rect x="40" y="150" width="17" height="40" rx="8"/><rect x="63" y="150" width="17" height="40" rx="8"/><ellipse cx="48" cy="214" rx="7" ry="15"/><ellipse cx="72" cy="214" rx="7" ry="15"/></g></g>`;
  return`<svg viewBox="0 0 250 262" role="img" aria-label="${L('Χάρτης αποκατάστασης μυών','Muscle recovery map')}">${front}${back}<text x="60" y="258" text-anchor="middle" class="bodyLbl">${L('Μπροστά','Front')}</text><text x="190" y="258" text-anchor="middle" class="bodyLbl">${L('Πίσω','Back')}</text></svg>`;
}
const hoursTxt=h=>h>=36?L(`~${Math.round(h/24)} μέρες`,`~${Math.round(h/24)} days`):L(`~${Math.max(1,Math.round(h))} ώρες`,`~${Math.max(1,Math.round(h))} hours`);
function renderRecovery(){
  const r=groupRecovery();
  $('#recoveryMap').innerHTML=bodySvg(r);
  const order={ready:0,never:1,almost:2,rest:3};
  $('#recoveryList').innerHTML=Object.entries(r).sort((a,b)=>order[a[1].status]-order[b[1].status]).map(([g,x])=>{
    const txt=x.status==='never'?L('δεν έχει δουλευτεί','not trained yet'):x.status==='ready'?L(`έτοιμο · τελευταία ${shortDate(x.date)}`,`ready · last ${shortDate(x.date)}`):L(`έτοιμο σε ${hoursTxt(x.left)}`,`ready in ${hoursTxt(x.left)}`);
    return`<div class="recRow"><i style="background:${REC_COLORS[x.status]}"></i><b>${escapeHtml(gName(g))}</b><span>${txt}</span></div>`;
  }).join('');
}

/* ───── rings & tiles ───── */
function ringSvg(r,p,color){
  const c=2*Math.PI*r;
  return`<circle cx="70" cy="70" r="${r}" fill="none" style="stroke:${color}" stroke-opacity=".18" stroke-width="12"/>`+(p>0?`<circle class="ringArc" cx="70" cy="70" r="${r}" fill="none" style="stroke:${color};--c:${c}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-Math.min(1,p))}" transform="rotate(-90 70 70)"/>`:'');
}
function renderRings(){
  const w=weekData(),totalGroups=Object.keys(exercises).length||1;
  const items=[
    {label:L('Προπονήσεις','Workouts'),v:w.days.size,goal:settings.goalWorkouts,color:'var(--ring-1)',r:60},
    {label:'Sets',v:w.sets,goal:settings.goalSets,color:'var(--ring-2)',r:46},
    {label:L('Μυϊκές ομάδες','Muscle groups'),v:w.groups.size,goal:totalGroups,color:'var(--ring-3)',r:32},
  ];
  const pct=Math.round(items.reduce((a,i)=>a+Math.min(1,i.v/i.goal),0)/items.length*100);
  $('#rings').innerHTML=`<svg viewBox="0 0 140 140" role="img" aria-label="${L('Πρόοδος εβδομάδας','Week progress')} ${pct}%">${items.map(i=>ringSvg(i.r,i.v/i.goal,i.color)).join('')}<text x="70" y="70" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="800" style="fill:var(--text);font-family:inherit">${pct}%</text></svg>`;
  $('#ringLegend').innerHTML=items.map(i=>`<li style="--c:${i.color}"><i></i><b>${i.v}<small> / ${i.goal}</small></b><span>${i.label}</span></li>`).join('');
  const t=today();
  $('#weekStrip').innerHTML=DAY_LETTERS().map((Lt,i)=>{
    const d=addDays(w.start,i),gs=[...new Set(w.ls.filter(l=>l.date===d).map(l=>l.group))];
    let bg='';
    if(gs.length){const step=100/gs.length;bg=` style="background:conic-gradient(${gs.map((g,k)=>`${groupColor(g)} ${k*step}% ${(k+1)*step}%`).join(',')})"`}
    return`<div class="wd${gs.length?' done':''}${d===t?' today':''}"><div class="wc"${bg}>${gs.length?'✓':''}</div>${Lt}</div>`;
  }).join('');
}
function renderTiles(){
  const days=new Set(logs.map(l=>l.date)).size;
  const vol=logs.reduce((a,l)=>a+l.sets.reduce((b,s)=>b+s.kg*s.reps,0),0);
  const records=[...computeStatuses().values()].filter(s=>s.cls==='record').length;
  const kcal=kcalSum(logs),weekKcal=kcalSum(weekData().ls);
  $('#tiles').innerHTML=[
    ['🔥',weeklyStreak(),L(`εβδομάδες σερί (στόχος ${settings.goalWorkouts}×)`,`week streak (goal ${settings.goalWorkouts}×)`)],
    ['💪',days,L('προπονήσεις συνολικά','workouts in total')],
    ['🏋️',vol>=1000?`${fmt(vol/1000)} t`:`${fmt(vol)} kg`,L('συνολικός όγκος','total volume')],
    ['🏆',records,L('νέα records','new records')],
    ['⚡',fmtN(weekKcal),L('kcal προπόνησης αυτή την εβδομάδα','workout kcal this week')],
    ['🍩',fmtN(kcal),L('kcal προπόνησης συνολικά','workout kcal in total')],
  ].map(([i,v,l])=>`<div class="tile"><div class="ti2">${i}</div><b>${v}</b><span>${l}</span></div>`).join('');
}

/* ───── "Stay consistent": the last months, day by day ───── */
let consistencyMonths=3;
function renderConsistency(){
  const tr=new Map();
  logs.forEach(l=>tr.set(l.date,'var(--brand)'));
  const months=Array.from({length:consistencyMonths},(_,i)=>monthKeyOf(i-consistencyMonths+1));
  $('#consistencyBody').innerHTML=weekdayHead()+months.map(ym=>monthGridHtml(ym,tr)).join('');
  const since=months[0]+'-01',n=[...new Set(logs.filter(l=>l.date>=since).map(l=>l.date))].length;
  $('#consistencyStats').innerHTML=`<div><b>${n}</b> ${L(`μέρες προπόνησης τους τελευταίους ${consistencyMonths} μήνες`,`training days in the last ${consistencyMonths} months`)} · ${L('σερί','streak')} <b>${weeklyStreak()}</b> ${L('εβδ.','wks')}</div>`;
  $('#consistencyMore').hidden=consistencyMonths>=12;
}
$('#consistencyMore').onclick=()=>{consistencyMonths=Math.min(12,consistencyMonths+3);renderConsistency()};

/* ───── "Progress Every Time": every set as a step, weight in amber and reps in green ───── */
let chartExercise=null,chartMetric='kg',chartRange='all',chartView='sets';
function seriesFor(ex,metric){
  return logs.filter(l=>l.exercise===ex).sort(byOldest).slice(-20).map(l=>({date:l.date,unit:unit(l),v:metric==='kg'?score(l):metric==='e1rm'?bestE1rm(l):volume(l)}));
}
function setsChart(ex){
  let ss=logs.filter(l=>l.exercise===ex).sort(byOldest);
  if(chartRange==='last2')ss=ss.slice(-2);
  const pts=[];ss.forEach((l,si)=>l.sets.forEach((s,k)=>pts.push({...s,si,k,date:l.date})));
  const capped=pts.slice(-60),n=capped.length,weighted=capped.some(p=>p.kg>0);
  const W=340,H=236,Lm=34,R=30,T=16,B=26;
  const kgTop=T,kgBot=weighted?H-B-62:H-B-8,rTop=weighted?H-B-46:T,rBot=H-B-8;
  const x=i=>Lm+(n===1?(W-Lm-R)/2:i*(W-Lm-R)/(n-1));
  const scale=(vals,top,bot)=>{let mn=Math.min(...vals),mx=Math.max(...vals);if(mn===mx){mn-=1;mx+=1}return v=>bot-(v-mn)/(mx-mn)*(bot-top)};
  const yk=scale(capped.map(p=>p.kg),kgTop,kgBot),yr=scale(capped.map(p=>p.reps),rTop,rBot);
  const path=(f)=>capped.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${f(p).toFixed(1)}`).join('');
  // a faint line where each session starts
  let seps='',labels='';
  capped.forEach((p,i)=>{if(i&&p.si!==capped[i-1].si){const sx=((x(i)+x(i-1))/2).toFixed(1);seps+=`<line class="sep" x1="${sx}" x2="${sx}" y1="${T-6}" y2="${H-B}"/>`}});
  if(n){labels=`<text x="${Lm}" y="${H-8}">${shortDate(capped[0].date)}</text>${n>1?`<text x="${W-R}" y="${H-8}" text-anchor="end">${shortDate(capped[n-1].date)}</text>`:''}`}
  const kgVals=capped.map(p=>p.kg),rVals=capped.map(p=>p.reps);
  const axis=weighted?`<text class="kgT" x="${Lm-6}" y="${kgTop+4}" text-anchor="end">${fmt(Math.max(...kgVals))}</text><text class="kgT" x="${Lm-6}" y="${kgBot+4}" text-anchor="end">${fmt(Math.min(...kgVals))}</text>`:'';
  const raxis=`<text class="rT" x="${W-R+6}" y="${rTop+4}">${Math.max(...rVals)}</text>${Math.min(...rVals)!==Math.max(...rVals)?`<text class="rT" x="${W-R+6}" y="${rBot+4}">${Math.min(...rVals)}</text>`:''}`;
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Πρόοδος ανά set','Progress per set')}">${seps}${axis}${raxis}
    ${weighted?`<path class="kgLine" d="${path(p=>yk(p.kg))}"/>${capped.map((p,i)=>`<circle class="kgPt" cx="${x(i).toFixed(1)}" cy="${yk(p.kg).toFixed(1)}" r="3.4"/>`).join('')}`:''}
    <path class="rLine" d="${path(p=>yr(p.reps))}"/>${capped.map((p,i)=>`<circle class="rPt" cx="${x(i).toFixed(1)}" cy="${yr(p.reps).toFixed(1)}" r="3.4"/>`).join('')}
    ${labels}</svg>`;
}
function lineChart(pts){
  const W=320,H=170,Lm=34,R=12,T=12,B=26,n=pts.length;
  let min=Math.min(...pts.map(p=>p.v)),max=Math.max(...pts.map(p=>p.v));
  if(min===max){min-=1;max+=1}
  const pd=(max-min)*.15;min=Math.max(0,min-pd);max+=pd;
  const x=i=>Lm+(n===1?(W-Lm-R)/2:i*(W-Lm-R)/(n-1)),y=v=>T+(1-(v-min)/(max-min))*(H-T-B);
  const line=pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area=`${line}L${x(n-1).toFixed(1)} ${H-B}L${x(0).toFixed(1)} ${H-B}Z`;
  const ticks=[min,(min+max)/2,max].map(v=>`<line class="grid" x1="${Lm}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${Lm-6}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${fmt(Math.round(v*2)/2)}</text>`).join('');
  let runMax=-Infinity;
  const dots=pts.map((p,i)=>{const pr=p.v>runMax&&i>0;runMax=Math.max(runMax,p.v);return`<circle class="pt${i===n-1?' last':''}${pr?' pr':''}" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i===n-1?5:3.5}"/>`}).join('');
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Γράφημα προόδου','Progress chart')}"><defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22a55f" stop-opacity=".28"/><stop offset="1" stop-color="#22a55f" stop-opacity="0"/></linearGradient><linearGradient id="lineG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34c07a"/><stop offset="1" stop-color="#15844a"/></linearGradient></defs>${ticks}<path d="${area}" fill="url(#areaG)"/><path class="line" d="${line}"/>${dots}<text x="${Lm}" y="${H-8}" text-anchor="start">${shortDate(pts[0].date)}</text>${n>1?`<text x="${W-R}" y="${H-8}" text-anchor="end">${shortDate(pts[n-1].date)}</text>`:''}</svg>`;
}
function renderChart(){
  const names=[...new Set([...logs].sort(byNewest).map(l=>l.exercise))];
  const sel=$('#chartExercise');
  const has=names.length>0;
  ['#chartTop','#chartToggles'].forEach(s=>$(s).hidden=!has);
  if(!has){sel.innerHTML='';$('#chart').innerHTML=`<div class="empty">${L('Κάνε την πρώτη καταγραφή για να δεις γράφημα προόδου.','Log your first workout to see a progress chart.')}</div>`;$('#chartSummary').innerHTML='';$('#metricChips').hidden=true;return}
  if(!names.includes(chartExercise))chartExercise=names[0];
  sel.innerHTML=names.map(n=>`<option${n===chartExercise?' selected':''}>${escapeHtml(n)}</option>`).join('');
  document.querySelectorAll('#chartRange button').forEach(b=>b.classList.toggle('on',b.dataset.r===chartRange));
  document.querySelectorAll('#chartView button').forEach(b=>b.classList.toggle('on',b.dataset.v===chartView));
  const lastLog=logs.filter(l=>l.exercise===chartExercise).sort(byNewest)[0],ls=lastLog.sets[lastLog.sets.length-1];
  $('#chartTop').innerHTML=`<b>${ls.reps} reps${ls.kg>0?` · ${fmt(ls.kg)} kg`:''}</b><span>${L('Τελευταίο set','Last set')}: ${formatDate(lastLog.date)}${timeOf(lastLog)?`, ${timeOf(lastLog)}`:''}</span>`;
  $('#chartRange').hidden=chartView!=='sets';
  $('#metricChips').hidden=chartView!=='stats';
  if(chartView==='sets'){
    $('#chart').innerHTML=setsChart(chartExercise);
    $('#chart').className='chartBox setsChart';
    const weighted=logs.some(l=>l.exercise===chartExercise&&isWeighted(l));
    $('#chartSummary').innerHTML=`<div class="setsLegend">${weighted?`<span><i class="kg"></i>${L('Κιλά','Weight')}</span>`:''}<span><i class="rp"></i>Reps</span><span><i class="sp"></i>${L('Νέα προπόνηση','New session')}</span></div>`;
    $('#chartSummary').className='';
    return;
  }
  $('#chart').className='chartBox';$('#chartSummary').className='chartSummary';
  const bodyweight=!logs.some(l=>l.exercise===chartExercise&&isWeighted(l));
  $('[data-m="e1rm"]').hidden=bodyweight;
  if(bodyweight&&chartMetric==='e1rm')chartMetric='kg';
  document.querySelectorAll('#metricChips .chip').forEach(b=>b.classList.toggle('on',b.dataset.m===chartMetric));
  const pts=seriesFor(chartExercise,chartMetric),u=pts[pts.length-1].unit,vs=pts.map(p=>p.v),delta=vs[vs.length-1]-vs[0];
  $('#chart').innerHTML=lineChart(pts);
  $('#chartSummary').innerHTML=`<div><b>${fmt(Math.max(...vs))}${u}</b><span>${L('Καλύτερο','Best')}</span></div><div><b>${fmt(vs[vs.length-1])}${u}</b><span>${L('Τελευταίο','Latest')}</span></div><div class="${delta>0?'plus':delta<0?'minus':''}"><b>${delta>0?'+':delta<0?'−':''}${fmt(Math.abs(delta))}${u}</b><span>${L('Από την αρχή','Since start')}</span></div>`;
}
$('#chartExercise').onchange=e=>{chartExercise=e.target.value;renderChart()};
$('#metricChips').onclick=e=>{const b=e.target.closest('[data-m]');if(!b)return;chartMetric=b.dataset.m;renderChart()};
$('#chartRange').onclick=e=>{const b=e.target.closest('[data-r]');if(!b)return;chartRange=b.dataset.r;renderChart()};
$('#chartView').onclick=e=>{const b=e.target.closest('[data-v]');if(!b)return;chartView=b.dataset.v;renderChart()};

/* ───── sets per group (30 days), records ───── */
function renderDonut(){
  const since=addDays(today(),-29),per={};
  logs.filter(l=>l.date>=since).forEach(l=>per[l.group]=(per[l.group]||0)+l.sets.length);
  const rows=Object.entries(per).sort((a,b)=>b[1]-a[1]),total=rows.reduce((a,r)=>a+r[1],0);
  if(!total){$('#donut').innerHTML=`<div class="empty">${L('Καμία καταγραφή τις τελευταίες 30 ημέρες.','Nothing logged in the last 30 days.')}</div>`;return}
  const r=48,c=2*Math.PI*r;let acc=0;
  const arcs=rows.map(([g,n])=>{
    const len=n/total*c,gap=rows.length>1?Math.min(3,len*.4):0;
    const s=`<circle cx="60" cy="60" r="${r}" fill="none" stroke="${groupColor(g)}" stroke-width="16" stroke-dasharray="${len-gap} ${c-len+gap}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)"/>`;
    acc+=len;return s;
  }).join('');
  $('#donut').innerHTML=`<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="${L('Κατανομή sets ανά μυϊκή ομάδα','Sets per muscle group')}"><circle cx="60" cy="60" r="${r}" fill="none" style="stroke:var(--raised)" stroke-width="16"/>${arcs}</svg><div class="donutCenter"><b>${total}</b><span>sets</span></div></div><ul class="donutLegend">${rows.map(([g,n])=>`<li style="--c:${groupColor(g)}"><i></i><span>${escapeHtml(gName(g))}</span><em>${n} · ${Math.round(n/total*100)}%</em></li>`).join('')}</ul>`;
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
  let anyBw=false;
  $('#prList').innerHTML=rows.length?rows.map(r=>{
    const bw=r.e1?bwAt(r.date):null;if(bw)anyBw=true;
    return`<div class="pr" style="--c:${groupColor(r.group)}"><div class="prMain"><b>${escapeHtml(r.ex)}</b><span>${formatDate(r.date)}${r.e1?` · ${L('εκτ.','est.')} 1RM ${fmt(Math.round(r.e1*2)/2)}kg`:''}</span></div><div class="prVal"><b>${setText({kg:r.kg,reps:r.reps})}</b>${bw?`<em class="bwx">${(r.e1/bw).toLocaleString(LOC,{maximumFractionDigits:2})}× ${L('ΣΒ','BW')}</em>`:''}</div></div>`;
  }).join('')+(anyBw?`<p class="prNote">${L('× ΣΒ = εκτιμώμενο 1RM προς το σωματικό σου βάρος εκείνη την περίοδο.','× BW = estimated 1RM relative to your bodyweight at the time.')}</p>`:''):`<div class="empty">${L('Τα records σου θα εμφανιστούν εδώ.','Your records will show up here.')}</div>`;
}

/* ───── a year of training as a heatmap (sets per day) ───── */
function renderYear(){
  const t=today(),start=addDays(weekStart(t),-7*51),per={};
  logs.forEach(l=>{per[l.date]=(per[l.date]||0)+l.sets.length});
  const lvl=n=>!n?0:n<=6?1:n<=12?2:n<=20?3:4,S=13,G=3,Lm=26,T=16;
  let cells='',months='';
  for(let w=0;w<52;w++){
    const ws=addDays(start,w*7),x=Lm+w*(S+G);
    if(parseDay(ws).getDate()<=7||w===0){const m=parseDay(addDays(ws,6)).toLocaleDateString(LOC,{month:'short'});months+=`<text x="${x}" y="11" class="yrTxt">${m}</text>`}
    for(let d=0;d<7;d++){const day=addDays(ws,d);if(day>t)continue;cells+=`<rect x="${x}" y="${T+d*(S+G)}" width="${S}" height="${S}" rx="3" class="yl${lvl(per[day])}"/>`}
  }
  const W=Lm+52*(S+G),H=T+7*(S+G);
  $('#yearGrid').innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Προπονήσεις 52 εβδομάδων','52 weeks of training')}">${months}<text x="0" y="${T+11}" class="yrTxt">${dayName(0,'short')}</text><text x="0" y="${T+2*(S+G)+11}" class="yrTxt">${dayName(2,'short')}</text><text x="0" y="${T+4*(S+G)+11}" class="yrTxt">${dayName(4,'short')}</text>${cells}</svg>`;
  const sc=$('#yearScroll');sc.scrollLeft=sc.scrollWidth;   // most recent weeks first in view
  const year=t.slice(0,4),daysYear=new Set(logs.filter(l=>l.date.startsWith(year)).map(l=>l.date)).size;
  const wd=[0,0,0,0,0,0,0];new Set(logs.map(l=>l.date)).forEach(d=>wd[weekdayIdx(d)]++);
  const topDay=Math.max(...wd)?dayName(wd.indexOf(Math.max(...wd))):null;
  $('#yearStats').innerHTML=[L(`<b>${daysYear}</b> προπονήσεις μέσα στο ${year}`,`<b>${daysYear}</b> workouts in ${year}`),L(`Καλύτερο σερί: <b>${bestWeekStreak()}</b> εβδομάδες με στόχο ${settings.goalWorkouts}×`,`Best streak: <b>${bestWeekStreak()}</b> weeks at ${settings.goalWorkouts}×`),topDay?L(`Πιο συχνή μέρα: <b>${cap(topDay)}</b>`,`Most common day: <b>${cap(topDay)}</b>`):''].filter(Boolean).map(x=>`<div>${x}</div>`).join('');
}
