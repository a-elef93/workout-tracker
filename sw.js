const CACHE='gympilot-v23';
const ASSETS=['./','./index.html','./style.css','./js/i18n.js','./js/core.js','./js/plan.js','./js/log.js','./js/history.js','./js/stats.js','./js/reports.js','./js/nutrition.js','./js/settings.js','./manifest.json','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(ASSETS.map(a=>fetch(a,{cache:'no-cache'}).then(r=>cache.put(a,r))))))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
// Network first, but always revalidate our own files with the server: GitHub Pages lets browsers
// keep them for 10 minutes, which made a fresh deploy look like nothing changed.
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const own=new URL(req.url).origin===self.location.origin;
  const net=own
    ?fetch(req.url,{cache:'no-cache',credentials:'same-origin'}).then(r=>r.redirected?new Response(r.body,{status:r.status,statusText:r.statusText,headers:r.headers}):r)
    :fetch(req);
  event.respondWith(net.then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}
    return response;
  }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
});
