const VERSION = 'weather-pro-v11.2-browser-notifications';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-weather`;
const SHELL = ['./', './index.html', './manifest.webmanifest', './weather-icon.svg', './weather-icon-192.png', './weather-icon-512.png', './rules.txt', './push-notifications.js', './push-notifications.css'];
const WEATHER_HOSTS = new Set(['api.openweathermap.org','api.open-meteo.com','air-quality-api.open-meteo.com','archive-api.open-meteo.com','geocoding-api.open-meteo.com','api.rainviewer.com','tilecache.rainviewer.com']);
self.addEventListener('install', event => event.waitUntil((async()=>{const cache=await caches.open(SHELL_CACHE);await Promise.all(SHELL.map(async path=>{try{await cache.add(path);}catch(_){}}));await self.skipWaiting();})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('weather-pro-')&&![SHELL_CACHE,DATA_CACHE].includes(k)).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);
 if(req.mode==='navigate'){event.respondWith((async()=>{try{const r=await fetch(req);if(r.ok)(await caches.open(SHELL_CACHE)).put('./index.html',r.clone());return r;}catch(_){return(await caches.match('./index.html'))||(await caches.match('./'))||new Response('Weather Pro недоступен офлайн.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());return;}
 if(WEATHER_HOSTS.has(url.hostname)){event.respondWith((async()=>{const cache=await caches.open(DATA_CACHE);try{const r=await fetch(req);if(r.ok)cache.put(req,r.clone()).catch(()=>{});return r;}catch(_){return(await cache.match(req))||new Response(JSON.stringify({offline:true,message:'Нет соединения и сохранённого погодного ответа.'}),{status:503,headers:{'Content-Type':'application/json'}});}})());return;}
 if(url.origin===self.location.origin||['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net','unpkg.com','cdnjs.cloudflare.com'].includes(url.hostname)){event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);const cached=await cache.match(req);const net=fetch(req).then(r=>{if(r.ok||r.type==='opaque')cache.put(req,r.clone()).catch(()=>{});return r;}).catch(()=>null);return cached||await net||new Response('',{status:503});})());}
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : 'Новое уведомление Weather Pro' }; }
  const title = payload.title || 'Weather Pro';
  const options = {
    body: payload.body || 'У вас новое уведомление',
    icon: './weather-icon-192.png',
    badge: './weather-icon-192.png',
    tag: payload.tag || payload.notificationId || 'weather-pro-push',
    renotify: false,
    data: { ...(payload.data || {}), notificationId: payload.notificationId || null, url: payload.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus();
      client.postMessage({ type: 'WEATHER_PRO_NOTIFICATION_CLICK', data });
      return;
    }
    const target = new URL(data.url || './', self.registration.scope);
    if (data.chatId) target.searchParams.set('wpChat', data.chatId);
    if (data.notificationId) target.searchParams.set('wpNotification', data.notificationId);
    if (data.actionUrl) target.searchParams.set('wpAction', data.actionUrl);
    await clients.openWindow(target.href);
  })());
});
