const VERSION = 'weather-pro-v17.1.1-founder-badge-fix';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-weather`;
// Firebase Messaging is used only for background Web Push. No Storage SDK is loaded.
try {
  importScripts(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js'
  );
  firebase.initializeApp({
    apiKey: 'AIzaSyBoF8t0tokHsrBWxDC24DF2pOU7JEYRN2A',
    authDomain: 'weatherpro-ad9aa.firebaseapp.com',
    projectId: 'weatherpro-ad9aa',
    storageBucket: 'weatherpro-ad9aa.firebasestorage.app',
    messagingSenderId: '304307183563',
    appId: '1:304307183563:web:5abbbfa06e90e0219d204e',
    measurementId: 'G-4PBFCVDRPX'
  });
  const wp16Messaging = firebase.messaging();
  wp16Messaging.onBackgroundMessage(payload => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || 'Weather Pro';
    const options = {
      body: notification.body || 'У вас новое сообщение',
      icon: './weather-icon-192.png',
      badge: './weather-icon-192.png',
      tag: notification.tag || data.notificationId || 'weather-pro-fcm',
      renotify: false,
      data: { ...data, url: data.url || './' }
    };
    return self.registration.showNotification(title, options);
  });
} catch (error) {
  // The app remains usable without FCM; legacy/local Push listeners are still active.
  console.warn('[WeatherPro/V16] Firebase Messaging background setup unavailable', error);
}
const SHELL = ['./', './index.html', './3d-satellite-hybrid-map.html', './manifest.webmanifest', './weather-icon.svg', './weather-icon-192.png', './weather-icon-512.png', './rules.txt', './push-notifications.js', './push-notifications.css', './v16-config.js', './v16-core.js', './v16-enhancements.js', './v16-ui.css?v=16.2.2', './legacy-modules__01-auth-and-profile.js', './legacy-modules__02-social-and-chat.js', './legacy-modules__03-settings-and-profile-ui.js', './legacy-modules__04-weather-and-map-core.js', './legacy-modules__05-navigation-and-voice.js', './legacy-modules__06-weather-intelligence.js', './legacy-modules__07-data-and-community-engines.js', './legacy-modules__08-analytics-and-navigation.js', './legacy-modules__09-ai-and-workspaces.js', './legacy-modules__10-device-and-performance.js', './legacy-modules__11-account-runtime-fixes.js', './legacy-modules__12-device-engine-max.js', './legacy-modules__13-device-sensors-and-runtime.js', './weather-pro-v17-command-center-game.css?v=17.1.1', './weather-pro-v17-command-center-game.js?v=17.1.1', './weather-pro-v17-admin.css?v=17.1.1', './weather-pro-v17-admin.js?v=17.1.1'];
const WEATHER_HOSTS = new Set(['api.openweathermap.org','api.open-meteo.com','air-quality-api.open-meteo.com','archive-api.open-meteo.com','geocoding-api.open-meteo.com','api.rainviewer.com','tilecache.rainviewer.com','tile.openweathermap.org']);
self.addEventListener('install', event => event.waitUntil((async()=>{const cache=await caches.open(SHELL_CACHE);await Promise.all(SHELL.map(async path=>{try{await cache.add(path);}catch(error){console.warn('[WeatherPro/PWA] Не удалось предварительно закэшировать',path,error);}}));})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('weather-pro-')&&![SHELL_CACHE,DATA_CACHE].includes(k)).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);
 if(req.mode==='navigate'){event.respondWith((async()=>{try{const r=await fetch(req);if(r.ok)(await caches.open(SHELL_CACHE)).put('./index.html',r.clone());return r;}catch(_){return(await caches.match('./index.html'))||(await caches.match('./'))||new Response('Weather Pro недоступен офлайн.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());return;}
 if(WEATHER_HOSTS.has(url.hostname)&&(url.searchParams.has('_wp13_probe')||url.searchParams.has('_wp14_bench'))){event.respondWith(fetch(req));return;}
 if(WEATHER_HOSTS.has(url.hostname)){event.respondWith((async()=>{const cache=await caches.open(DATA_CACHE);try{const r=await fetch(req);if(r.ok)cache.put(req,r.clone()).catch(()=>{});return r;}catch(_){return(await cache.match(req))||new Response(JSON.stringify({offline:true,message:'Нет соединения и сохранённого погодного ответа.'}),{status:503,headers:{'Content-Type':'application/json'}});}})());return;}
 if(url.origin===self.location.origin||['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net','unpkg.com','cdnjs.cloudflare.com','basemaps.cartocdn.com','tile.openstreetmap.org'].includes(url.hostname)){event.respondWith((async()=>{const cache=await caches.open(SHELL_CACHE);const cached=await cache.match(req);const net=fetch(req).then(r=>{if(r.ok||r.type==='opaque')cache.put(req,r.clone()).catch(()=>{});return r;}).catch(()=>null);return cached||await net||new Response('',{status:503});})());}
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : 'Новое уведомление Weather Pro' }; }
  // FCM background messages are displayed by firebase.messaging().onBackgroundMessage above.
  if (payload && (payload.from || payload.messageId || payload.fcmMessageId)) return;
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
