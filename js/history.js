/* ───── History: one collapsible box per workout (same day + muscle group), with time and calories ───── */
let historyFilter='all',historyLimit=15;
const sessionOpen=new Map();   // workout key → open/closed the user picked; otherwise only the latest is open

function renderFilters(){
  const used=orderedGroups(new Set([...Object.keys(exercises),...logs.map(l=>l.group)]));
  $('#filters').innerHTML=['all',...used].map(g=>`<button class="chip${historyFilter===g?' on':''}" data-g="${escapeHtml(g)}" style="--c:${g==='all'?'var(--brand)':groupColor(g)}">${g==='all'?L('Όλα','All'):escapeHtml(gName(g))}</button>`).join('');
}
function historyItemHtml(x,s){
  const id=escapeHtml(x.id),tm=timeOf(x);
  const meta=[tm?`🕒 ${tm}`:'',isWeighted(x)?`${L('Όγκος','Volume')} ${fmt(volume(x))}kg`:''].filter(Boolean).join(' · ');
  return`<div class="historyItem ${s.cls}"><div class="historyTop"><div><div class="historyTitle">${escapeHtml(x.exercise)}</div>${meta?`<div class="historyMeta">${meta}</div>`:''}<span class="badge">${badgeText(s)}</span></div><div class="itemBtns"><button class="remove" data-act="edit" data-id="${id}" aria-label="${L('Επεξεργασία','Edit')}">✎</button><button class="remove" data-act="del" data-id="${id}" aria-label="${L('Διαγραφή','Delete')}">✕</button></div></div><div class="historySets">${x.sets.map((t,i)=>`<span class="pill${i===s.idx?' top':''}"><small>S${i+1}</small>${setText(t)}</span>`).join('')}</div>${x.notes?`<div class="historyNotes">📝 ${escapeHtml(x.notes)}</div>`:''}</div>`;
}
function sessionHtml(items,status,isLatest,cal){
  const {date:d,group:g}=items[0],key=d+'|'+g,open=sessionOpen.get(key)??isLatest;
  const sameYear=d.slice(0,4)===today().slice(0,4);
  const day=parseDay(d).toLocaleDateString(LOC,{weekday:'long',day:'numeric',month:'long',...(sameYear?{}:{year:'numeric'})});
  const tm=items.map(timeOf).filter(Boolean)[0];
  const setsN=totalSets(items),vol=items.filter(isWeighted).reduce((a,x)=>a+volume(x),0);
  const recs=items.filter(x=>status.get(x.id).cls==='record').length;
  const kc=sessionCalories(items,cal);
  const meta=[items.length===1?L('1 άσκηση','1 exercise'):L(`${items.length} ασκήσεις`,`${items.length} exercises`),setsN===1?"1 set":`${setsN} sets`];
  if(vol)meta.push(`${L('Όγκος','Volume')} ${vol>=1000?`${fmt(vol/1000)}t`:`${fmt(vol)}kg`}`);
  return`<section class="session${open?'':' closed'}" style="--c:${groupColor(g)}" data-key="${escapeHtml(key)}"><div class="sessionHead"><div><div class="sessionTitle"><i class="gdot"></i>${escapeHtml(gName(g))}</div><div class="sessionDay">${day}${tm?` · ${tm}`:''}</div><div class="sessionMeta">${meta.join(' · ')}</div>${kc.kcal?`<div class="sessionKcal">🔥 ~${fmtN(kc.kcal)} kcal · ~${kc.minutes}′</div>`:''}</div><div class="sessionSide">${recs?`<span class="sessionRec">🏆 ${recs}</span>`:''}<button type="button" class="chev" aria-expanded="${open}" aria-label="${open?L('Κλείσιμο','Close'):L('Άνοιγμα','Open')}"></button></div></div><div class="sessionBody"><div class="sessionInner">${items.map(x=>historyItemHtml(x,status.get(x.id))).join('')}</div></div></section>`;
}
function renderHistory(){
  renderFilters();
  const status=computeStatuses(),cal=caloriesByDay(),byKey=new Map();
  logs.filter(x=>historyFilter==='all'||x.group===historyFilter).forEach(l=>{
    const k=l.date+'|'+l.group;
    if(!byKey.has(k))byKey.set(k,[]);
    byKey.get(k).push(l);
  });
  const sessions=[...byKey.values()].map(a=>a.sort(byOldest)).sort((a,b)=>byNewest(a[a.length-1],b[b.length-1]));
  const shown=sessions.slice(0,historyLimit);
  $('#history').innerHTML=shown.length?shown.map((a,i)=>sessionHtml(a,status,i===0,cal)).join(''):`<div class="empty">${L('Καμία καταγραφή εδώ ακόμα.','Nothing logged here yet.')}</div>`;
  $('#moreBtn').hidden=sessions.length<=historyLimit;
}
$('#filters').onclick=e=>{const b=e.target.closest('[data-g]');if(!b)return;historyFilter=b.dataset.g;historyLimit=15;renderHistory()};
$('#moreBtn').onclick=()=>{historyLimit+=15;renderHistory()};
function toggleSession(sec){
  const open=sec.classList.toggle('closed')===false,btn=sec.querySelector('.chev');
  sessionOpen.set(sec.dataset.key,open);
  btn.setAttribute('aria-expanded',open);btn.setAttribute('aria-label',open?L('Κλείσιμο','Close'):L('Άνοιγμα','Open'));
}
$('#history').onclick=e=>{
  const head=e.target.closest('.sessionHead');
  if(head)return toggleSession(head.closest('.session'));
  const b=e.target.closest('[data-act]');if(!b)return;
  if(b.dataset.act==='edit')return startEdit(b.dataset.id);
  if(!confirm(L('Διαγραφή αυτής της καταγραφής;','Delete this entry?')))return;
  logs=logs.filter(x=>String(x.id)!==b.dataset.id);
  if(String(editingId)===b.dataset.id)resetForm();
  persist();showLast();renderHistory();renderHome();
};
