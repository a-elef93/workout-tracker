/* ───── Language & theme — loaded in <head>, before anything renders ─────
   Greek is the source language. English comes from L(el,en) in the code and from
   data-en / data-en-html / data-en-ph / data-en-aria attributes in the HTML. */
const savedSettings=(()=>{try{return JSON.parse(localStorage.getItem('wt_settings'))||{}}catch{return{}}})();
const hadData=(()=>{try{return (JSON.parse(localStorage.getItem('wt_logs'))||[]).length>0}catch{return false}})();
// people who already use the app keep Greek; new installs follow the phone's language
const deviceLang=(navigator.languages||[navigator.language||'el']).some(l=>/^el/i.test(l))?'el':'en';
const lang=savedSettings.lang==='el'||savedSettings.lang==='en'?savedSettings.lang:hadData&&!savedSettings.lang?'el':deviceLang;
const L=(el,en)=>lang==='en'?en:el;
const LOC=lang==='en'?'en-GB':'el-GR';
document.documentElement.lang=lang;

const GROUP_NAMES={Chest:['Στήθος','Chest'],Back:['Πλάτη','Back'],Lats:['Ραχιαίοι','Lats'],Shoulders:['Ώμοι','Shoulders'],Biceps:['Δικέφαλα','Biceps'],Triceps:['Τρικέφαλα','Triceps'],Legs:['Πόδια','Legs'],Abs:['Κοιλιακοί','Abs']};
/** built-in groups are translated; your own keep the name you typed */
const gName=g=>GROUP_NAMES[g]?L(...GROUP_NAMES[g]):g;

/* theme: auto follows the phone, or forced light / dark from Settings */
const darkQuery=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(mode){
  const dark=mode==='dark'||((mode||'auto')==='auto'&&darkQuery.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.querySelector('meta[name=color-scheme]')?.setAttribute('content',dark?'dark':'light');
}
applyTheme(savedSettings.theme);
darkQuery.addEventListener?.('change',()=>applyTheme((typeof settings!=='undefined'?settings:savedSettings).theme));

/** Swap the static HTML texts to English (Greek is what's written in index.html). */
function applyStaticI18n(root=document){
  if(lang!=='en')return;
  root.querySelectorAll('[data-en]').forEach(e=>{e.textContent=e.dataset.en});
  root.querySelectorAll('[data-en-html]').forEach(e=>{e.innerHTML=e.dataset.enHtml});
  root.querySelectorAll('[data-en-ph]').forEach(e=>{e.placeholder=e.dataset.enPh});
  root.querySelectorAll('[data-en-aria]').forEach(e=>{e.setAttribute('aria-label',e.dataset.enAria)});
}
