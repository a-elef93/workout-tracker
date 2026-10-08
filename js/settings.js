/* ───── Tabs, settings, backup & restore, start-up ───── */
function renderStats(){renderCoach();renderRecovery();renderRings();renderConsistency();renderChart();renderSteps();renderReport();renderWrapped();renderBadges();renderYear();renderTiles();renderDonut();renderRecords()}
function switchTab(t){
  ['log','history','stats','nutrition'].forEach(v=>$('#view-'+v).hidden=v!==t);
  document.querySelectorAll('.tab').forEach(b=>{
    const on=b.dataset.tab===t;b.classList.toggle('active',on);
    on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current');
  });
  if(t==='history')renderHistory();
  if(t==='stats')renderStats();
  if(t==='log'){renderReadyHint();renderHome()}
  if(t==='nutrition')renderNutrition();
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));

/* ───── settings ───── */
const settingsDlg=$('#settingsDialog');
async function openSettings(){
  $('#goalWorkouts').value=settings.goalWorkouts;$('#goalSets').value=settings.goalSets;$('#goalSteps').value=settings.goalSteps;$('#goalWater').value=settings.goalWater;
  $('#goalWeight').value=settings.weightGoal==null?'':fmtKg(settings.weightGoal);$('#bodyweight').value=settings.bodyweight;
  $('#langSel').value=settings.lang||'auto';
  document.querySelectorAll('#themeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.theme===(settings.theme||'auto')));
  $('#restDefault').value=String(settings.restDefault);$('#restAuto').checked=!!settings.restAuto;$('#restSound').checked=!!settings.restSound;
  settingsDlg.showModal();
  const kb=Math.max(1,Math.round((['wt_logs','wt_exercises','wt_settings','wt_steps','wt_water','wt_weight','wt_plan','wt_food','wt_training'].reduce((a,k)=>a+(localStorage.getItem(k)||'').length,0))/1024));
  let persisted=false;try{persisted=await navigator.storage.persisted()}catch{}
  $('#storageInfo').innerHTML=L(
    `📦 ${logs.length} καταγραφές · ${Object.keys(steps).length} μέρες βημάτων · ${Object.keys(water).length} μέρες νερού · ${Object.keys(weights).length} ζυγίσματα · ${Object.keys(food).length} μέρες διατροφής · ~${kb} KB<br>📅 Τελευταίο backup: ${settings.lastExport?formatDate(dayKey(new Date(settings.lastExport))):'ποτέ'}<br>${persisted?'🔒 Ο browser δεν θα σβήσει αυτόματα τα δεδομένα.':'ℹ️ Στο iPhone πρόσθεσέ το στην Οθόνη Αφετηρίας για πιο σταθερή αποθήκευση και κάνε backup πού και πού.'}`,
    `📦 ${logs.length} entries · ${Object.keys(steps).length} step days · ${Object.keys(water).length} water days · ${Object.keys(weights).length} weigh-ins · ${Object.keys(food).length} food days · ~${kb} KB<br>📅 Last backup: ${settings.lastExport?formatDate(dayKey(new Date(settings.lastExport))):'never'}<br>${persisted?'🔒 The browser won’t clear your data on its own.':'ℹ️ On iPhone, add it to the Home Screen for steadier storage, and back up now and then.'}`);
}
$('#settingsBtn').onclick=openSettings;
$('#settingsClose').onclick=()=>{saveSettings();settingsDlg.close()};
function saveSettings(){
  settings.goalWorkouts=clamp(Number($('#goalWorkouts').value),1,7,4);
  settings.goalSets=clamp(Number($('#goalSets').value),5,300,60);
  settings.goalSteps=clamp(Number($('#goalSteps').value),1000,50000,8000);
  settings.goalWater=clamp(Number($('#goalWater').value),500,8000,2500);
  settings.bodyweight=clamp(parseKg($('#bodyweight').value),30,250,75);
  settings.restDefault=Number($('#restDefault').value)||90;
  settings.restAuto=$('#restAuto').checked;settings.restSound=$('#restSound').checked;
  const gw=$('#goalWeight').value.trim(),kg=parseKg(gw);
  if(gw===''){settings.weightGoal=null;settings.weightGoalSetAt=null;settings.weightGoalStart=null}
  else if(kg>=25&&kg<=350&&kg!==settings.weightGoal){settings.weightGoal=kg;settings.weightGoalSetAt=today();settings.weightGoalStart=latestWeight()?.kg??null}   // progress counts from your weight right now
  persist();
  if(!$('#view-nutrition').hidden)renderNutrition();
  if(!$('#view-stats').hidden)renderStats();
  if(!$('#view-log').hidden)renderHome();
}
settingsDlg.addEventListener('close',saveSettings);   // "Done", Esc
$('#themeSeg').onclick=e=>{
  const b=e.target.closest('[data-theme]');if(!b)return;
  settings.theme=b.dataset.theme;persist();applyTheme(settings.theme);
  document.querySelectorAll('#themeSeg button').forEach(x=>x.classList.toggle('on',x===b));
};
$('#langSel').onchange=e=>{
  settings.lang=e.target.value==='auto'?'auto':e.target.value;saveSettings();
  location.reload();   // every text is built in the chosen language, so start fresh
};
$('#restTest').onclick=()=>{unlockAudio();const s=settings.restSound;settings.restSound=true;chime();settings.restSound=s};
$('#trainingFromSettings').onclick=()=>{saveSettings();settingsDlg.close();openTraining()};

// a dot on the gear + a note in settings when a backup is due (weekly)
const BACKUP_DAYS=7;
const hasData=()=>logs.length+Object.keys(weights).length+Object.keys(water).length+Object.keys(steps).length>=3;
const backupDue=()=>hasData()&&(Date.now()-(settings.lastExport||0))/864e5>=BACKUP_DAYS;
function checkBackup(){
  const due=backupDue();
  $('#settingsBtn').classList.toggle('needsBackup',due);
  $('#backupHint').classList.toggle('due',due);
  $('#backupHint').textContent=due
    ?`⚠️ ${settings.lastExport?L('Πέρασε μια εβδομάδα από το τελευταίο backup.','It’s been a week since your last backup.'):L('Δεν έχεις κάνει ακόμα backup.','You haven’t made a backup yet.')} ${L('Τα δεδομένα μένουν μόνο σε αυτό το κινητό.','Your data lives only on this phone.')}`
    :L('Σώζει όλα σου τα δεδομένα σε ένα αρχείο. Σώσ’ το στο iCloud Drive, στον ίδιο φάκελο κάθε φορά, και το νέο αντικαθιστά το παλιό.','Saves all your data to one file. Keep it in iCloud Drive, in the same folder each time, and the new one replaces the old.');
}
async function exportData(){
  const pf=planFile&&planFile.size<=8*1024*1024?{name:planFile.name,type:planFile.type,size:planFile.size,added:planFile.added,b64:bufToB64(planFile.data)}:null;   // in memory already: no await before share
  const json=JSON.stringify({version:7,exportedAt:new Date().toISOString(),exercises,logs,steps,water,weights,plan,food,training,planFile:pf,badges,settings},null,2);
  const file=new File([json],'GymPilot-backup.json',{type:'application/json'});
  try{
    if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'GymPilot backup'});
    else{const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();URL.revokeObjectURL(a.href)}
    settings.lastExport=Date.now();persist();checkBackup();toast(L('✅ Το backup είναι έτοιμο','✅ Backup ready'));
  }catch(e){if(e.name!=='AbortError')toast(L('⚠️ Το backup απέτυχε','⚠️ Backup failed'))}
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
      date:validDay(l.date)?l.date:null,time:validTime(l.time)?l.time:undefined,group:String(l.group||''),exercise:String(l.exercise||''),
      sets:Array.isArray(l.sets)?l.sets.map(s=>({kg:Math.max(0,Number(s.kg)||0),reps:Number(s.reps)||0})).filter(s=>s.reps>0):[],
      notes:String(l.notes||''),
    }).filter(l=>l&&l.date&&l.group&&l.exercise&&l.sets.length&&!known.has(l.id));
    // days already on the phone stay as they are — they're newer
    const newSteps={};
    if(isObj(d.steps))Object.entries(d.steps).forEach(([k,v])=>{const n=Math.round(Number(v));if(validDay(k)&&!(k in steps)&&n>=0&&n<=200000)newSteps[k]=n});
    const newWater={};
    if(isObj(d.water))Object.entries(d.water).forEach(([k,v])=>{
      if(!validDay(k)||k in water||!Array.isArray(v))return;
      const list=v.map(x=>({t:Number(x?.t)||0,ml:Math.round(Number(x?.ml))})).filter(x=>x.ml>=10&&x.ml<=3000);
      if(list.length)newWater[k]=list;
    });
    const newWeights={};
    if(isObj(d.weights))Object.entries(d.weights).forEach(([k,v])=>{const kg=parseKg(v);if(validDay(k)&&!(k in weights)&&kg>=25&&kg<=350)newWeights[k]=kg});
    const newFood={},snap=x=>({id:String(x?.id||''),name:String(x?.name||''),kcal:num(x?.kcal)||0,protein:num(x?.protein)||0});
    if(isObj(d.food))Object.entries(d.food).forEach(([k,v])=>{
      if(!validDay(k)||k in food||!v)return;
      const meals=Array.isArray(v.meals)?v.meals.map(snap).filter(m=>m.id):[],extras=Array.isArray(v.extras)?v.extras.map(x=>({t:Number(x?.t)||0,label:String(x?.label||''),kcal:num(x?.kcal)||0,protein:num(x?.protein)||0})):[];
      if(meals.length||extras.length)newFood[k]={meals,extras};
    });
    const sn=Object.keys(newSteps).length,wn=Object.keys(newWater).length,kn=Object.keys(newWeights).length,fn=Object.keys(newFood).length;
    if(isObj(d.badges))Object.entries(d.badges).forEach(([k,v])=>{if(!badges[k]&&validDay(v)&&BADGES.some(b=>b.id===k))badges[k]=v});
    // plans only come in if this phone doesn't have one yet
    const takePlan=!plan.meals.length&&!plan.kcalGoal&&!plan.proteinGoal&&d.plan&&Array.isArray(d.plan.meals);
    const takeFile=!planFile&&d.planFile?.b64;
    const takeTraining=!training&&isObj(d.training)&&Array.isArray(d.training.days)&&d.training.days.length===7;
    const parts=[sn&&L(`${sn} μέρες βημάτων`,`${sn} step days`),wn&&L(`${wn} μέρες νερού`,`${wn} water days`),kn&&L(`${kn} ζυγίσματα`,`${kn} weigh-ins`),fn&&L(`${fn} μέρες διατροφής`,`${fn} food days`),(takePlan||takeFile)&&L('το πρόγραμμα διατροφής','the nutrition plan'),takeTraining&&L('το πρόγραμμα προπόνησης','the workout plan')].filter(Boolean);
    if(!confirm(L(`Βρέθηκαν ${fresh.length} νέες καταγραφές (από ${d.logs.length} στο αρχείο)${parts.length?` και ${parts.join(', ')}`:''}. Συγχώνευση με τις υπάρχουσες;`,`Found ${fresh.length} new entries (of ${d.logs.length} in the file)${parts.length?` and ${parts.join(', ')}`:''}. Merge with what you have?`)))return;
    logs.push(...fresh);Object.assign(steps,newSteps);Object.assign(water,newWater);Object.assign(weights,newWeights);Object.assign(food,newFood);
    if(takePlan)plan={meals:d.plan.meals.map(m=>({id:String(m.id||'m'+Math.random().toString(36).slice(2)),name:String(m.name||''),time:String(m.time||''),desc:String(m.desc||''),kcal:num(m.kcal)||0,protein:num(m.protein)||0})),kcalGoal:num(d.plan.kcalGoal),proteinGoal:num(d.plan.proteinGoal),since:validDay(d.plan.since)?d.plan.since:today()};
    if(takeFile)savePlanFile({name:String(d.planFile.name||'plan'),type:String(d.planFile.type||'application/pdf'),size:Number(d.planFile.size)||0,added:Number(d.planFile.added)||Date.now(),data:b64ToBuf(d.planFile.b64)}).catch(()=>{});
    if(takeTraining)training=importPlan(JSON.stringify(d.training));
    Object.entries(d.exercises||{}).forEach(([g,list])=>{if(Array.isArray(list))exercises[g]=[...new Set([...(exercises[g]||[]),...list.map(String)])]});
    fresh.forEach(l=>{const list=exercises[l.group]||(exercises[l.group]=[]);if(!list.includes(l.exercise))list.push(l.exercise)});
    persist();fillGroups(group.value);renderHistory();renderHome();checkBackup();
    toast(L(`✅ Προστέθηκαν ${fresh.length} καταγραφές`,`✅ Added ${fresh.length} entries`)+(parts.length?` · ${parts.join(' · ')}`:''));
    if(!$('#view-nutrition').hidden)renderNutrition();
  }catch{alert(L('Το αρχείο δεν φαίνεται να είναι σωστό backup.','That file doesn’t look like a GymPilot backup.'))}
};
$('#clearBtn').onclick=()=>{
  if(!confirm(L('Να διαγραφεί ΟΛΟ το ιστορικό (προπονήσεις, βήματα, νερό, ζυγίσματα και γεύματα — τα προγράμματα μένουν); Αυτό δεν αναιρείται (κάνε πρώτα backup).','Delete ALL history (workouts, steps, water, weigh-ins and meals — the plans stay)? This can’t be undone (back up first).')))return;
  logs=[];steps={};water={};weights={};food={};persist();if(!$('#view-nutrition').hidden)renderNutrition();settingsDlg.close();resetForm();renderHistory();renderHome();checkBackup();
};

/* ───── start-up ───── */
const midEntry=()=>!!editingId||[...sets.querySelectorAll('input')].some(i=>i.value)||$('#notes').value.trim()||!!document.querySelector('dialog[open]')||!!$('#weightKg').value||!!$('#waterMl').value;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return;
  swReg?.update().catch(()=>{});
  checkBackup();setTimeout(maybeAskBackup,800);setTimeout(maybeShowWrapped,1600);
  if(!$('#view-log').hidden){renderReadyHint();renderHome()}
  // back from the Shortcuts app: reading the clipboard needs a tap, so ask for one
  if(awaitingShortcut){awaitingShortcut=false;$('#stepsSyncBtn').classList.add('pulse');toast(L('Πάτα ξανά ↻ Συγχρονισμός για να περαστούν τα βήματα','Tap ↻ Sync again to bring the steps in'))}
  tickTimer();
  if(!$('#view-nutrition').hidden)renderNutrition();   // new day = empty bottle, new week = new rings
  if(!editingId&&!$('#view-log').hidden&&sets.querySelectorAll('input:not(:placeholder-shown)').length===0){
    if(date.value<today())date.value=today();
    timeIn.value=nowTime();
  }
});
try{navigator.storage?.persist?.()?.catch(()=>{})}catch{}
/* updates: check for a new version on every open; when it takes over, reload — unless you're mid-entry */
let swReg=null;
if('serviceWorker'in navigator){
  const hadController=!!navigator.serviceWorker.controller;   // first install shouldn't reload
  navigator.serviceWorker.register('./sw.js').then(r=>{swReg=r}).catch(()=>{});
  let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController||reloaded)return;
    if(midEntry())return toast(L('✨ Νέα έκδοση — θα φορτωθεί στο επόμενο άνοιγμα','✨ New version — it loads next time you open the app'));
    reloaded=true;location.reload();
  });
}
/* once a week, on the first open after 7 days: a small prompt with one button (iOS needs a tap to save to iCloud) */
const backupDlg=$('#backupDialog');
function maybeAskBackup(){
  if(!backupDue()||settings.backupAskedOn===today()||midEntry())return;
  settings.backupAskedOn=today();persist();   // "later" = ask again tomorrow
  backupDlg.showModal();
}
$('#backupNow').onclick=()=>{backupDlg.close();exportData()};
backupDlg.querySelectorAll('[data-later]').forEach(b=>b.onclick=()=>backupDlg.close());

applyStaticI18n();
if(settings.lang==null){settings.lang=lang;}   // remember the language picked on first run
date.value=today();timeIn.value=nowTime();
// today's plan picks the group to start with
const firstPlanned=(()=>{const d=planFor(today());if(!d)return null;const done=planProgress(d).done;return d.groups.find(g=>!done.includes(g)&&exercises[g])||null})();
fillGroups(firstPlanned||undefined);
if(firstPlanned){const ex=nextPlannedExercise(firstPlanned);if(ex)fillExercises(ex)}
persist();checkBackup();renderHome();
// home-screen shortcuts open a tab: ?tab=stats
const startTab=new URLSearchParams(location.search).get('tab');
if(['history','stats','nutrition'].includes(startTab))switchTab(startTab);
checkBadges(true);renderReadyHint();   // badges you already earned are filed quietly on first run
setTimeout(maybeShowWrapped,2200);
setTimeout(maybeAskBackup,1200);
