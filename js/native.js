/* ───── Inside the GymPilot phone app ─────
   The app shows this same web app in a WebView. A few things go through the app instead of the
   browser: the rest-timer notification (it rings with the screen locked), the chime (it lowers
   your music), haptics, sharing files and reading the clipboard. In a normal browser NATIVE is
   false and nothing here changes how the app behaves. */
const NATIVE=!!window.ReactNativeWebView;
const nativeCalls=new Map();let nativeSeq=0;
function nativeSend(msg){if(NATIVE)window.ReactNativeWebView.postMessage(JSON.stringify(msg))}
/** ask the app for something and wait for its answer (null if it doesn't answer) */
function nativeAsk(type,data={}){
  return new Promise(res=>{
    const id=++nativeSeq;nativeCalls.set(id,res);nativeSend({type,id,...data});
    setTimeout(()=>{if(nativeCalls.delete(id))res(null)},20000);
  });
}
window.__gpNativeReply=(id,value)=>{const r=nativeCalls.get(id);if(r){nativeCalls.delete(id);r(value)}};
/** vibration: haptics in the app, navigator.vibrate on Android browsers */
function buzz(pattern){
  if(NATIVE)return nativeSend({type:'haptic',kind:Array.isArray(pattern)&&pattern.length>=3?'success':'light'});
  try{navigator.vibrate?.(pattern)}catch{}
}
if(NATIVE)document.documentElement.classList.add('native');
