/* Weather Pro V16 client modules. Uses the existing Firebase Auth/Firestore app; never initializes Firebase Storage. */
(function(){
  'use strict';
  const CFG=window.WP16_CONFIG||{vapidKey:''};
  const $=id=>document.getElementById(id);
  const safeText=(id,value)=>{const el=$(id);if(el)el.textContent=String(value??'');};
  const getUid=()=>{try{return typeof fbUser!=='undefined'&&fbUser?.uid?fbUser.uid:'guest';}catch(_){return 'guest';}};
  const AI_PREFIX='wp16_ai_history_';
  let aiCloudTimer=null, aiHistoryCache=[], aiSpeechRecognition=null, olderChat=[], olderChatCursor=null, olderChatBusy=false;
  let aiHistoryOwner='';
  let aiRestoreVersion=0;

  function aiKey(uid){return AI_PREFIX+String(uid||getUid());}
  function readAIHistory(uid){
    try{const rows=JSON.parse(localStorage.getItem(aiKey(uid))||'[]');return Array.isArray(rows)?rows.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-80):[];}
    catch(_){return [];}
  }
  function writeAIHistory(rows,uid){
    const clean=(rows||[]).slice(-80).map(x=>({id:String(x.id||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`),role:x.role==='user'?'user':'assistant',content:String(x.content||'').slice(0,3000),createdAt:Number(x.createdAt)||Date.now()}));
    try{localStorage.setItem(aiKey(uid),JSON.stringify(clean));aiHistoryCache=clean;return true;}
    catch(error){console.warn('[WeatherPro/V16/AI] Локальная история не сохранена:',error);return false;}
  }
  window.wp16AIGetHistory=()=>readAIHistory(aiHistoryOwner||getUid()).map(({role,content,createdAt})=>({role,content,createdAt}));
  window.wp16AIAppendMessage=(role,content)=>{
    if(!['user','assistant'].includes(role)||!String(content||'').trim())return;
    const owner=aiHistoryOwner||getUid();const rows=readAIHistory(owner);rows.push({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,role,content:String(content).slice(0,3000),createdAt:Date.now()});
    writeAIHistory(rows,owner);scheduleAICloudSync();
  };
  function scheduleAICloudSync(){
    if(aiCloudTimer)clearTimeout(aiCloudTimer);
    aiCloudTimer=setTimeout(async()=>{
      const uid=getUid();
      if(uid==='guest'||typeof fbDb==='undefined'||!fbDb)return;
      const messages=readAIHistory(uid).slice(-80);
      try{await fbDb.collection('users').doc(uid).collection('aiHistory').doc('main').set({messages,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}
      catch(error){console.warn('[WeatherPro/V16/AI] Облачная синхронизация истории недоступна:',error.code||error.message);}
    },900);
  }
  async function restoreAIHistory(user){
    const restoreVersion=++aiRestoreVersion;
    const owner=user?.uid||'guest';
    aiHistoryOwner=owner;
    let local=readAIHistory(owner);
    if(user&&typeof fbDb!=='undefined'&&fbDb){
      try{
        const snap=await fbDb.collection('users').doc(user.uid).collection('aiHistory').doc('main').get();
        if(restoreVersion!==aiRestoreVersion||user.uid!==getUid())return;
        const cloud=snap.exists&&Array.isArray(snap.data()?.messages)?snap.data().messages:[];
        // Re-read local storage after the network wait: messages may have been
        // sent while Firestore was loading. The newest local copy wins by ID.
        local=readAIHistory(owner);
        const merged=new Map();
        [...cloud,...local].forEach(item=>{if(item&&item.id&&['user','assistant'].includes(item.role)&&typeof item.content==='string')merged.set(item.id,{id:item.id,role:item.role,content:item.content.slice(0,3000),createdAt:Number(item.createdAt)||0});});
        local=[...merged.values()].sort((a,b)=>a.createdAt-b.createdAt).slice(-80);
        writeAIHistory(local,owner);
      }catch(error){console.info('[WeatherPro/V16/AI] История доступна из локального кэша:',error.code||error.message);}
    }
    if(restoreVersion!==aiRestoreVersion)return;
    // Never clear/rebuild the conversation DOM while a request is in flight.
    // Saving/loading history runs independently from the AI reply lifecycle.
    if(window.__wp13AiBusy)return;
    const box=$('aiMessages');
    if(box&&typeof window.addMsg==='function'){
      box.innerHTML='';
      if(!local.length){window.addMsg('assistant','Привет! Я Weather AI. Задайте вопрос о погоде — контекст последних сообщений будет сохраняться.');}
      else local.slice(-24).forEach(item=>window.addMsg(item.role,item.content));
      if(typeof window.scrollAIToLatest==='function')window.scrollAIToLatest('auto');
    }
  }
  window.wp16RestoreAIHistory=restoreAIHistory;

  async function requestAI({prompt,model,system}){
    const selected=String(model||'openai').toLowerCase();
    const endpoint='https://text.pollinations.ai/'+encodeURIComponent(String(prompt||'').slice(0,12000))+'?model='+encodeURIComponent(selected)+'&system='+encodeURIComponent(String(system||'').slice(0,6000));
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),35000);
    try{
      const response=await fetch(endpoint,{method:'GET',cache:'no-store',signal:controller.signal,headers:{'Accept':'text/plain'}});
      if(!response.ok)throw new Error('AI HTTP '+response.status);
      const answer=(await response.text()).trim();
      if(!answer)throw new Error('AI вернул пустой ответ');
      return answer;
    }finally{clearTimeout(timeout);}
  }
  window.wp16RequestAI=requestAI;

  function startAIVoice(){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    const button=$('wp16AiVoiceBtn'),input=$('aiInput');
    if(!Recognition||!input){window.showNotification?.('Голосовой ввод не поддерживается этим браузером',true);return;}
    if(aiSpeechRecognition){try{aiSpeechRecognition.stop();}catch(_){}aiSpeechRecognition=null;if(button)button.classList.remove('listening');return;}
    const rec=new Recognition();aiSpeechRecognition=rec;rec.lang='ru-RU';rec.interimResults=false;rec.maxAlternatives=1;
    rec.onstart=()=>button?.classList.add('listening');
    rec.onresult=event=>{const text=event.results?.[0]?.[0]?.transcript||'';input.value=(input.value?input.value+' ':'')+text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();};
    rec.onerror=event=>window.showNotification?.('Голосовой ввод: '+(event.error||'ошибка распознавания'),true);
    rec.onend=()=>{aiSpeechRecognition=null;button?.classList.remove('listening');};
    try{rec.start();}catch(error){aiSpeechRecognition=null;button?.classList.remove('listening');window.showNotification?.('Не удалось запустить микрофон',true);}
  }
  function speakLastAI(){
    if(!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance==='undefined'){window.showNotification?.('Озвучивание не поддерживается',true);return;}
    const rows=readAIHistory(aiHistoryOwner||getUid()),last=[...rows].reverse().find(x=>x.role==='assistant'&&x.content);
    const text=String(window.wp16LastAIResponse||last?.content||'').trim();
    if(!text){window.showNotification?.('Пока нечего озвучивать',true);return;}
    window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ru-RU';utterance.rate=1;utterance.pitch=.96;window.speechSynthesis.speak(utterance);
  }
  window.wp16StartAIVoice=startAIVoice;window.wp16SpeakLastAI=speakLastAI;

  function updateDataStatus(){
    let current=null,forecast=null,city='';
    try{current=typeof lastWeatherData!=='undefined'?lastWeatherData:null;forecast=typeof lastForecastData!=='undefined'?lastForecastData:null;city=typeof currentCity!=='undefined'?currentCity:'';}catch(_){}
    if(!current){safeText('wp16DataState','Нет активных данных');safeText('wp16DataMeta','Загрузите город или проверьте интернет');}
    else{
      const checks=[Number.isFinite(Number(current?.main?.temp)),Number.isFinite(Number(current?.main?.humidity)),Number.isFinite(Number(current?.coord?.lat))&&Number.isFinite(Number(current?.coord?.lon)),Array.isArray(forecast?.list)&&forecast.list.length>0];
      const fresh=(()=>{try{const ts=typeof lastFetchAt!=='undefined'?lastFetchAt[String(city||current.name).toLowerCase()]:0;return ts?Math.max(0,Math.round((Date.now()-ts)/60000)):null;}catch(_){return null;}})();
      let source='OpenWeather';try{if(window.wp15CurrentSource&&window.wp15CurrentSource!=='—')source=window.wp15CurrentSource;else if(window.wp15LastSource&&window.wp15LastSource!=='—')source=window.wp15LastSource;}catch(_){}
      safeText('wp16DataState',`${checks.filter(Boolean).length}/4 проверок`);
      const freshness=fresh===null?'время обновления неизвестно':fresh===0?'обновлено сейчас':fresh+' мин назад';
      const freshnessState=fresh!==null&&fresh>60?' · ДАННЫЕ УСТАРЕЛИ':'';
      safeText('wp16DataMeta',`${current.name||city||'Город'} · ${source} · ${freshness}${freshnessState}`);
    }
  }
  async function refreshDiagnostics(){
    const online=navigator.onLine!==false;
    safeText('wp16NetworkState',online?'Сеть доступна':'Нет соединения');
    const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    safeText('wp16NetworkMeta',connection?[`${connection.effectiveType||'тип неизвестен'}`,connection.downlink?`${connection.downlink} Мбит/с`:null,connection.rtt?`${connection.rtt} мс RTT`:null].filter(Boolean).join(' · '):'Детали сети скрыты браузером');
    const cores=Number(navigator.hardwareConcurrency)||null,memory=Number(navigator.deviceMemory)||null;
    safeText('wp16DeviceState',[cores?`${cores} потоков`:null,memory?`RAM ≈ ${memory} ГБ`:null].filter(Boolean).join(' · ')||'Данные ограничены');
    safeText('wp16DeviceMeta',`Экран ${screen.width}×${screen.height} · DPR ${window.devicePixelRatio||1} · ${'ontouchstart'in window?'сенсорный ввод':'указатель'}`);
    let installed=false;try{installed=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}catch(_){}
    safeText('wp16PwaState',installed?'Установлено':'Браузер');
    safeText('wp16PwaMeta',`Service Worker: ${('serviceWorker'in navigator)?'поддерживается':'недоступен'} · Cache API: ${('caches'in window)?'доступен':'недоступен'}`);
    updateDataStatus();
    if(navigator.getBattery){try{const battery=await navigator.getBattery();if(battery){const pct=Math.round(battery.level*100);const parts=[cores?`${cores} потоков`:null,memory?`RAM ≈ ${memory} ГБ`:null,`${pct}% батареи${battery.charging?' · зарядка':''}`].filter(Boolean);safeText('wp16DeviceState',parts.join(' · ')||'Данные ограничены');safeText('wp16DeviceMeta',`Экран ${screen.width}×${screen.height} · DPR ${window.devicePixelRatio||1} · Battery API доступен`);}}catch(_){}}
    const engine=$('engine-page');
    if(engine&&!$('wp16DevicePanel')){
      const panel=document.createElement('section');panel.id='wp16DevicePanel';panel.className='wp16-device-panel';panel.innerHTML='<h2>Device Engine 5.0 · доступные показатели</h2><p>Показываются только сведения, которые реально предоставляет браузер. Аппаратные температуры, точная загрузка CPU и полная RAM могут быть недоступны.</p><div class="wp16-device-grid"><div class="wp16-device-metric"><small>Процессорные потоки</small><strong id="wp16CpuValue">—</strong></div><div class="wp16-device-metric"><small>Оценка памяти браузера</small><strong id="wp16MemoryValue">—</strong></div><div class="wp16-device-metric"><small>Соединение</small><strong id="wp16ConnectionValue">—</strong></div><div class="wp16-device-metric"><small>Сохранённый кэш</small><strong id="wp16StorageValue">—</strong></div></div><div class="wp16-device-actions"><button type="button" id="wp16RunDeviceCheck">Проверить устройство</button><button type="button" id="wp16ExportDeviceReport">Экспорт отчёта</button></div><div class="wp16-inline-status" id="wp16DeviceReportStatus">Проверка не запускалась.</div>';
      const hero=engine.querySelector('.wp6-hero');if(hero)hero.insertAdjacentElement('afterend',panel);else engine.prepend(panel);
      $('wp16RunDeviceCheck')?.addEventListener('click',runDeviceAudit);$('wp16ExportDeviceReport')?.addEventListener('click',exportDeviceReport);
    }
    const storage=await storageEstimate();
    safeText('wp16CpuValue',cores?String(cores):'Не раскрывается');safeText('wp16MemoryValue',memory?`≈ ${memory} ГБ`:'Не раскрывается');safeText('wp16ConnectionValue',connection?.effectiveType|| (online?'Онлайн':'Офлайн'));safeText('wp16StorageValue',storage);
    try{if(navigator.getBattery){const battery=await navigator.getBattery();safeText('wp16BatteryValue',`${Math.round(battery.level*100)}%${battery.charging?' · зарядка':''}`);}}catch(_){safeText('wp16BatteryValue','API недоступен');}
    const low=(()=>{try{return settings?.optimizationEnabled!==false&&!!(settings?.batterySaver||settings?.lightEffects);}catch(_){return false;}})();
    document.documentElement.classList.toggle('wp16-low-effects',low);
  }
  async function storageEstimate(){
    try{if(navigator.storage?.estimate){const e=await navigator.storage.estimate();const used=e.usage||0,quota=e.quota||0;return `${(used/1048576).toFixed(1)} / ${(quota/1048576).toFixed(0)} МБ`;}}catch(_){}
    return 'API недоступен';
  }
  async function measureFps(){
    if(document.hidden||typeof requestAnimationFrame!=='function')return null;
    return await new Promise(resolve=>{let frames=0,start=0,done=false;const finish=value=>{if(done)return;done=true;resolve(value);};const tick=now=>{if(!start)start=now;frames++;if(now-start>=700)finish(Math.max(1,Math.round((frames-1)*1000/(now-start))));else requestAnimationFrame(tick);};requestAnimationFrame(tick);setTimeout(()=>finish(null),1400);});
  }
  async function runDeviceAudit(){
    const rows=[];const add=(name,value,note='')=>rows.push({name,value,note});
    add('Онлайн',navigator.onLine?'Да':'Нет');add('Потоки CPU',navigator.hardwareConcurrency||'Не раскрываются');add('RAM estimate',navigator.deviceMemory?`${navigator.deviceMemory} ГБ`:'Не раскрывается');add('WebGL',(()=>{try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));}catch(_){return false;}})()?'Доступен':'Недоступен');add('Service Worker','serviceWorker'in navigator?'Поддерживается':'Нет');add('Микрофон API',!!(window.SpeechRecognition||window.webkitSpeechRecognition)?'Поддерживается':'Нет');add('Speech Synthesis','speechSynthesis'in window?'Поддерживается':'Нет');add('Датчики',('DeviceMotionEvent'in window||'DeviceOrientationEvent'in window)?'API доступен':'Не раскрываются браузером');add('Storage estimate',await storageEstimate());
    const fps=await measureFps();add('FPS приблизительно',fps===null?'Не измерено':`${fps} кадр/с`,'Краткий тест requestAnimationFrame, не аппаратный тест GPU');safeText('wp16FpsValue',fps===null?'—':`${fps} FPS`);
    let battery='API недоступен';try{if(navigator.getBattery){const b=await navigator.getBattery();battery=`${Math.round(b.level*100)}%${b.charging?' · зарядка':''}`;}}catch(_){}add('Батарея',battery);safeText('wp16BatteryValue',battery);
    const permissionResults=[];try{if(navigator.permissions?.query){for(const name of ['geolocation','notifications','microphone']){try{const item=await navigator.permissions.query({name});permissionResults.push(`${name}: ${item.state}`);}catch(_){permissionResults.push(`${name}: не поддерживается`);}}}}catch(_){}if(permissionResults.length)add('Разрешения',permissionResults.join(', '));
    safeText('wp16DeviceReportStatus',rows.map(x=>`${x.name}: ${x.value}`).join(' · '));window.wp16DeviceReport=rows;return rows;
  }
  function exportDeviceReport(){
    runDeviceAudit().then(rows=>{const blob=new Blob([JSON.stringify({application:'Weather Pro V16',createdAt:new Date().toISOString(),device:rows,runtimeErrorCount:window.wp16RuntimeErrorCount||0,limitations:'Browser-exposed metrics only. FPS is a short requestAnimationFrame estimate; no raw sensors, auth tokens or account data.'},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='weather-pro-v16-device-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  }
  window.wp16RunDeviceAudit=runDeviceAudit;
  window.wp16ExportDeviceReport=exportDeviceReport;
  window.wp16RefreshDiagnostics=refreshDiagnostics;
  window.wp16UpdateDataStatus=updateDataStatus;
  // Keep the home status card synchronized after either primary or fallback weather updates.
  const originalRenderCurrent=window.renderCurrent;
  if(typeof originalRenderCurrent==='function'&&!originalRenderCurrent.__wp16Wrapped){
    const wrappedRenderCurrent=function(){
      const result=originalRenderCurrent.apply(this,arguments);
      Promise.resolve().then(updateDataStatus);
      return result;
    };
    wrappedRenderCurrent.__wp16Wrapped=true;
    window.renderCurrent=wrappedRenderCurrent;
  }

  async function enablePush(){
    const status=$('wp16PushStatus');const report=msg=>{if(status)status.textContent=msg;};
    if(getUid()==='guest'||typeof fbDb==='undefined'||!fbDb){report('Войдите в аккаунт Weather Pro для регистрации устройства.');window.showNotification?.('Сначала войдите в аккаунт',true);return;}
    if(!CFG.vapidKey){report('Не задан VAPID public key. Добавьте его в v16/v16-config.js из Firebase Console → Project settings → Cloud Messaging.');window.showNotification?.('Для Push нужен VAPID key Firebase',true);return;}
    if(!('Notification'in window)||!('serviceWorker'in navigator)||typeof firebase==='undefined'||!firebase.messaging){report('Этот браузер не поддерживает Firebase Web Push.');return;}
    if(!isSecureContext){report('Push работает только на HTTPS (или localhost).');return;}
    try{
      const permission=await Notification.requestPermission();if(permission!=='granted'){report('Разрешение на уведомления не выдано.');return;}
      const supported=await firebase.messaging.isSupported().catch(()=>true);if(!supported)throw new Error('Firebase Messaging не поддерживается этим браузером');
      const registration=await navigator.serviceWorker.ready;const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:CFG.vapidKey,serviceWorkerRegistration:registration});if(!token)throw new Error('Firebase не выдал FCM token');
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const docId=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
      await fbDb.collection('users').doc(getUid()).collection('devices').doc(docId).set({token,platform:'web',userAgent:String(navigator.userAgent||'').slice(0,240),updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      messaging.onMessage(payload=>{const title=payload.notification?.title||'Weather Pro';const body=payload.notification?.body||'Новое уведомление';if(window.wpPushShowBrowserNotification)window.wpPushShowBrowserNotification(title,body,payload.data||{});else window.showNotification?.(`${title}: ${body}`);});
      report('Push включён для этого браузера. Сервер отправит уведомление при новом сообщении.');window.showNotification?.('Push-устройство зарегистрировано');
    }catch(error){console.warn('[WeatherPro/V16/Push]',error);report('Не удалось включить Push: '+(error.code||error.message));window.showNotification?.('Ошибка Push: '+(error.code||error.message),true);}
  }
  window.wp16EnablePushNotifications=enablePush;

  // Paginated chat history: the live listener continues to track the newest 200 messages.
  const originalRender=window.renderChatMessages;
  if(typeof originalRender==='function'){
    window.renderChatMessages=function(){
      const live=activeChatMessagesCache||[];const merged=[...olderChat,...live];const previous=activeChatMessagesCache;
      activeChatMessagesCache=merged;
      try{return originalRender.apply(this,arguments);}finally{activeChatMessagesCache=previous;}
    };
  }
  const originalOpen=window.openChat;
  if(typeof originalOpen==='function'){
    window.openChat=function(){olderChat=[];olderChatCursor=null;olderChatBusy=false;const button=$('wp16LoadOlderChat');if(button)button.hidden=true;return originalOpen.apply(this,arguments);};
  }
  window.wp16LoadOlderChatMessages=async function(){
    if(olderChatBusy||typeof fbDb==='undefined'||!fbDb||!activeChatId||!activeChatMessagesCache?.length)return;
    const button=$('wp16LoadOlderChat');olderChatBusy=true;if(button){button.disabled=true;button.textContent='Загружаем…';}
    const live=activeChatMessagesCache,first=live[0];
    try{
      const ref=fbDb.collection('chats').doc(activeChatId).collection('messages');
      const firstSnap=await ref.doc(first.id).get();
      if(!firstSnap.exists){if(button)button.hidden=true;return;}
      const snap=await ref.orderBy('createdAt','asc').endBefore(olderChatCursor||firstSnap).limitToLast(100).get();
      if(snap.empty){if(button)button.hidden=true;return;}
      olderChat=[...snap.docs.map(d=>({id:d.id,...d.data()})),...olderChat];
      olderChatCursor=snap.docs[0];
      const box=$('chatMessages'),oldHeight=box?.scrollHeight||0,oldTop=box?.scrollTop||0;
      window.renderChatMessages?.();
      if(box)box.scrollTop=oldTop+(box.scrollHeight-oldHeight);
      if(button){button.hidden=snap.size<100;button.disabled=false;button.innerHTML='<i class="fa-solid fa-clock-rotate-left"></i> Загрузить более старые сообщения';}
    }catch(error){console.warn('[WeatherPro/V16/Chat] Pagination:',error);window.showNotification?.('Не удалось загрузить старые сообщения: '+(error.code||error.message),true);}
    finally{olderChatBusy=false;if(button){button.disabled=false;if(!button.hidden)button.innerHTML='<i class="fa-solid fa-clock-rotate-left"></i> Загрузить более старые сообщения';}}
  };
  // Track the first live document so pagination can use a stable Firestore snapshot cursor.
  const chatBox=$('chatMessages');
  if(chatBox){const observer=new MutationObserver(()=>{if(activeChatMessagesCache?.length){const button=$('wp16LoadOlderChat');if(button&&olderChat.length===0)button.hidden=activeChatMessagesCache.length<200;}});observer.observe(chatBox,{childList:true});}

  window.addEventListener('online',refreshDiagnostics);window.addEventListener('offline',refreshDiagnostics);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDiagnostics();});
  if(typeof fbAuth!=='undefined'&&fbAuth?.onAuthStateChanged){fbAuth.onAuthStateChanged(user=>{restoreAIHistory(user||null).catch(()=>{});});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refreshDiagnostics();restoreAIHistory(typeof fbUser!=='undefined'?fbUser:null);},{once:true});
  else{refreshDiagnostics();restoreAIHistory(typeof fbUser!=='undefined'?fbUser:null);}
  window.wp16RuntimeErrorCount=0;
  const countRuntimeError=()=>{window.wp16RuntimeErrorCount=Math.min(9999,(window.wp16RuntimeErrorCount||0)+1);};
  window.addEventListener('error',event=>{countRuntimeError();console.error('[WeatherPro/V16/Runtime]',event.message);});
  window.addEventListener('unhandledrejection',event=>{countRuntimeError();console.error('[WeatherPro/V16/Runtime] Promise rejection',event.reason);});
})();
