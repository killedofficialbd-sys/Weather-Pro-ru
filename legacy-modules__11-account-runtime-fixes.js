/* Weather Pro V16 module: 11-account-runtime-fixes.js — extracted from the existing app script. */
/* ============================================================
   WEATHER PRO 10.0 — DEVICE TELEMETRY (LOCAL / PRIVACY-FIRST)
   Only browser-exposed values are read. No telemetry is uploaded.
   ============================================================ */
let wp10BatteryRef=null,wp10BatteryEventsBound=false,wp10DeviceSnapshotCache=null,wp10DeviceRefreshBusy=false;
function wp10SafeText(value,fallback='Недоступно'){
  if(value===undefined||value===null||value===''||value==='unknown')return fallback;
  return String(value);
}
function wp10FormatDuration(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds===Infinity)return '—';
  const minutes=Math.round(seconds/60);if(minutes>100000)return '—';
  const h=Math.floor(minutes/60),m=minutes%60;return h?`${h} ч ${m} мин`:`${m} мин`;
}
function wp10DetectBrowser(ua,brands){
  if(Array.isArray(brands)&&brands.length){const preferred=brands.find(x=>!/not.?a.?brand/i.test(x.brand||''))||brands[0];return `${preferred.brand} ${preferred.version||''}`.trim();}
  if(/Edg\//.test(ua))return 'Microsoft Edge';if(/OPR\//.test(ua))return 'Opera';if(/SamsungBrowser\//.test(ua))return 'Samsung Internet';if(/Firefox\//.test(ua))return 'Firefox';if(/Chrome\//.test(ua))return 'Chrome';if(/Safari\//.test(ua))return 'Safari';return 'Браузер не определён';
}
function wp10DetectOS(ua,platform){
  if(/Android/i.test(ua)||/Android/i.test(platform))return 'Android';
  if(/iPhone|iPad|iPod/i.test(ua)||/iPhone|iPad|iPod/i.test(platform))return 'iOS / iPadOS';
  if(/Windows/i.test(ua)||/Win/i.test(platform))return 'Windows';
  if(/Mac OS X|Macintosh/i.test(ua)||/Mac/i.test(platform))return 'macOS';
  if(/Linux/i.test(ua)||/Linux/i.test(platform))return 'Linux';
  return wp10SafeText(platform,'ОС скрыта браузером');
}
function wp10ReadGPU(){
  let canvas,gl;try{
    canvas=document.createElement('canvas');gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    if(!gl)return {renderer:null,vendor:null,maxTexture:null};
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    const vendor=ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR);
    const maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    try{gl.getExtension('WEBGL_lose_context')?.loseContext();}catch(e){}
    return {renderer:renderer||null,vendor:vendor||null,maxTexture:maxTexture||null};
  }catch(e){return {renderer:null,vendor:null,maxTexture:null};}
}
async function wp10GetDeviceData(){
  const nav=navigator,ua=nav.userAgent||'',uaData=nav.userAgentData||null;
  let high={};if(uaData?.getHighEntropyValues){try{high=await uaData.getHighEntropyValues(['architecture','bitness','model','platformVersion','fullVersionList','wow64']);}catch(e){}}
  let battery=null;
  if(typeof nav.getBattery==='function'){
    try{battery=await nav.getBattery();wp10BatteryRef=battery;if(!wp10BatteryEventsBound){['chargingchange','levelchange','chargingtimechange','dischargingtimechange'].forEach(evt=>battery.addEventListener(evt,()=>{if(document.getElementById('engine-page')?.classList.contains('active'))wp10RefreshDeviceInfo();}));wp10BatteryEventsBound=true;}}catch(e){battery=null;}
  }
  let storage=null;try{storage=await nav.storage?.estimate?.()||null;}catch(e){}
  const conn=nav.connection||nav.mozConnection||nav.webkitConnection||null;
  const scr=window.screen||{};const dpr=window.devicePixelRatio||1;
  const uaPlatform=high.platform||uaData?.platform||nav.platform||'';
  const model=wp10SafeText(high.model,'');
  const os=wp10DetectOS(ua,uaPlatform);
  const brands=high.fullVersionList||uaData?.brands||null;
  const gpu=wp10ReadGPU();
  const memory=Number(nav.deviceMemory)||null;
  const threads=Number(nav.hardwareConcurrency)||null;
  const heap=performance?.memory||null;
  const features={
    'WebGL':!!(window.WebGLRenderingContext),
    'WebGL 2':!!(window.WebGL2RenderingContext),
    'WebGPU':!!nav.gpu,
    'Service Worker':'serviceWorker'in nav,
    'Геолокация':!!nav.geolocation,
    'Камера и микрофон API':!!nav.mediaDevices?.getUserMedia,
    'Bluetooth API':!!nav.bluetooth,
    'USB API':!!nav.usb,
    'NFC API':!!nav.nfc,
    'Датчик движения API':('DeviceMotionEvent'in window),
    'Уведомления':('Notification'in window),
    'Clipboard API':!!nav.clipboard,
    'Touch':Number(nav.maxTouchPoints||0)>0
  };
  const batteryInfo=battery?{supported:true,level:Math.round(battery.level*100),charging:!!battery.charging,chargingTime:battery.chargingTime,dischargingTime:battery.dischargingTime}:{supported:false};
  return {
    capturedAt:new Date().toISOString(),online:!!nav.onLine,os,osVersion:high.platformVersion||null,deviceModel:model||null,browser:wp10DetectBrowser(ua,brands),browserPlatform:uaPlatform||null,
    architecture:high.architecture||null,bitness:high.bitness||null,logicalCpuThreads:threads,deviceMemoryGB:memory,
    battery:batteryInfo,network:conn?{type:conn.type||null,effectiveType:conn.effectiveType||null,downlinkMbps:Number.isFinite(conn.downlink)?conn.downlink:null,rttMs:Number.isFinite(conn.rtt)?conn.rtt:null,saveData:!!conn.saveData}:null,
    display:{screenWidth:scr.width||null,screenHeight:scr.height||null,availableWidth:scr.availWidth||null,availableHeight:scr.availHeight||null,viewportWidth:document.documentElement.clientWidth||window.innerWidth,viewportHeight:document.documentElement.clientHeight||window.innerHeight,pixelRatio:dpr,colorDepth:scr.colorDepth||null,orientation:scr.orientation?.type||((window.innerWidth>window.innerHeight)?'landscape':'portrait'),touchPoints:Number(nav.maxTouchPoints||0)},
    storage:storage?{usageBytes:storage.usage??null,quotaBytes:storage.quota??null}:null,
    jsHeap:heap?{usedBytes:heap.usedJSHeapSize??null,totalBytes:heap.totalJSHeapSize??null,limitBytes:heap.jsHeapSizeLimit??null}:null,
    gpu,features,
    browserInfo:{language:nav.language||null,languages:Array.isArray(nav.languages)?nav.languages:[],cookieEnabled:!!nav.cookieEnabled,pdfViewerEnabled:nav.pdfViewerEnabled??null,hardwareConcurrency:threads},
    userAgent:ua
  };
}
function wp10DeviceCard(icon,title,value,desc,extra=''){
  return `<article class="wp10-device-card"><div class="wp10-device-card-head"><i class="fa-solid ${icon}" aria-hidden="true"></i>${esc(title)}</div><div class="wp10-device-value">${esc(wp10SafeText(value))}</div><div class="wp10-device-desc">${esc(desc||'')}</div>${extra}</article>`;
}
function wp10FormatBytes(bytes){if(!Number.isFinite(bytes)||bytes<0)return '—';const units=['Б','КБ','МБ','ГБ'];let n=bytes,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toFixed(i===0?0:1)} ${units[i]}`;}
function wp10RenderDeviceData(d){
  if(!d)return;
  const main=$('wp10DeviceGrid'),extra=$('wp10DeviceExtraGrid');if(!main||!extra)return;
  const b=d.battery||{},batteryValue=b.supported?`${b.level}%`:'API недоступен';
  let batteryDesc=b.supported?(b.charging?`Заряжается${Number.isFinite(b.chargingTime)?` · до полного заряда ${wp10FormatDuration(b.chargingTime)}`:''}`:`Не заряжается${Number.isFinite(b.dischargingTime)?` · осталось примерно ${wp10FormatDuration(b.dischargingTime)}`:''}`):'Этот браузер не предоставляет Battery Status API';
  const batteryMeter=b.supported?`<div class="wp10-device-meter"><span style="width:${Math.max(0,Math.min(100,b.level))}%;background:${b.level<=20?'linear-gradient(90deg,#ef4444,#f59e0b)':undefined}"></span></div><div class="wp10-device-meta"><span>${b.charging?'Подключено питание':'Работа от батареи'}</span><span>${b.level}%</span></div>`:'';
  const net=d.network?`${d.network.effectiveType||d.network.type||'Подключено'}`:(d.online?'Online':'Offline');
  const netDesc=d.network?[d.network.downlinkMbps!==null?`${d.network.downlinkMbps} Мбит/с (оценка)`:'скорость скрыта',d.network.rttMs!==null?`RTT ${d.network.rttMs} мс`:'задержка скрыта',d.network.saveData?'экономия трафика включена':'экономия трафика выключена'].join(' · '):'Подробности сети не поддерживаются; статус online/offline доступен';
  const memory=d.deviceMemoryGB?`≈ ${d.deviceMemoryGB} ГБ`:'Не раскрывается';
  const cpu=d.logicalCpuThreads?`${d.logicalCpuThreads} потоков`:'Не раскрывается';
  const model=d.deviceModel?`${d.deviceModel}`:`${d.os}${d.osVersion?' '+d.osVersion:''}`;
  const display=`${d.display.screenWidth||'—'} × ${d.display.screenHeight||'—'} px`;
  const storage=d.storage?`${wp10FormatBytes(d.storage.usageBytes)} / ${wp10FormatBytes(d.storage.quotaBytes)}`:'API недоступен';
  const gpu=d.gpu.renderer||'Информация скрыта';
  const heap=d.jsHeap?.usedBytes!=null?wp10FormatBytes(d.jsHeap.usedBytes):'Не поддерживается';
  main.innerHTML=
    wp10DeviceCard('fa-mobile-screen-button','Устройство и ОС',model,`Платформа: ${d.browserPlatform||d.os} · модель может быть скрыта браузером`)+
    wp10DeviceCard('fa-battery-three-quarters','Батарея',batteryValue,batteryDesc,batteryMeter)+
    wp10DeviceCard('fa-microchip','CPU / процессор',cpu,`Логические потоки браузера. Модель, частота и текущая загрузка не раскрываются.`)+
    wp10DeviceCard('fa-memory','Память RAM',memory,d.deviceMemoryGB?'Округлённая оценка браузера, не точное измерение физической RAM.':'Device Memory API недоступен или скрыт.')+
    wp10DeviceCard('fa-wifi','Сеть',net,netDesc)+
    wp10DeviceCard('fa-display','Экран',display,`${d.display.orientation} · DPR ${d.display.pixelRatio} · глубина цвета ${d.display.colorDepth||'—'} бит`)+
    wp10DeviceCard('fa-globe','Браузер',d.browser,`Язык: ${d.browserInfo.language||'—'} · cookies ${d.browserInfo.cookieEnabled?'включены':'отключены'}`)+
    wp10DeviceCard('fa-hard-drive','Браузерное хранилище',storage,'Использование квоты браузера, не свободное место всего телефона.')+
    wp10DeviceCard('fa-chart-simple','Память вкладки',heap,d.jsHeap?'Память JavaScript-процесса, не общая RAM устройства.':'Метрика JS heap недоступна в этом браузере.');
  const gpuDesc=[d.gpu.vendor?`Производитель: ${d.gpu.vendor}`:'Производитель скрыт',d.gpu.maxTexture?`Макс. текстура: ${d.gpu.maxTexture}px`:''].filter(Boolean).join(' · ');
  const featureList=Object.entries(d.features).map(([name,ok])=>`<span class="wp10-device-pill"><i class="fa-solid ${ok?'fa-check':'fa-minus'}" aria-hidden="true"></i>${esc(name)}: ${ok?'есть':'нет'}</span>`).join(' ');
  extra.innerHTML=
    wp10DeviceCard('fa-gamepad','Графика / GPU',gpu,gpuDesc||'WebGL renderer; браузер может маскировать модель видеоускорителя.')+
    wp10DeviceCard('fa-mobile-screen','Сенсорный ввод',`${d.display.touchPoints} точек касания`,`Ориентация экрана: ${d.display.orientation} · viewport ${d.display.viewportWidth} × ${d.display.viewportHeight}px`)+
    wp10DeviceCard('fa-code','Архитектура',d.architecture?`${d.architecture}${d.bitness?' · '+d.bitness+' bit':''}`:'Скрыта','Данные User-Agent Client Hints, если браузер их предоставляет.')+
    `<article class="wp10-device-card"><div class="wp10-device-card-head"><i class="fa-solid fa-plug-circle-check" aria-hidden="true"></i>Поддержка API и датчиков</div><div class="wp10-device-desc">Отображается только наличие API, а не разрешение на доступ или факт использования.</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">${featureList}</div></article>`;
  const up=$('wp10DeviceUpdated');if(up)up.textContent=`Обновлено: ${new Date(d.capturedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}${d.online?' · интернет доступен':' · офлайн'}`;
}
async function wp10RefreshDeviceInfo(){
  if(wp10DeviceRefreshBusy)return;wp10DeviceRefreshBusy=true;
  const status=$('wp10DeviceUpdated');if(status)status.textContent='Обновляем телеметрию устройства…';
  try{const d=await wp10GetDeviceData();wp10DeviceSnapshotCache=d;wp10RenderDeviceData(d);if(typeof wp104RenderDeviceSummary==='function')wp104RenderDeviceSummary(d);}
  catch(e){console.warn('[WeatherPro/DeviceEngine]',e);if(status)status.textContent='Не удалось прочитать часть характеристик. Попробуйте обновить.';}
  finally{wp10DeviceRefreshBusy=false;}
}
function wp10ExportDeviceInfo(){
  if(!wp10DeviceSnapshotCache){showNotification('Сначала обновите характеристики устройства');wp10RefreshDeviceInfo();return;}
  const report={application:'Weather Pro 10.0',reportType:'local-device-capabilities',privacy:'Generated locally after an explicit user action. No identifiers or location are intentionally collected.',...wp10DeviceSnapshotCache};
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='weather-pro-device-report.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotification('Локальный отчёт устройства создан');
}
function wp10InitDeviceEngine(){
  wp10RefreshDeviceInfo();
  if(!window.wp10DeviceEventsBound){
    window.wp10DeviceEventsBound=true;
    window.addEventListener('online',wp10RefreshDeviceInfo);window.addEventListener('offline',wp10RefreshDeviceInfo);
    // Do not rebuild the entire device-card grids on every viewport resize.
    // Android browser chrome can resize the visible viewport while the user scrolls.
    // A full innerHTML render at that moment can make the page jump under the finger.
    const refreshAfterRotation=()=>{if(document.getElementById('engine-page')?.classList.contains('active'))setTimeout(()=>wp10RefreshDeviceInfo(),180);};
    if(screen.orientation?.addEventListener)screen.orientation.addEventListener('change',refreshAfterRotation);
    else window.addEventListener('orientationchange',refreshAfterRotation,{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.getElementById('engine-page')?.classList.contains('active'))wp10RefreshDeviceInfo();});
    const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;conn?.addEventListener?.('change',wp10RefreshDeviceInfo);
  }
}
window.wp10RefreshDeviceInfo=wp10RefreshDeviceInfo;window.wp10ExportDeviceInfo=wp10ExportDeviceInfo;

/* Device Monitor 3.0 — opt-in live sampling, 24h local history and health center. */
const WP10_MONITOR_MAX=48,WP10_HISTORY_KEY='weatherProDeviceHistoryV3',WP10_HISTORY_MAX=1440;
let wp10MonitorTimer=null,wp10MonitorHistory=[],wp10DailyHistory=[],wp10LastHistoryWrite=0;
try{const saved=JSON.parse(localStorage.getItem(WP10_HISTORY_KEY)||'[]');if(Array.isArray(saved))wp10DailyHistory=saved.filter(v=>v&&Number.isFinite(v.at)&&Date.now()-v.at<=86400000).slice(-WP10_HISTORY_MAX);}catch(e){wp10DailyHistory=[];}
function wp10PersistDailyHistory(){try{localStorage.setItem(WP10_HISTORY_KEY,JSON.stringify(wp10DailyHistory));}catch(e){wp10DailyHistory=wp10DailyHistory.slice(-480);try{localStorage.setItem(WP10_HISTORY_KEY,JSON.stringify(wp10DailyHistory));}catch(_){}}}
function wp10MonitorRead(){const b=wp10DeviceSnapshotCache?.battery||{},heap=performance.memory||null,conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;return {at:Date.now(),battery:b.supported&&Number.isFinite(b.level)?Math.round(b.level):null,charging:b.supported?!!b.charging:null,heap:heap&&heap.jsHeapSizeLimit?Math.round(heap.usedJSHeapSize/heap.jsHeapSizeLimit*100):null,network:navigator.onLine?(conn?.effectiveType||'Online'):'Offline'};}
function wp10DrawSeries(canvasId,history,height,maxPoints){const c=$(canvasId);if(!c)return;const w=Math.max(280,c.clientWidth||600),h=height,dpr=Math.min(2,window.devicePixelRatio||1);c.width=w*dpr;c.height=h*dpr;const x=c.getContext('2d');if(!x)return;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);const pad={l:30,r:10,t:12,b:25},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;x.strokeStyle='rgba(148,163,184,.18)';x.lineWidth=1;x.fillStyle=getComputedStyle(document.body).getPropertyValue('--text-secondary')||'#94a3b8';x.font='10px sans-serif';for(let i=0;i<=4;i++){let y=pad.t+ch*i/4;x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.fillText(String(100-i*25),3,y+3);}const rows=history.slice(-maxPoints);[['battery','#34d399'],['heap','#60a5fa']].forEach(([key,color])=>{x.strokeStyle=color;x.lineWidth=2;x.beginPath();let started=false;rows.forEach((v,i)=>{const n=v[key];if(!Number.isFinite(n)){started=false;return;}const px=pad.l+(rows.length<=1?0:i/Math.max(1,rows.length-1))*cw,py=pad.t+ch*(1-Math.max(0,Math.min(100,n))/100);if(!started){x.moveTo(px,py);started=true;}else x.lineTo(px,py);});x.stroke();});x.fillStyle='#34d399';x.fillText('Батарея %',pad.l,h-5);x.fillStyle='#60a5fa';x.fillText('Память вкладки %',pad.l+82,h-5);}
function wp10MonitorDraw(){wp10DrawSeries('wp10MonitorChart',wp10MonitorHistory,190,WP10_MONITOR_MAX);}
function wp10HistoryRender(){const now=Date.now();wp10DailyHistory=wp10DailyHistory.filter(v=>now-v.at<=86400000).slice(-WP10_HISTORY_MAX);const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};set('wp10HistoryCount',String(wp10DailyHistory.length));const latest=wp10DailyHistory.at(-1),heap=wp10DailyHistory.filter(v=>Number.isFinite(v.heap));set('wp10HistoryBattery',latest&&Number.isFinite(latest.battery)?latest.battery+'%':'Недоступно');set('wp10HistoryHeap',heap.length?Math.round(heap.reduce((a,v)=>a+v.heap,0)/heap.length)+'%':'Недоступно');set('wp10HistoryStatus',latest?`Локально сохранено · обновлено ${new Date(latest.at).toLocaleString('ru-RU')}`:'История появится после включения мониторинга.');wp10DrawSeries('wp10HistoryChart',wp10DailyHistory,150,WP10_HISTORY_MAX);}
async function wp10MonitorSample(){if(document.hidden||!$('engine-page')?.classList.contains('active'))return;if(!wp10DeviceSnapshotCache)try{wp10DeviceSnapshotCache=await wp10GetDeviceData();}catch(e){}const d=wp10MonitorRead();wp10MonitorHistory.push(d);if(wp10MonitorHistory.length>WP10_MONITOR_MAX)wp10MonitorHistory.shift();if(!wp10LastHistoryWrite||d.at-wp10LastHistoryWrite>=60000){wp10DailyHistory.push(d);wp10DailyHistory=wp10DailyHistory.filter(v=>d.at-v.at<=86400000).slice(-WP10_HISTORY_MAX);wp10LastHistoryWrite=d.at;wp10PersistDailyHistory();wp10HistoryRender();}const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};set('wp10MonBattery',d.battery===null?'Недоступно':d.battery+'%');set('wp10MonHeap',d.heap===null?'Недоступно':d.heap+'% лимита');set('wp10MonNetwork',d.network);set('wp10MonTime',new Date(d.at).toLocaleTimeString('ru-RU'));wp10MonitorDraw();const status=$('wp10MonitorStatus');if(status)status.textContent=`Активен · ${wp10MonitorHistory.length} live-замеров · история сохраняется раз в минуту`;}
function wp10ToggleMonitor(){const btn=$('wp10MonitorToggle');if(wp10MonitorTimer){clearInterval(wp10MonitorTimer);wp10MonitorTimer=null;if(btn)btn.innerHTML='<i class="fa-solid fa-play" aria-hidden="true"></i> Запустить';const st=$('wp10MonitorStatus');if(st)st.textContent='Мониторинг остановлен. Суточная история сохранена на устройстве.';}else{wp10MonitorSample();wp10MonitorTimer=setInterval(wp10MonitorSample,5000);if(btn)btn.innerHTML='<i class="fa-solid fa-pause" aria-hidden="true"></i> Остановить';}if(typeof wp104Text==='function')wp104Text('wp104LiveState',wp10MonitorTimer?'Активен':'Выключен');}
function wp10ClearMonitorHistory(){wp10MonitorHistory=[];wp10DailyHistory=[];wp10LastHistoryWrite=0;try{localStorage.removeItem(WP10_HISTORY_KEY);}catch(e){}wp10MonitorDraw();wp10HistoryRender();['wp10MonBattery','wp10MonHeap','wp10MonNetwork','wp10MonTime'].forEach(id=>{const e=$(id);if(e)e.textContent='—';});const st=$('wp10MonitorStatus');if(st)st.textContent=wp10MonitorTimer?'Мониторинг активен · история сброшена':'Мониторинг выключен · история сброшена';}
function wp10ExportMonitorHistory(){const payload={application:'Weather Pro 10.1',type:'local-device-monitor-history',retention:'Up to 24 hours; sampled approximately once per minute while monitoring is active.',privacy:'Stored locally in this browser. Export occurs only after explicit user action.',records:wp10DailyHistory};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='weather-pro-device-history-24h.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotification('Экспорт суточной истории готов');}
function wp10RunDeviceHealthCheck(){const cards=[],add=(title,status,detail)=>cards.push(`<article class="wp6-card"><div class="wp6-kicker">${title}</div><h3 style="font-size:15px;margin:5px 0">${status}</h3><p style="font-size:12px">${detail}</p></article>`);const b=wp10DeviceSnapshotCache?.battery||{},conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;add('БАТАРЕЯ',b.supported?'API доступен':'API скрыт',b.supported?`Заряд ${Math.round((b.level||0)*100)}% · ${b.charging?'идёт зарядка':'не заряжается'}`:'Браузер не предоставляет Battery Status API.');add('ПАМЯТЬ JS',performance.memory?'Доступна':'Ограничена',performance.memory?'Браузер сообщает статистику heap; это не физическая RAM.':'Статистика памяти вкладки недоступна.');add('СЕТЬ',navigator.onLine?'Подключена':'Нет соединения',conn?`Тип ${conn.effectiveType||'неизвестен'} · RTT ${Number.isFinite(conn.rtt)?conn.rtt+' мс':'—'}`:'Детали сети скрыты браузером.');add('ХРАНИЛИЩЕ',navigator.storage?.estimate?'API доступен':'API недоступен',navigator.storage?.estimate?'Можно запросить оценку браузерного хранилища.':'Оценка хранилища недоступна.');add('ДАТЧИКИ',('DeviceMotionEvent'in window||'DeviceOrientationEvent'in window)?'Поддерживаются':'Не обнаружены','Доступ может требовать HTTPS и отдельного разрешения пользователя.');add('ЗАЩИТА',window.isSecureContext?'Защищённый контекст':'Не HTTPS',window.isSecureContext?'Страница работает в защищённом контексте.':'Часть API может быть отключена без HTTPS или localhost.');const grid=$('wp10DiagGrid');if(grid)grid.innerHTML=cards.join('');const summary=$('wp10DiagSummary');if(summary)summary.textContent=`Проверено ${new Date().toLocaleTimeString('ru-RU')} · проверены только доступные веб-API.`;}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&wp10MonitorTimer){clearInterval(wp10MonitorTimer);wp10MonitorTimer=null;const b=$('wp10MonitorToggle');if(b)b.innerHTML='<i class="fa-solid fa-play" aria-hidden="true"></i> Запустить';const st=$('wp10MonitorStatus');if(st)st.textContent='Приостановлен: вкладка была скрыта. Запустите снова вручную.';}});
// Redraw charts only when their actual CSS width changes, not when Android
// expands/collapses browser controls and changes only the viewport height.
let wp10LastMonitorCanvasWidth=0,wp10LastHistoryCanvasWidth=0;
function wp10HandleChartResize(){
  const monitor=$('wp10MonitorChart'),history=$('wp10HistoryChart');
  const monitorWidth=monitor?.clientWidth||0,historyWidth=history?.clientWidth||0;
  if(monitorWidth&&monitorWidth!==wp10LastMonitorCanvasWidth){wp10LastMonitorCanvasWidth=monitorWidth;if(wp10MonitorHistory.length)wp10MonitorDraw();}
  if(historyWidth&&historyWidth!==wp10LastHistoryCanvasWidth){wp10LastHistoryCanvasWidth=historyWidth;if(wp10DailyHistory.length)wp10HistoryRender();}
}
if(typeof ResizeObserver!=='undefined'){
  const wp10ChartResizeObserver=new ResizeObserver(()=>wp10HandleChartResize());
  ['wp10MonitorChart','wp10HistoryChart'].forEach(id=>{const canvas=$(id);if(canvas)wp10ChartResizeObserver.observe(canvas);});
}else{
  window.addEventListener('orientationchange',()=>setTimeout(wp10HandleChartResize,180),{passive:true});
}
wp10HistoryRender();
window.wp10ToggleMonitor=wp10ToggleMonitor;window.wp10ClearMonitorHistory=wp10ClearMonitorHistory;window.wp10ExportMonitorHistory=wp10ExportMonitorHistory;window.wp10RunDeviceHealthCheck=wp10RunDeviceHealthCheck;
let wp10SensorsActive=false,wp10SensorPermissionChecked=false;
function wp10FmtSensor(v){return Number.isFinite(v)?v.toFixed(2):'—';}
function wp10RenderSensorStatus(message){const el=$('wp10SensorStatus');if(el)el.textContent=message;}
function wp10OnMotion(e){const a=e.accelerationIncludingGravity||e.acceleration||{};const r=e.rotationRate||{};const accel=$('wp10SensorAccel'),rot=$('wp10SensorRotation');const accelText=`${wp10FmtSensor(a.x)} / ${wp10FmtSensor(a.y)} / ${wp10FmtSensor(a.z)} m/s²`,rotText=`${wp10FmtSensor(r.alpha)} / ${wp10FmtSensor(r.beta)} / ${wp10FmtSensor(r.gamma)} °/s`;if(accel)accel.textContent=accelText;if(rot)rot.textContent=rotText;if(typeof wp104Text==='function'){wp104Text('wp104SensorAccel',accelText);wp104Text('wp104SensorGyro',rotText);}}
function wp10OnOrientation(e){const ori=$('wp10SensorOrientation'),compass=$('wp10SensorCompass');if(ori)ori.textContent=`${wp10FmtSensor(e.alpha)} / ${wp10FmtSensor(e.beta)} / ${wp10FmtSensor(e.gamma)}°`;const heading=Number.isFinite(e.webkitCompassHeading)?e.webkitCompassHeading:(Number.isFinite(e.alpha)?(360-e.alpha)%360:null);if(compass)compass.textContent=heading===null?'—':`${Math.round(heading)}° (ориентир)`;}
async function wp10StartSensors(){
  if(wp10SensorsActive)return;
  const asks=[];
  try{if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function')asks.push(DeviceMotionEvent.requestPermission());}catch(e){showNotification('Не удалось запросить доступ к акселерометру',true);return;}
  try{if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function')asks.push(DeviceOrientationEvent.requestPermission());}catch(e){showNotification('Не удалось запросить доступ к ориентации',true);return;}
  if(asks.length){try{const permissions=await Promise.all(asks);if(permissions.some(x=>x!=='granted')){wp10RenderSensorStatus('Разрешение не предоставлено. Датчики остались выключены.');return;}}catch(e){wp10RenderSensorStatus('Браузер не разрешил доступ к датчикам.');return;}}
  if(!('DeviceMotionEvent'in window)&&!('DeviceOrientationEvent'in window)){wp10RenderSensorStatus('Этот браузер не поддерживает датчики движения и ориентации.');return;}
  window.addEventListener('devicemotion',wp10OnMotion,{passive:true});window.addEventListener('deviceorientation',wp10OnOrientation,{passive:true});wp10SensorsActive=true;wp10RenderSensorStatus('Датчики включены. Показания обновляются в реальном времени; выключите их кнопкой ниже.');
}
function wp10StopSensors(){if(wp10SensorsActive){window.removeEventListener('devicemotion',wp10OnMotion);window.removeEventListener('deviceorientation',wp10OnOrientation);wp10SensorsActive=false;}wp10RenderSensorStatus('Датчики выключены.');['wp10SensorAccel','wp10SensorRotation','wp10SensorOrientation','wp10SensorCompass'].forEach(id=>wp6SetText(id,'—'));}
window.wp10StartSensors=wp10StartSensors;window.wp10StopSensors=wp10StopSensors;




