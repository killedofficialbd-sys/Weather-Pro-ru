/* Weather Pro V16 module: 09-ai-and-workspaces.js — extracted from the existing app script. */
/* ============================================================
   WEATHER PRO 10.0 — ULTIMATE MODULES
   ============================================================ */
const WP10_PREF_KEY='wp10_ultimate_prefs';
let wp10Prefs={radarAutoRefresh:true,autoBrief:true};
let wp10RadarTimer=null,wp10StatsChart=null;
function wp10LoadPrefs(){
  try{wp10Prefs=Object.assign({radarAutoRefresh:true,autoBrief:true},JSON.parse(localStorage.getItem(WP10_PREF_KEY)||'{}')||{});}catch(e){wp10Prefs={radarAutoRefresh:true,autoBrief:true};}
  const radar=$('wp10RadarAutoRefresh'),brief=$('wp10AutoBrief');if(radar)radar.checked=!!wp10Prefs.radarAutoRefresh;if(brief)brief.checked=!!wp10Prefs.autoBrief;
}
function wp10SavePrefs(){
  wp10Prefs={radarAutoRefresh:!!$('wp10RadarAutoRefresh')?.checked,autoBrief:!!$('wp10AutoBrief')?.checked};
  try{localStorage.setItem(WP10_PREF_KEY,JSON.stringify(wp10Prefs));}catch(e){}
  showNotification('Настройки Weather Pro 10.0 сохранены');
}
function wp10Init(){
  wp10LoadPrefs();
  if(!wp10RadarTimer)wp10RadarTimer=setInterval(()=>{
    if(wp10Prefs.radarAutoRefresh&&$('map-page')?.classList.contains('active')&&navigator.onLine&&!document.hidden){initRadar();}
  },10*60*1000);
}
function wp10ToggleAndroidHelp(){const el=$('wp10AndroidHelp');if(el)el.classList.toggle('show');}
async function wp10InstallAndroid(){
  if(typeof installPWA==='function'&&_pwaPrompt){installPWA();return;}
  const help=$('wp10AndroidHelp');if(help){help.classList.add('show');help.scrollIntoView({behavior:settings.animations===false?'auto':'smooth',block:'nearest'});}
  showNotification('Откройте меню браузера ⋮ и выберите «Установить приложение» или «Добавить на главный экран».');
}
async function wp10EnableNotifications(){
  if(!('Notification'in window)){showNotification('Этот браузер не поддерживает системные уведомления',true);return;}
  try{
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(permission!=='granted'){showNotification('Разрешение на уведомления не получено',true);return;}
    if($('browserNotifications'))$('browserNotifications').checked=true;
    settings.browserNotifications=true;saveSettingsSilent();
    try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification('Weather Pro 10.0',{body:'Системные уведомления подключены. Настройте погодные события в разделе «Умные предупреждения».',icon:'./weather-icon-192.png',tag:'wp10-notification-test'});}else new Notification('Weather Pro 10.0',{body:'Системные уведомления подключены.'});}catch(e){new Notification('Weather Pro 10.0',{body:'Системные уведомления подключены.'});}
    showNotification('Уведомления разрешены');
  }catch(e){showNotification('Не удалось включить уведомления: '+(e.message||'ошибка браузера'),true);}
}
function wp10Fmt(v,d=0){return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';}
async function wp10RefreshAIForecast(force=false){
  const summary=$('wp10AiSummary'),metrics=$('wp10AiMetrics'),meta=$('wp10AiMeta');if(!summary||!metrics)return;
  if(!lastWeatherData?.coord){summary.textContent='Сначала загрузите погоду на главной странице — тогда появятся координаты для анализа.';return;}
  if(meta)meta.textContent='Анализируем почасовой прогноз Open-Meteo…';
  try{
    const data=await wp70FetchForecast(!!force);const hours=wp70Hours(data,24);
    if(!hours.length)throw new Error('Источник не вернул почасовые данные на ближайшие сутки.');
    const valid=fn=>hours.map(fn).filter(v=>Number.isFinite(Number(v))).map(Number);
    const temps=valid(x=>x.temp),rain=hours.reduce((a,b)=>wp70N(b.rainProb)>wp70N(a.rainProb)?b:a,hours[0]),gust=valid(x=>x.gust),uv=valid(x=>x.uv);
    if(!temps.length)throw new Error('В прогнозе нет числовых значений температуры.');
    const minT=Math.min(...temps),maxT=Math.max(...temps),maxWind=Math.max(0,...gust),maxUv=Math.max(0,...uv);
    const wet=hours.filter(x=>wp70N(x.rainProb)>=50),thunder=hours.find(x=>wp70N(x.code)>=95),cold=minT<=2,hot=maxT>=28;
    let parts=[`В ${lastWeatherData.name||currentCity} температура в ближайшие 24 часа ожидается от ${Math.round(minT)} до ${Math.round(maxT)} °C.`];
    if(wet.length)parts.push(`Наибольшая вероятность осадков — ${Math.round(wp70N(rain.rainProb))}% около ${wp70FmtHour(rain.time)}.`);else parts.push('Сильного сигнала по вероятности дождя в почасовом прогнозе нет.');
    if(maxWind>=12)parts.push(`Порывы ветра могут достигать ${maxWind.toFixed(1)} м/с.`);
    if(thunder)parts.push(`Есть грозовой погодный код около ${wp70FmtHour(thunder.time)} — проверьте официальные предупреждения.`);
    let advice='Обычный городской режим: ориентируйтесь на фактическую погоду и обновляйте прогноз перед выходом.';
    if(wet.length)advice='Возьмите зонт или водонепроницаемую одежду; наиболее мокрый интервал указан выше.';
    if(cold)advice='Одевайтесь теплее: минимальная температура опускается до '+Math.round(minT)+' °C.';
    if(hot)advice='Планируйте активность на улице вне наиболее жарких часов и возьмите воду.';
    if(maxWind>=16)advice+=' Учитывайте сильные порывы ветра.';
    summary.textContent=parts.join(' ')+` Совет: ${advice}`;
    metrics.innerHTML=[
      ['Температура',`${Math.round(minT)}…${Math.round(maxT)}°C`,'Минимум и максимум','fa-temperature-half'],
      ['Осадки',`${Math.round(wp70N(rain.rainProb))}%`,`Пик около ${wp70FmtHour(rain.time)}`,'fa-cloud-rain'],
      ['Порывы ветра',`${maxWind.toFixed(1)} м/с`,'Максимум за 24 часа','fa-wind'],
      ['УФ-индекс',wp10Fmt(maxUv,1),'Пик по прогнозу','fa-sun']
    ].map(x=>`<article class="wp10-insight"><small>${x[0]}</small><strong>${x[1]}</strong><span><i class="fa-solid ${x[3]}"></i> ${x[2]}</span></article>`).join('');
    if(meta)meta.textContent=`${lastWeatherData.name||currentCity} · обновлено ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · Open-Meteo`;
  }catch(e){summary.textContent='Не удалось рассчитать AI-прогноз: '+(e.message||'ошибка данных');if(meta)meta.textContent='Проверьте подключение и координаты активного города.';}
}
async function wp10RefreshStats(force=false){
  const metrics=$('wp10StatsMetrics'),meta=$('wp10StatsMeta'),canvas=$('wp10StatsChart');if(!metrics||!canvas)return;
  if(!lastWeatherData?.coord){if(meta)meta.textContent='Сначала загрузите город на главной странице.';return;}
  try{
    const data=await wp70FetchForecast(!!force),d=data.daily;if(!d?.time?.length)throw new Error('Нет дневного прогноза.');
    const arr=k=>(d[k]||[]).map(Number).filter(Number.isFinite),max=arr('temperature_2m_max'),min=arr('temperature_2m_min'),rain=arr('precipitation_sum'),wind=arr('wind_speed_10m_max'),uv=arr('uv_index_max');
    const avg=max.length?max.reduce((a,b)=>a+b,0)/max.length:NaN,totalRain=rain.reduce((a,b)=>a+b,0),maxWind=Math.max(0,...wind),maxUv=Math.max(0,...uv),rainDays=rain.filter(v=>v>=1).length;
    const wetIdx=rain.length?rain.indexOf(Math.max(...rain)):-1;
    metrics.innerHTML=[
      ['Средний максимум',`${wp10Fmt(avg,1)}°C`,'Средняя дневная температура','fa-temperature-high'],
      ['Осадки',`${wp10Fmt(totalRain,1)} мм`,`${rainDays} дней с осадками ≥ 1 мм`,'fa-cloud-rain'],
      ['Макс. ветер',`${wp10Fmt(maxWind,1)} м/с`,'Пиковая скорость','fa-wind'],
      ['УФ-индекс',wp10Fmt(maxUv,1),'Максимум за неделю','fa-sun']
    ].map(x=>`<article class="wp10-insight"><small>${x[0]}</small><strong>${x[1]}</strong><span><i class="fa-solid ${x[3]}"></i> ${x[2]}</span></article>`).join('');
    if(meta)meta.textContent=`${lastWeatherData.name||currentCity} · ${d.time.length} дней прогноза · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`;
    if(window.Chart){try{wp10StatsChart?.destroy();}catch(e){};wp10StatsChart=new Chart(canvas.getContext('2d'),{type:'bar',data:{labels:d.time.map(x=>new Date(x+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'short',day:'numeric'})),datasets:[{label:'Максимум, °C',data:d.temperature_2m_max||[],backgroundColor:'rgba(96,165,250,.72)',borderRadius:7},{label:'Минимум, °C',data:d.temperature_2m_min||[],backgroundColor:'rgba(45,212,191,.58)',borderRadius:7}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#a9bfd9',boxWidth:11,font:{size:11}}}},scales:{x:{ticks:{color:'#90a8c5'},grid:{display:false}},y:{ticks:{color:'#90a8c5'},grid:{color:'rgba(148,163,184,.1)'}}}}});}
  }catch(e){if(meta)meta.textContent='Не удалось загрузить недельную статистику: '+(e.message||'ошибка данных');}
}
async function wp10CompareCurrentCity(name,index){
  const u=settings.units||'metric';const r=await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(name)}&appid=${OWM_KEY}&units=${u}&lang=ru`);const d=await r.json();
  if(!r.ok||Number(d.cod)!==200)throw new Error(d.message||'Город не найден');return d;
}
async function wp10CompareExtraCity(name,index){
  const box=$('wp10CompareExtra');if(!box)return;
  let card=document.getElementById('wp10CompareCard'+index);
  if(!card){card=document.createElement('article');card.className='wp10-compare-card';card.id='wp10CompareCard'+index;box.appendChild(card);}
  card.innerHTML=`<h3>${esc(name)}</h3><div class="value">…</div><p>Загружаем текущую погоду</p>`;
  try{const d=await wp10CompareCurrentCity(name,index);const unit=settings.units==='imperial'?'°F':'°C',wind=convertWind(settings.units==='imperial'?d.wind.speed/2.237:d.wind.speed);card.innerHTML=`<h3>${esc(d.name)}, ${esc(d.sys.country||'')}</h3><div class="value">${Math.round(d.main.temp)}${unit}</div><p>${esc(d.weather?.[0]?.description||'—')}<br>Ветер ${esc(wind)} · влажность ${Math.round(d.main.humidity)}%</p>`;}
  catch(e){card.innerHTML=`<h3>${esc(name)}</h3><div class="value">—</div><p>${esc(e.message||'Не удалось загрузить данные')}</p>`;}
}
function installPWA(){
  if(!_pwaPrompt){ showNotification('Установка недоступна в этом браузере', true); return; }
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(c => {
    if(c.outcome === 'accepted'){ showNotification('Установлено'); document.getElementById('installBanner').classList.remove('show'); }
    _pwaPrompt = null;
  });
}
window.installPWA=installPWA;
function dismissInstall(){
  document.getElementById('installBanner').classList.remove('show');
  localStorage.setItem('wp_install_dismissed', '1');
}
window.dismissInstall=dismissInstall;

function loadTestForecast(){
  const box=$('forecast');if(!box)return;
  box.innerHTML='<div class="wp16-empty-state" role="status"><i class="fa-solid fa-cloud-xmark" aria-hidden="true"></i><strong>Прогноз временно недоступен</strong><span>Реальные погодные источники не ответили, а сохранённого прогноза нет. Проверьте соединение и повторите загрузку.</span><button type="button" class="wp16-outline-button" onclick="getWeather(currentCity)">Повторить</button></div>';
} 



/* ============================================================
   WEATHER PRO 7.0 — PLANET INTELLIGENCE
   ============================================================ */
const WP70={forecast:null,forecastAt:0,timelineChart:null,historyChart:null,analytics:null,network:[],lastStorm:[],notifyTimer:null,loading:false};
const WP70_CITIES=[
  {name:'Таллин',country:'Эстония',lat:59.437,lon:24.7536},
  {name:'Хельсинки',country:'Финляндия',lat:60.1699,lon:24.9384},
  {name:'Стокгольм',country:'Швеция',lat:59.3293,lon:18.0686},
  {name:'Лондон',country:'Великобритания',lat:51.5072,lon:-0.1276},
  {name:'Нью-Йорк',country:'США',lat:40.7128,lon:-74.006},
  {name:'Токио',country:'Япония',lat:35.6762,lon:139.6503}
];
function wp70Esc(s){return typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function wp70Coords(){const c=lastWeatherData?.coord;return c&&Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lon))?{lat:Number(c.lat),lon:Number(c.lon)}:null;}
function wp70Set(id,value){const e=$(id);if(e)e.textContent=value;}
function wp70Wmo(code){const n=Number(code);if(n===0)return ['Ясно','fa-sun'];if([1,2].includes(n))return ['Переменная облачность','fa-cloud-sun'];if(n===3)return ['Пасмурно','fa-cloud'];if([45,48].includes(n))return ['Туман','fa-smog'];if([51,53,55,56,57].includes(n))return ['Морось','fa-cloud-rain'];if([61,63,65,66,67,80,81,82].includes(n))return ['Дождь','fa-cloud-showers-heavy'];if([71,73,75,77,85,86].includes(n))return ['Снег','fa-snowflake'];if([95,96,99].includes(n))return ['Гроза','fa-cloud-bolt'];return ['Переменная погода','fa-cloud-sun'];}
function wp70N(v,d=0){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):d;}
function wp70FmtHour(s){try{return new Date(s).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}catch(e){return String(s||'').slice(11,16);}}
function wp70FmtDay(s){try{return new Date(s+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'short'});}catch(e){return s;}}
function wp70ForecastUrl(lat,lon){
  const hourly='temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,cape,uv_index';
  const daily='weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max';
  return `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&hourly=${hourly}&daily=${daily}&forecast_days=7&timezone=auto&wind_speed_unit=ms`;
}
async function wp70FetchForecast(force=false){
  const coords=wp70Coords();if(!coords)throw new Error('Сначала загрузите город на главной странице: нужны его координаты.');
  const cacheKey=`wp70_forecast_${coords.lat.toFixed(3)}_${coords.lon.toFixed(3)}`;
  const cachedCoordsMatch=WP70.forecast&&Math.abs(Number(WP70.forecast.latitude)-coords.lat)<0.01&&Math.abs(Number(WP70.forecast.longitude)-coords.lon)<0.01;
  if(!force&&cachedCoordsMatch&&Date.now()-WP70.forecastAt<10*60*1000)return WP70.forecast;
  if(!force){try{const saved=JSON.parse(localStorage.getItem(cacheKey)||'null');if(saved?.data&&Date.now()-saved.ts<30*60*1000){WP70.forecast=saved.data;WP70.forecastAt=saved.ts;return WP70.forecast;}}catch(e){}}
  const r=await fetch(wp70ForecastUrl(coords.lat,coords.lon),{cache:'no-store'});if(!r.ok)throw new Error(`Open-Meteo вернул HTTP ${r.status}`);const data=await r.json();if(!data.hourly?.time?.length)throw new Error('Источник не вернул почасовой прогноз.');
  WP70.forecast=data;WP70.forecastAt=Date.now();try{localStorage.setItem(cacheKey,JSON.stringify({ts:WP70.forecastAt,data}));}catch(e){}
  return data;
}
function wp70Hours(data=WP70.forecast,count=48){if(!data?.hourly?.time)return [];const h=data.hourly;const start=Date.now()-60*60*1000;const out=[];for(let i=0;i<h.time.length&&out.length<count;i++){if(Date.parse(h.time[i])<start)continue;const read=k=>h[k]?.[i];out.push({time:h.time[i],temp:read('temperature_2m'),feels:read('apparent_temperature'),humidity:read('relative_humidity_2m'),rainProb:read('precipitation_probability'),precip:read('precipitation'),snow:read('snowfall'),code:read('weather_code'),wind:read('wind_speed_10m'),gust:read('wind_gusts_10m'),visibility:read('visibility'),cloud:read('cloud_cover'),cape:read('cape'),thunder:null,uv:read('uv_index')});}return out;}
function wp70Metric(label,value,detail,icon){return `<article class="wp70-metric"><small>${wp70Esc(label)}</small><strong>${wp70Esc(value)}</strong><span><i class="fa-solid ${icon||'fa-circle-info'}"></i> ${wp70Esc(detail||'')}</span></article>`;}
function wp70Event(icon,title,desc,severity,tag){return `<article class="wp70-event"><div class="wp70-event-icon"><i class="fa-solid ${icon}"></i></div><div><strong>${wp70Esc(title)}</strong><p>${wp70Esc(desc)}</p></div><span class="wp70-severity ${severity==='high'?'high':severity==='low'?'low':''}">${wp70Esc(tag)}</span></article>`;}
function wp70RenderStorm(data=WP70.forecast){
  const metrics=$('wp70StormMetrics'),eventsBox=$('wp70StormEvents');if(!metrics||!eventsBox)return;
  const hours=wp70Hours(data,48);if(!hours.length){metrics.innerHTML='<div class="wp70-empty">Нет почасовых данных для анализа.</div>';eventsBox.innerHTML='';return;}
  const next=hours.slice(0,24);const maxGust=Math.max(...next.map(x=>wp70N(x.gust)));const maxCape=Math.max(...next.map(x=>wp70N(x.cape)));const maxRain=Math.max(...next.map(x=>wp70N(x.rainProb)));const minVis=Math.min(...next.filter(x=>x.visibility!==null&&x.visibility!==undefined&&Number.isFinite(Number(x.visibility))).map(x=>Number(x.visibility)),Infinity);
  metrics.innerHTML=wp70Metric('Порывы ветра',`${maxGust.toFixed(1)} м/с`,'максимум за 24 часа','fa-wind')+wp70Metric('CAPE',`${Math.round(maxCape)} Дж/кг`,'конвективная энергия','fa-cloud-bolt')+wp70Metric('Вероятность осадков',`${Math.round(maxRain)}%`,'максимум за час','fa-cloud-rain')+wp70Metric('Видимость',Number.isFinite(minVis)?`${(minVis/1000).toFixed(1)} км`:'—','минимум за 24 часа','fa-eye');
  const ev=[];
  const thunderHour=next.find(x=>wp70N(x.code)>=95);
  if(thunderHour){ev.push({score:95,html:wp70Event('fa-cloud-bolt','Гроза в погодном коде модели',`Около ${wp70FmtHour(thunderHour.time)} модель показывает грозовое явление. Следите за официальными предупреждениями.`,'high','Грозовой сигнал')});}
  else {const capeHour=next.find(x=>wp70N(x.cape)>=1200);if(capeHour)ev.push({score:65,html:wp70Event('fa-bolt','Повышенная конвективная энергия',`Около ${wp70FmtHour(capeHour.time)} CAPE достигает ${Math.round(wp70N(capeHour.cape))} Дж/кг. CAPE указывает на потенциал конвекции, но сам по себе не подтверждает грозу.`,'mid','Потенциал')});}
  const gustHour=next.find(x=>wp70N(x.gust)>=20);if(gustHour)ev.push({score:90,html:wp70Event('fa-wind','Сильные порывы ветра',`Около ${wp70FmtHour(gustHour.time)} порывы могут достигать ${wp70N(gustHour.gust).toFixed(1)} м/с.`,'high','Высокий сигнал')});else if(maxGust>=14)ev.push({score:55,html:wp70Event('fa-wind','Заметный ветер',`Порывы до ${maxGust.toFixed(1)} м/с в ближайшие сутки.`,'mid','Умеренный')});
  const rainHour=next.find(x=>wp70N(x.rainProb)>=70&&wp70N(x.precip)>=2);if(rainHour)ev.push({score:70,html:wp70Event('fa-cloud-showers-heavy','Интенсивные осадки',`Около ${wp70FmtHour(rainHour.time)}: вероятность ${Math.round(wp70N(rainHour.rainProb))}%, количество ${wp70N(rainHour.precip).toFixed(1)} мм/ч.`,'mid','Следить')});
  const visHour=next.find(x=>Number.isFinite(Number(x.visibility))&&Number(x.visibility)<1000);if(visHour)ev.push({score:65,html:wp70Event('fa-smog','Низкая видимость',`Около ${wp70FmtHour(visHour.time)} видимость может опуститься ниже 1 км.`,'mid','Осторожно')});
  const snowHour=next.find(x=>wp70N(x.snow)>1);if(snowHour)ev.push({score:50,html:wp70Event('fa-snowflake','Снегопад',`Около ${wp70FmtHour(snowHour.time)} прогнозируется снегопад ${wp70N(snowHour.snow).toFixed(1)} см/ч.`,'mid','Погодный сигнал')});
  ev.sort((a,b)=>b.score-a.score);WP70.lastStorm=ev;
  eventsBox.innerHTML=ev.length?ev.map(x=>x.html).join(''):'<div class="wp70-empty"><i class="fa-solid fa-shield-check"></i><br>В ближайших 24 часах пороги автоматического Storm Hunter не превышены. Это не означает отсутствия локальной опасности.</div>';
  wp70NotifyFromEvents(ev);
}
function wp70RenderTimeline(data=WP70.forecast){
  const hours=wp70Hours(data,48),strip=$('wp70HourStrip');if(!strip)return;if(!hours.length){strip.innerHTML='<div class="wp70-empty">Нет почасовых данных.</div>';return;}
  strip.innerHTML=hours.slice(0,24).map(x=>{const [label,icon]=wp70Wmo(x.code);return `<div class="wp70-hour"><time>${wp70FmtHour(x.time)}</time><i class="fa-solid ${icon}" aria-hidden="true"></i><strong>${Math.round(wp70N(x.temp))}°</strong><span>${wp70Esc(label)}<br>${Math.round(wp70N(x.rainProb))}% осадков<br>${wp70N(x.wind).toFixed(1)} м/с</span></div>`;}).join('');
  const ctx=$('wp70TimelineChart');if(!ctx||!window.Chart)return;try{WP70.timelineChart?.destroy();}catch(e){}
  WP70.timelineChart=new Chart(ctx,{type:'line',data:{labels:hours.slice(0,48).map(x=>wp70FmtHour(x.time)),datasets:[{label:'Температура, °C',data:hours.slice(0,48).map(x=>x.temp),borderWidth:2,tension:.28,pointRadius:0,yAxisID:'y'},{label:'Осадки, мм',data:hours.slice(0,48).map(x=>x.precip),borderWidth:1.5,tension:.2,pointRadius:0,yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#94a3b8',boxWidth:10,font:{size:10}}}},scales:{x:{ticks:{color:'#94a3b8',maxTicksLimit:8,font:{size:9}},grid:{color:'rgba(148,163,184,.08)'}},y:{ticks:{color:'#94a3b8',font:{size:9}},grid:{color:'rgba(148,163,184,.08)'}},y1:{position:'right',beginAtZero:true,ticks:{color:'#94a3b8',font:{size:9}},grid:{drawOnChartArea:false}}}}});
}
function wp70RenderAI(data=WP70.forecast){
  const brief=$('wp70AIBrief'),advice=$('wp70AIAdvice');if(!brief||!advice)return;const h=wp70Hours(data,24);if(!h.length){brief.innerHTML='<i class="fa-solid fa-brain"></i><span>Загрузите актуальный прогноз.</span>';return;}
  const peakRain=h.reduce((a,b)=>wp70N(b.rainProb)>wp70N(a.rainProb)?b:a,h[0]);const peakWind=h.reduce((a,b)=>wp70N(b.gust)>wp70N(a.gust)?b:a,h[0]);const temps=h.map(x=>Number(x.temp)).filter(Number.isFinite);const minT=Math.min(...temps),maxT=Math.max(...temps);const wet=h.filter(x=>wp70N(x.rainProb)>=55);const thunder=h.filter(x=>wp70N(x.code)>=95||wp70N(x.cape)>=1200);
  let summary=`На ближайшие 24 часа температура ожидается в диапазоне ${Math.round(minT)}…${Math.round(maxT)}°C.`;if(wet.length)summary+=` Наиболее вероятные осадки — около ${wp70FmtHour(peakRain.time)} (${Math.round(wp70N(peakRain.rainProb))}%).`;else summary+=' Значимого дождевого сигнала по доступному прогнозу не обнаружено.';if(wp70N(peakWind.gust)>=14)summary+=` Обратите внимание на порывы ветра до ${wp70N(peakWind.gust).toFixed(1)} м/с.`;if(thunder.some(x=>wp70N(x.code)>=95))summary+=' Модель показывает грозовой погодный код в отдельные часы — проверьте официальные предупреждения.';else if(thunder.length)summary+=' Есть повышенный конвективный потенциал по CAPE, который сам по себе не подтверждает грозу.';
  brief.innerHTML=`<i class="fa-solid fa-brain" aria-hidden="true"></i><span>${wp70Esc(summary)}<small style="display:block;color:var(--text-secondary);margin-top:7px;font-size:9px">Автоматический аналитический брифинг на основе прогноза Open-Meteo, не генеративное медицинское или аварийное заключение.</small></span>`;
  const tips=[];if(wet.length)tips.push(['fa-umbrella','Зонт','Планируйте прогулку до '+wp70FmtHour(peakRain.time)+' или возьмите защиту от дождя.']);if(wp70N(peakWind.gust)>=12)tips.push(['fa-wind','Ветер','Для велосипеда и лёгких конструкций учитывайте порывы ветра.']);if(maxT>=28)tips.push(['fa-sun','Жара','Планируйте активность на улице вне наиболее жарких часов.']);if(minT<=2)tips.push(['fa-snowflake','Холод','Учитывайте низкую температуру и возможную скользкую поверхность.']);if(thunder.some(x=>wp70N(x.code)>=95))tips.push(['fa-cloud-bolt','Грозовой сигнал','Следите за официальными предупреждениями и укройтесь в безопасном месте при грозе.']);else if(thunder.length)tips.push(['fa-bolt','Конвективный потенциал','Есть повышенное значение CAPE; это не прогноз вероятности грозы. Сверяйтесь с предупреждениями.']);if(!tips.length)tips.push(['fa-person-walking','Активность','По доступным параметрам ближайшие часы выглядят относительно спокойными; локальные условия могут отличаться.']);
  advice.innerHTML=tips.slice(0,3).map(x=>`<article class="wp70-advice"><i class="fa-solid ${x[0]}"></i><strong>${wp70Esc(x[1])}</strong><p>${wp70Esc(x[2])}</p></article>`).join('');
}
function wp70AskAI(){
  const h=wp70Hours(WP70.forecast,24),city=lastWeatherData?.name||currentCity||'активном городе';let prompt=`Проанализируй погоду для ${city} на ближайшие 24 часа. Используй эти свежие данные Open-Meteo: `;
  if(h.length){const p=h.slice(0,8).map(x=>`${wp70FmtHour(x.time)}: ${Math.round(wp70N(x.temp))}°C, осадки ${Math.round(wp70N(x.rainProb))}%, ветер ${wp70N(x.wind).toFixed(1)} м/с, порывы ${wp70N(x.gust).toFixed(1)} м/с, CAPE ${Math.round(wp70N(x.cape))}`).join('; ');prompt+=p+'. Дай практические рекомендации и укажи неопределённость.';}else prompt+='Сначала запроси актуальный прогноз и не выдумывай данные.';
  if(typeof askAIQuick==='function')askAIQuick(prompt);else{showPage('ai');if($('aiInput'))$('aiInput').value=prompt;}
}
async function wp70LoadNetwork(force=false){
  const box=$('wp70GlobalGrid');if(!box)return;box.innerHTML='<div class="wp70-empty">Обновляем контрольные города…</div>';
  const cacheKey='wp70_global_network';if(!force){try{const c=JSON.parse(localStorage.getItem(cacheKey)||'null');if(c?.data&&Date.now()-c.ts<15*60*1000){WP70.network=c.data;wp70RenderNetwork();return;}}catch(e){}}
  const results=await Promise.all(WP70_CITIES.map(async city=>{try{const u=`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();return {...city,current:j.current||null,timezone:j.timezone||''};}catch(e){return {...city,error:e.message};}}));
  WP70.network=results;try{localStorage.setItem(cacheKey,JSON.stringify({ts:Date.now(),data:results}));}catch(e){}wp70RenderNetwork();
}
function wp70RenderNetwork(){const box=$('wp70GlobalGrid');if(!box)return;box.innerHTML=WP70.network.map(c=>{if(!c.current)return `<article class="wp70-city"><strong>${wp70Esc(c.name)}</strong><p>Данные временно недоступны.</p></article>`;const [label,icon]=wp70Wmo(c.current.weather_code);return `<article class="wp70-city"><div class="wp70-city-top"><strong>${wp70Esc(c.name)}</strong><i class="fa-solid ${icon}"></i></div><div class="wp70-city-temp">${Math.round(wp70N(c.current.temperature_2m))}°C</div><p>${wp70Esc(label)} · ощущается ${Math.round(wp70N(c.current.apparent_temperature))}°C<br>Ветер ${wp70N(c.current.wind_speed_10m).toFixed(1)} м/с · влажность ${Math.round(wp70N(c.current.relative_humidity_2m))}%</p></article>`;}).join('');}
function wp70RenderCalendar(data=WP70.forecast){const box=$('wp70Calendar'),d=data?.daily;if(!box)return;if(!d?.time?.length){box.innerHTML='<div class="wp70-empty">Нет дневного прогноза.</div>';return;}box.innerHTML=d.time.map((day,i)=>{const [label,icon]=wp70Wmo(d.weather_code?.[i]);const lo=Math.round(wp70N(d.temperature_2m_min?.[i])),hi=Math.round(wp70N(d.temperature_2m_max?.[i]));const rain=Math.round(wp70N(d.precipitation_probability_max?.[i]));const wind=wp70N(d.wind_speed_10m_max?.[i]).toFixed(0);const score=Math.max(0,Math.min(100,100-Math.max(0,rain-20)*.55-Math.max(0,wp70N(d.wind_speed_10m_max?.[i])-8)*3-Math.max(0,Math.abs((hi+lo)/2-18)-8)*2));return `<article class="wp70-day"><small>${wp70Esc(wp70FmtDay(day))}</small><i class="fa-solid ${icon}" aria-hidden="true"></i><strong>${hi}° / ${lo}°</strong><span>${wp70Esc(label)}<br>Осадки ${rain}% · ветер ${wind} м/с<br>Комфорт ${Math.round(score)}/100</span></article>`;}).join('');}
async function wp70LoadAnalytics(force=false){
  const metrics=$('wp70AnalyticsMetrics'),meta=$('wp70AnalyticsMeta');if(!metrics)return;const c=wp70Coords();if(!c){metrics.innerHTML='<div class="wp70-empty">Сначала загрузите город на главной.</div>';return;}metrics.innerHTML='<div class="wp70-empty">Загружаем архив за семь дней…</div>';
  const end=new Date(),start=new Date(Date.now()-6*86400000);const iso=d=>d.toISOString().slice(0,10);const key=`wp70_archive_${c.lat.toFixed(3)}_${c.lon.toFixed(3)}`;
  if(!force){try{const cache=JSON.parse(localStorage.getItem(key)||'null');if(cache?.data&&Date.now()-cache.ts<6*60*60*1000){WP70.analytics=cache.data;wp70RenderAnalytics();return;}}catch(e){}}
  try{const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${c.lat}&longitude=${c.lon}&start_date=${iso(start)}&end_date=${iso(end)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&hourly=temperature_2m&timezone=auto&wind_speed_unit=ms`;const r=await fetch(url);if(!r.ok)throw new Error(`Архивный API: HTTP ${r.status}`);const data=await r.json();if(!data.daily?.time?.length)throw new Error('Архив не содержит дневных данных.');WP70.analytics=data;try{localStorage.setItem(key,JSON.stringify({ts:Date.now(),data}));}catch(e){}wp70RenderAnalytics();if(meta)meta.textContent=`Источник Open-Meteo Historical Weather · ${data.daily.time[0]} — ${data.daily.time.at(-1)} · ${data.timezone||'локальное время'}`;}catch(e){metrics.innerHTML=`<div class="wp70-empty">${wp70Esc(e.message)}. Архивные данные не подменялись прогнозом.</div>`;if(meta)meta.textContent='Архив временно недоступен.';}
}
function wp70RenderAnalytics(){const d=WP70.analytics?.daily,metrics=$('wp70AnalyticsMetrics');if(!d||!metrics)return;const maxs=(d.temperature_2m_max||[]).map(Number).filter(Number.isFinite),mins=(d.temperature_2m_min||[]).map(Number).filter(Number.isFinite),rain=(d.precipitation_sum||[]).map(Number).filter(Number.isFinite),wind=(d.wind_speed_10m_max||[]).map(Number).filter(Number.isFinite);const avg=maxs.length&&mins.length?(maxs.reduce((a,b)=>a+b,0)/maxs.length+mins.reduce((a,b)=>a+b,0)/mins.length)/2:NaN;const total=rain.reduce((a,b)=>a+b,0);metrics.innerHTML=wp70Metric('Средняя температура',Number.isFinite(avg)?`${avg.toFixed(1)}°C`:'—','среднее между дневным max/min','fa-temperature-half')+wp70Metric('Максимум',maxs.length?`${Math.max(...maxs).toFixed(1)}°C`:'—','за выбранную неделю','fa-arrow-up')+wp70Metric('Осадки',`${total.toFixed(1)} мм`,'сумма за период','fa-cloud-rain')+wp70Metric('Порывы / ветер',wind.length?`${Math.max(...wind).toFixed(1)} м/с`:'—','максимум дневного ветра','fa-wind');
  const ctx=$('wp70HistoryChart');if(ctx&&window.Chart){try{WP70.historyChart?.destroy();}catch(e){}WP70.historyChart=new Chart(ctx,{type:'line',data:{labels:d.time||[],datasets:[{label:'Макс. температура',data:d.temperature_2m_max||[],borderWidth:2,tension:.3,pointRadius:3},{label:'Мин. температура',data:d.temperature_2m_min||[],borderWidth:2,tension:.3,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8',font:{size:10}}}},scales:{x:{ticks:{color:'#94a3b8',font:{size:9}},grid:{color:'rgba(148,163,184,.08)'}},y:{ticks:{color:'#94a3b8',font:{size:9}},grid:{color:'rgba(148,163,184,.08)'}}}}});}
}
function wp70NotifyEnabled(){return localStorage.getItem('wp70_notify_enabled')==='1';}
function wp70UpdateNotifyUI(){const t=$('wp70NotifyToggle'),state=$('wp70NotifyState'),perm=$('wp70NotifyPermission');if(t)t.checked=wp70NotifyEnabled();if(state)state.textContent=wp70NotifyEnabled()?'Проверяются актуальные сигналы, пока приложение открыто':'Уведомления выключены';if(perm)perm.textContent=('Notification'in window)?`Разрешение браузера: ${Notification.permission}. Для уведомлений при закрытом приложении нужен отдельный push-сервер.`:'Этот браузер не поддерживает системные уведомления.';}
async function wp70RequestNotificationPermission(){if(!('Notification'in window)){showNotification('Системные уведомления не поддерживаются',true);return;}try{const p=await Notification.requestPermission();wp70UpdateNotifyUI();showNotification(p==='granted'?'Разрешение на уведомления получено':'Уведомления не разрешены',p!=='granted');}catch(e){showNotification('Не удалось запросить разрешение',true);}}
function wp70ToggleNotifications(on){localStorage.setItem('wp70_notify_enabled',on?'1':'0');wp70UpdateNotifyUI();if(on&&('Notification'in window)&&Notification.permission!=='granted')wp70RequestNotificationPermission();if(on)wp70NotifyFromEvents(WP70.lastStorm);}
function wp70NotifyFromEvents(events){if(!wp70NotifyEnabled()||!('Notification'in window)||Notification.permission!=='granted'||!events?.length)return;const top=events[0];const key=`wp70_notified_${new Date().toISOString().slice(0,10)}_${top.score>80?'high':'signal'}`;if(localStorage.getItem(key))return;try{const title='Weather Pro · погодный сигнал';const body=top.html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,170);if('serviceWorker'in navigator){navigator.serviceWorker.ready.then(reg=>reg.showNotification(title,{body,icon:'./weather-icon-192.png',tag:key,renotify:false})).catch(()=>new Notification(title,{body,tag:key}));}else new Notification(title,{body,tag:key});localStorage.setItem(key,'1');}catch(e){console.warn('[WeatherPro/Notifications]',e);}}
function wp70ExportCalendar(){const d=WP70.forecast?.daily;if(!d?.time?.length){showNotification('Сначала загрузите календарный прогноз',true);return;}const fmt=s=>String(s).replace(/-/g,'');const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Weather Pro//Planet Intelligence 7.0//RU','CALSCALE:GREGORIAN'];d.time.forEach((day,i)=>{const date=fmt(day),max=Math.round(wp70N(d.temperature_2m_max?.[i])),min=Math.round(wp70N(d.temperature_2m_min?.[i])),rain=Math.round(wp70N(d.precipitation_probability_max?.[i]));lines.push('BEGIN:VEVENT',`UID:weather-pro-${date}@planet-intelligence`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${date}`,`DTEND;VALUE=DATE:${fmt(new Date(Date.parse(day+'T12:00:00')+86400000).toISOString().slice(0,10))}`,`SUMMARY:Погода: ${max}° / ${min}°C`,`DESCRIPTION:Максимум ${max}°C, минимум ${min}°C, вероятность осадков до ${rain}%. Проверяйте актуальный прогноз и предупреждения.`,`END:VEVENT`);});lines.push('END:VCALENDAR');const blob=new Blob([lines.join('\r\n')],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='weather-pro-calendar.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotification('Календарь подготовлен для импорта');}
async function wp70CheckPWA(){const box=$('wp70PWAGrid');if(!box)return;let sw='Не зарегистрирован';try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();sw=regs.length?'Service Worker активен':'Ожидает регистрации';}}catch(e){sw='Ошибка проверки';}let storage='Не поддерживается';try{const q=await navigator.storage?.estimate?.();if(q)storage=`${(q.usage/1048576).toFixed(1)} МБ из ${(q.quota/1048576).toFixed(0)} МБ`; }catch(e){}const items=[['Подключение',navigator.onLine?'Online':'Offline',navigator.onLine],['Service Worker',sw,'serviceWorker'in navigator],['Режим установки',window.matchMedia?.('(display-mode: standalone)').matches?'Установлено':'Браузерный режим',true],['Хранилище',storage,!!navigator.storage],['Системные уведомления',('Notification'in window)?Notification.permission:'Не поддерживаются','Notification'in window],['Локальный прогноз',WP70.forecast?`Обновлён ${new Date(WP70.forecastAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:'Пока не загружен',!!WP70.forecast]];box.innerHTML=items.map(x=>`<article class="wp70-pwa"><strong>${wp70Esc(x[0])}</strong><span class="${x[2]?'ok':'warn'}">${wp70Esc(x[1])}</span></article>`).join('');}
async function wp70Refresh(silent=false){if(WP70.loading)return;WP70.loading=true;wp70Set('wp70SystemStatus','Загружаем данные…');try{const data=await wp70FetchForecast(true);const city=lastWeatherData?.name||currentCity||'Активный город';wp70Set('wp70SystemStatus','Система обновлена');wp70Set('wp70UpdatedAt',`Обновлено ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · Open-Meteo`);wp70Set('wp70NetworkState',navigator.onLine?'Online':'Offline');wp70Set('wp70CityLabel',city);wp70RenderStorm(data);wp70RenderTimeline(data);wp70RenderAI(data);wp70RenderCalendar(data);wp70UpdateNotifyUI();wp70CheckPWA();if(!silent)showNotification('Planet Intelligence обновлён');}catch(e){wp70Set('wp70SystemStatus','Не удалось обновить');wp70Set('wp70UpdatedAt',e.message);const cached=WP70.forecast;if(cached){wp70RenderStorm(cached);wp70RenderTimeline(cached);wp70RenderAI(cached);wp70RenderCalendar(cached);}if(!silent)showNotification(e.message,true);}finally{WP70.loading=false;}}
function wp70Init(){wp70UpdateNotifyUI();wp70CheckPWA();if(!WP70.notifyTimer)WP70.notifyTimer=setInterval(()=>{if(!document.hidden&&$('planet-page')?.classList.contains('active'))wp70Refresh(true);},20*60*1000);wp70Set('wp70CityLabel',lastWeatherData?.name||currentCity||'—');wp70Set('wp70NetworkState',navigator.onLine?'Online':'Offline');if(radarFrames.length){wp70Set('wp70RadarStatus',`Радар доступен · ${radarFrames.length} исторических кадров.`);wp70Set('wp70RadarTag',`${radarFrames.length} кадров · RainViewer`);}if(!WP70.forecast||Date.now()-WP70.forecastAt>10*60*1000)wp70Refresh();else{wp70RenderStorm();wp70RenderTimeline();wp70RenderAI();wp70RenderCalendar();}if(!WP70.network.length)wp70LoadNetwork(false).catch(()=>{});}
window.wp70Refresh=wp70Refresh;window.wp70RunStormHunter=async()=>{try{const data=await wp70FetchForecast();wp70RenderStorm(data);showNotification('Storm Hunter завершил анализ');}catch(e){showNotification(e.message,true);}};window.wp70LoadNetwork=wp70LoadNetwork;window.wp70LoadAnalytics=wp70LoadAnalytics;window.wp70ToggleNotifications=wp70ToggleNotifications;window.wp70RequestNotificationPermission=wp70RequestNotificationPermission;window.wp70ExportCalendar=wp70ExportCalendar;window.wp70CheckPWA=wp70CheckPWA;window.wp70AskAI=wp70AskAI;


/* ============================================================
   WEATHER PRO 8.0 — CLIMATE TWIN
   Real Open-Meteo data + locally checked forecast history.
   ============================================================ */
const WP80={module:'',grid:[],gridStale:false,air:null,airCoords:null,airStale:false,history:null,historyStale:false,heatMap:null,heatLayers:[],historyChart:null,accuracyChart:null,loading:{},lastCoords:null};
const WP80_ACTIVE_WEATHER_KEY='wp80_active_weather_v1';
const WP80_ACTIVE_LOCATION_KEY='wp80_active_location_v1';
function wp80Esc(s){return typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function wp80El(id){return document.getElementById(id);}
function wp80Status(text,ok=true){const e=wp80El('wp80Status');if(e)e.innerHTML=`<i class="fa-solid fa-circle" style="color:${ok?'#34d399':'#fbbf24'}"></i><span>${wp80Esc(text)}</span>`;}
function wp80ValidCoord(coord){
  if(!coord)return null;
  const lat=Number(coord.lat),lon=Number(coord.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;
}
function wp80ReadStoredWeather(){
  try{
    const saved=JSON.parse(localStorage.getItem(WP80_ACTIVE_WEATHER_KEY)||'null');
    if(saved?.weather?.coord?.lat!==undefined&&saved?.weather?.coord?.lon!==undefined){
      const coord=wp80ValidCoord(saved.weather.coord);
      if(coord){
        if(!wp80ValidCoord(lastWeatherData?.coord))lastWeatherData=saved.weather;
        if(!lastForecastData?.list?.length&&saved.forecast?.list?.length)lastForecastData=saved.forecast;
        return {weather:saved.weather,forecast:saved.forecast||null,coord,name:saved.location?.name||saved.weather.name||currentCity||'Активный город'};
      }
    }
  }catch(e){}
  try{
    const loc=JSON.parse(localStorage.getItem(WP80_ACTIVE_LOCATION_KEY)||'null'),coord=wp80ValidCoord(loc);
    if(coord)return {coord,name:loc.name||currentCity||'Активный город'};
  }catch(e){}
  return null;
}
function wp80RememberWeather(weather,forecast=null,cityHint=''){
  const coord=wp80ValidCoord(weather?.coord);if(!coord)return false;
  const name=String(weather?.name||cityHint||currentCity||'Активный город');
  const location={...coord,name,requestedCity:String(cityHint||currentCity||name),updatedAt:Date.now()};
  let previous=null;try{previous=JSON.parse(localStorage.getItem(WP80_ACTIVE_WEATHER_KEY)||'null');}catch(e){}
  const same=wp80ValidCoord(previous?.weather?.coord)&&Math.abs(Number(previous.weather.coord.lat)-coord.lat)<0.0001&&Math.abs(Number(previous.weather.coord.lon)-coord.lon)<0.0001;
  const nextForecast=forecast?.list?.length?forecast:(same?previous?.forecast||null:null);
  try{
    localStorage.setItem(WP80_ACTIVE_LOCATION_KEY,JSON.stringify(location));
    localStorage.setItem(WP80_ACTIVE_WEATHER_KEY,JSON.stringify({location,weather,forecast:nextForecast,updatedAt:Date.now()}));
  }catch(e){console.warn('[WeatherPro/AI] Не удалось сохранить активный город:',e);}
  return true;
}
function wp80Coords(){
  let weather=lastWeatherData;
  let coord=wp80ValidCoord(weather?.coord);
  if(coord)return {...coord,name:weather?.name||currentCity||'Активный город'};

  const cityKeys=[currentCity,localStorage.getItem(KEYS.LAST)].filter((v,i,a)=>v&&a.indexOf(v)===i);
  for(const city of cityKeys){
    const cached=cacheGet(city);
    if(cached?.current?.coord){
      const c=wp80ValidCoord(cached.current.coord);
      if(c){lastWeatherData=cached.current;if(cached.forecast)lastForecastData=cached.forecast;wp80RememberWeather(cached.current,cached.forecast,city);return {...c,name:cached.current.name||city};}
    }
  }
  // Search the cache by the API-returned city name as well; cache keys preserve the user's input casing.
  try{
    const all=loadCacheAll(),entries=Object.entries(all).sort((a,b)=>(b[1]?.ts||0)-(a[1]?.ts||0));
    const wanted=cityKeys.map(x=>String(x).trim().toLocaleLowerCase());
    for(const [key,entry] of entries){
      const w=entry?.data?.current,c=wp80ValidCoord(w?.coord);if(!c)continue;
      const names=[key,w?.name].filter(Boolean).map(x=>String(x).trim().toLocaleLowerCase());
      if(wanted.length&& !names.some(n=>wanted.includes(n)))continue;
      lastWeatherData=w;if(entry.data.forecast)lastForecastData=entry.data.forecast;wp80RememberWeather(w,entry.data.forecast,key);return {...c,name:w.name||key};
    }
  }catch(e){}
  const stored=wp80ReadStoredWeather();
  if(stored?.coord)return {...stored.coord,name:stored.name||currentCity||'Активный город'};
  return null;
}
async function wp80EnsureActiveWeather(){
  // Restore both coordinates and the weather payload needed by Personal Safety AI.
  wp80ReadStoredWeather();
  let coord=wp80Coords();
  if(coord&&lastWeatherData?.main)return coord;
  const city=String(currentCity||localStorage.getItem(KEYS.LAST)||currentUser?.defaultCity||'').trim();
  if(city&&typeof window.getWeather==='function'){
    wp80Status(`Обновляем погоду для ${city}…`,false);
    await window.getWeather(city);
    coord=wp80Coords();
    if(coord&&lastWeatherData?.main)return coord;
  }
  if(coord)return coord;
  throw new Error('Не удалось получить координаты активного города. Вернитесь на «Главную», выберите город и дождитесь загрузки погоды.');
}
function wp80Celsius(v){if(v==null||!Number.isFinite(Number(v)))return null;const u=settings?.units||'metric';return u==='imperial'?(Number(v)-32)*5/9:u==='standard'?Number(v)-273.15:Number(v);}
function wp80TempLabel(c){if(c===null||c===undefined||c===''||!Number.isFinite(Number(c)))return '—';const u=settings?.units||'metric';const n=u==='imperial'?Number(c)*9/5+32:Number(c);return `${n.toFixed(1)}°${u==='imperial'?'F':'C'}`;}
function wp80N(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;}
function wp80CurrentCity(){const c=wp80Coords();return c?.name||currentCity||'активном городе';}
function wp80OpenModule(id){
  const valid=['micro','heat','air','accuracy','safety','history'];if(!valid.includes(id))return;
  WP80.module=id;document.querySelectorAll('.wp80-card').forEach(b=>b.classList.toggle('active',b.dataset.module===id));
  const panel=wp80El('wp80ModulePanel');if(!panel)return;
  const titles={micro:'MicroClimate',heat:'City Heat Map',air:'Air Intelligence',accuracy:'Accuracy Lab',safety:'Personal Safety AI',history:'Climate History'};
  panel.innerHTML=`<div class="wp80-empty"><i class="fa-solid fa-spinner fa-spin"></i><br>Подготавливаем ${wp80Esc(titles[id])} и проверяем координаты города…</div>`;
  const loaders={micro:wp80LoadMicro,heat:wp80LoadHeat,air:wp80LoadAir,accuracy:wp80RenderAccuracy,safety:wp80LoadSafety,history:wp80LoadHistory};
  (async()=>{
    try{
      await wp80EnsureActiveWeather();
      await loaders[id]();
    }catch(e){
      console.error('[WeatherPro/AI] '+id,e);
      panel.innerHTML=`<div class="wp80-empty">Не удалось загрузить ${wp80Esc(titles[id])}: ${wp80Esc(e.message||e)}<br><button class="wp80-btn" style="margin-top:12px" onclick="wp80OpenModule('${id}')"><i class="fa-solid fa-rotate"></i> Повторить</button></div>`;
      wp80Status('Ошибка загрузки инструмента',false);
    }
  })();
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
window.wp80OpenModule=wp80OpenModule;
function wp80Init(){wp80Status(wp80Coords()?`Активен: ${wp80CurrentCity()}`:'Сначала загрузите город',!!wp80Coords());if(!WP80.module){const e=wp80El('wp80ModulePanel');if(e)e.innerHTML='<div class="wp80-empty"><i class="fa-solid fa-sparkles"></i><br>Выберите инструмент. Модули используют координаты активного города и реальные погодные данные.</div>';}}
function wp80Panel(title,subtitle,actions=''){return `<div class="wp80-panel-head"><div><h3>${wp80Esc(title)}</h3><p>${wp80Esc(subtitle)}</p></div><div class="wp80-actions">${actions}</div></div>`;}
function wp80NoCoords(){if(wp80Coords())return false;const p=wp80El('wp80ModulePanel');if(p)p.innerHTML=wp80Panel('Нужен активный город','Загрузите погоду на вкладке «Главная», чтобы получить координаты.')+'<div class="wp80-empty">После загрузки города вернитесь в AI и откройте инструмент ещё раз.</div>';wp80Status('Нет координат города',false);return true;}
async function wp80RequestJSON(url,label='Погодный сервис',attempts=3){
  let lastError=null;
  const retryable=[408,425,429,500,502,503,504];
  for(let attempt=0;attempt<=attempts;attempt++){
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok){
        let detail='';
        try{const body=await response.clone().json();detail=body?.reason||body?.message||'';}catch(e){}
        const error=new Error(`${label} HTTP ${response.status}${detail?`: ${detail}`:''}`);
        error.status=response.status;
        if(!retryable.includes(response.status)||attempt===attempts)throw error;
        lastError=error;
      }else{
        const data=await response.json();
        if(data?.error)throw new Error(`${label}: ${data.reason||'источник вернул ошибку'}`);
        return data;
      }
    }catch(error){
      lastError=error;
      if(error?.status&&!retryable.includes(error.status))throw error;
      if(attempt===attempts)throw error;
    }
    await new Promise(resolve=>setTimeout(resolve,650*Math.pow(2,attempt)));
  }
  throw lastError||new Error(`${label}: сервис временно недоступен`);
}
function wp80GridURL(c){
  const dLat=.08,dLon=.13,pts=[];
  const names=['Северо-запад','Север','Северо-восток','Запад','Центр','Восток','Юго-запад','Юг','Юго-восток'];
  for(let y=1;y>=-1;y--)for(let x=-1;x<=1;x++)pts.push({lat:c.lat+y*dLat,lon:c.lon+x*dLon,label:names[(y+1)*3+(x+1)],row:y,col:x});
  const q=new URLSearchParams({latitude:pts.map(p=>p.lat.toFixed(4)).join(','),longitude:pts.map(p=>p.lon.toFixed(4)).join(','),current:'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation',timezone:'auto'});
  return {url:'https://api.open-meteo.com/v1/forecast?'+q.toString(),pts};
}
async function wp80FetchGrid(force=false){
  const c=wp80Coords();if(!c)throw new Error('Нет координат активного города.');
  const key=`wp80_grid_${c.lat.toFixed(3)}_${c.lon.toFixed(3)}`;
  let stale=null;
  if(WP80.grid.length&&WP80.lastCoords===key)stale=WP80.grid;
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved?.data?.length){stale=saved.data;if(!force&&Date.now()-saved.ts<15*60*1000){WP80.grid=saved.data;WP80.lastCoords=key;WP80.gridAt=saved.ts;WP80.gridStale=false;return WP80.grid;}}
  }catch(e){}
  if(!force&&WP80.grid.length&&WP80.lastCoords===key&&WP80.gridAt>Date.now()-15*60*1000){WP80.gridStale=false;return WP80.grid;}
  const {url,pts}=wp80GridURL(c);
  try{
    const raw=await wp80RequestJSON(url,'Open-Meteo',3);
    const entries=Array.isArray(raw)?raw:[raw];
    if(!entries.length||entries.every(x=>!x?.current))throw new Error('Open-Meteo не вернул текущие значения для температурной сетки.');
    const fresh=pts.map((point,i)=>{const cur=entries[i]?.current||{};return {...point,temperature:wp80N(cur.temperature_2m),feels:wp80N(cur.apparent_temperature),humidity:wp80N(cur.relative_humidity_2m),wind:wp80N(cur.wind_speed_10m),precip:wp80N(cur.precipitation),time:cur.time||null};}).filter(x=>x.temperature!==null);
    if(!fresh.length)throw new Error('В ответе Open-Meteo нет температурных значений.');
    WP80.grid=fresh;WP80.lastCoords=key;WP80.gridAt=Date.now();WP80.gridStale=false;
    try{localStorage.setItem(key,JSON.stringify({ts:WP80.gridAt,data:WP80.grid}));}catch(e){}
    return WP80.grid;
  }catch(error){
    if(stale?.length){WP80.grid=stale;WP80.lastCoords=key;WP80.gridStale=true;return WP80.grid;}
    throw error;
  }
}
function wp80GridStats(){const v=WP80.grid.map(x=>x.temperature).filter(Number.isFinite);return {min:v.length?Math.min(...v):null,max:v.length?Math.max(...v):null,avg:v.length?v.reduce((a,b)=>a+b,0)/v.length:null,spread:v.length?Math.max(...v)-Math.min(...v):null};}
async function wp80LoadMicro(force=false){
  if(wp80NoCoords())return;const c=wp80Coords(),panel=wp80El('wp80ModulePanel');
  const grid=await wp80FetchGrid(force),s=wp80GridStats();
  panel.innerHTML=wp80Panel('MicroClimate · микроклимат','Сравнение модельных погодных точек вокруг активного города. Это не сеть уличных датчиков.',`<button class="wp80-btn" onclick="wp80LoadMicro(true)"><i class="fa-solid fa-rotate"></i> Обновить</button>`)+
    `<div class="wp80-metrics">${wp80Metric('Среднее по сетке',wp80TempLabel(s.avg),'9 модельных точек')}${wp80Metric('Минимум',wp80TempLabel(s.min),'в выборке')}${wp80Metric('Максимум',wp80TempLabel(s.max),'в выборке')}${wp80Metric('Разница',s.spread===null?'—':`${(settings?.units==='imperial'?s.spread*9/5:s.spread).toFixed(1)}°${settings?.units==='imperial'?'F':'C'}`,'между точками')}</div>`+
    `<div class="wp80-grid9">${grid.map(p=>`<div class="wp80-cell"><b>${wp80TempLabel(p.temperature)}</b><small>${wp80Esc(p.label)}</small></div>`).join('')}</div>`+
    `<div class="wp80-note">${WP80.gridStale?'Источник временно недоступен: показаны ранее сохранённые значения, они могут быть устаревшими. ':''}Город: ${wp80Esc(c.name)} · Open-Meteo Forecast API · ${wp80Esc(grid[0]?.time||'время не указано')}. Пространственное разрешение модели зависит от региона; соседние значения могут относиться к одной расчётной ячейке и не описывают конкретную улицу.</div>`;
  wp80Status(`Сетка загружена: ${c.name}`,true);
}
function wp80Metric(label,value,detail){return `<div class="wp80-metric"><small>${wp80Esc(label)}</small><strong>${wp80Esc(value)}</strong><span>${wp80Esc(detail)}</span></div>`;}
function wp80HeatColor(t){if(t<=0)return '#60a5fa';if(t<=7)return '#38bdf8';if(t<=14)return '#34d399';if(t<=20)return '#facc15';if(t<=27)return '#fb923c';return '#ef4444';}
async function wp80LoadHeat(force=false){
  if(wp80NoCoords())return;const c=wp80Coords(),panel=wp80El('wp80ModulePanel'),grid=await wp80FetchGrid(force),s=wp80GridStats();
  panel.innerHTML=wp80Panel('City Heat Map · температурная сетка','Расчётная карта температурных точек вокруг города. Не является спутниковой картой тепловых островов.',`<button class="wp80-btn" onclick="wp80LoadHeat(true)"><i class="fa-solid fa-rotate"></i> Обновить</button>`)+
    `<div class="wp80-metrics">${wp80Metric('Средняя температура',wp80TempLabel(s.avg),'по точкам сетки')}${wp80Metric('Разброс',s.spread===null?'—':`${(settings?.units==='imperial'?s.spread*9/5:s.spread).toFixed(1)}°${settings?.units==='imperial'?'F':'C'}`,'между модельными точками')}${wp80Metric('Точек',String(grid.length),'успешно получено')}${wp80Metric('Город',c.name,'активная локация')}</div><div id="wp80HeatMap" class="wp80-heatmap"></div><div class="wp80-legend"><span><i style="background:#60a5fa"></i> холоднее 0°C</span><span><i style="background:#38bdf8"></i> 0–7°C</span><span><i style="background:#34d399"></i> 7–14°C</span><span><i style="background:#facc15"></i> 14–20°C</span><span><i style="background:#fb923c"></i> 20–27°C</span><span><i style="background:#ef4444"></i> выше 27°C</span></div><div class="wp80-note">${WP80.gridStale?'Источник временно недоступен: карта построена по ранее сохранённым значениям, они могут быть устаревшими. ':''}Сетка построена на 9 координатных точках Open-Meteo с шагом около 9 км. Цвета интерполируются только внутри отображаемых ячеек; детальность не выше исходной погодной модели.</div>`;
  if(!window.L){wp80El('wp80HeatMap').innerHTML='<div class="wp80-empty">Библиотека карты Leaflet недоступна. Значения сетки показаны в MicroClimate.</div>';return;}
  if(WP80.heatMap){try{WP80.heatMap.remove();}catch(e){}WP80.heatMap=null;}
  const map=L.map('wp80HeatMap',{scrollWheelZoom:false}).setView([c.lat,c.lon],10);WP80.heatMap=map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
  const dLat=.04,dLon=.065,group=L.featureGroup();
  grid.forEach(p=>{const color=wp80HeatColor(p.temperature);L.rectangle([[p.lat-dLat,p.lon-dLon],[p.lat+dLat,p.lon+dLon]],{color,weight:1,fillColor:color,fillOpacity:.36}).bindPopup(`<b>${wp80Esc(p.label)}</b><br>${wp80TempLabel(p.temperature)}<br>Ощущается: ${wp80TempLabel(p.feels)}`).addTo(group);L.circleMarker([p.lat,p.lon],{radius:6,color:'#fff',weight:1,fillColor:color,fillOpacity:.95}).bindTooltip(`${wp80TempLabel(p.temperature)}`).addTo(group);});
  L.marker([c.lat,c.lon]).bindPopup(`<b>${wp80Esc(c.name)}</b><br>Центр города`).addTo(group);group.addTo(map);try{map.fitBounds(group.getBounds().pad(.08));}catch(e){}setTimeout(()=>map.invalidateSize(),160);wp80Status('Температурная карта готова',true);
}
async function wp80FetchAir(force=false){
  const c=wp80Coords();if(!c)throw new Error('Нет координат активного города.');
  const key=`wp80_air_${c.lat.toFixed(3)}_${c.lon.toFixed(3)}`;
  let stale=null;
  if(WP80.air&&WP80.airCoords===key)stale=WP80.air;
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.data){stale=saved.data;if(!force&&Date.now()-saved.ts<30*60*1000){WP80.air=saved.data;WP80.airAt=saved.ts;WP80.airCoords=key;WP80.airStale=false;return WP80.air;}}}catch(e){}
  const q=new URLSearchParams({latitude:c.lat,longitude:c.lon,current:'european_aqi,pm2_5,pm10,ozone,uv_index,birch_pollen,grass_pollen,ragweed_pollen',hourly:'european_aqi,pm2_5,pm10,uv_index,birch_pollen,grass_pollen,ragweed_pollen',forecast_days:'2',timezone:'auto'});
  try{
    const data=await wp80RequestJSON('https://air-quality-api.open-meteo.com/v1/air-quality?'+q.toString(),'Air Quality API',3);
    if(!data.current&&!data.hourly)throw new Error('Air Quality API не вернул данные.');
    WP80.air=data;WP80.airAt=Date.now();WP80.airCoords=key;WP80.airStale=false;
    try{localStorage.setItem(key,JSON.stringify({ts:WP80.airAt,data}));}catch(e){}
    return data;
  }catch(error){if(stale){WP80.air=stale;WP80.airCoords=key;WP80.airStale=true;return stale;}throw error;}
}
function wp80AqiLabel(v){if(v===null)return ['Нет данных','—'];if(v<=20)return ['Хорошее','good'];if(v<=40)return ['Удовлетворительное','fair'];if(v<=60)return ['Умеренное','moderate'];if(v<=80)return ['Плохое','poor'];if(v<=100)return ['Очень плохое','very-poor'];return ['Чрезвычайно плохое','extreme'];}
async function wp80LoadAir(force=false){
  if(wp80NoCoords())return;const c=wp80Coords(),panel=wp80El('wp80ModulePanel'),d=await wp80FetchAir(force),v=d.current||{};
  const aqi=wp80N(v.european_aqi),aqiText=wp80AqiLabel(aqi),read=(k,unit)=>wp80N(v[k])===null?'Нет данных':`${Number(v[k]).toFixed(1)} ${unit}`;
  const pollen=[['Берёза','birch_pollen'],['Травы','grass_pollen'],['Амброзия','ragweed_pollen']].map(([n,k])=>`<tr><td>${n}</td><td>${read(k,'зерна/м³')}</td></tr>`).join('');
  panel.innerHTML=wp80Panel('Air Intelligence · качество воздуха','Актуальные значения Open-Meteo Air Quality / CAMS. Пыльца может отсутствовать вне сезона или при неполном покрытии.',`<button class="wp80-btn" onclick="wp80LoadAir(true)"><i class="fa-solid fa-rotate"></i> Обновить</button>`)+
    `<div class="wp80-metrics">${wp80Metric('Европейский AQI',aqi===null?'—':aqi.toFixed(0),aqiText[0])}${wp80Metric('PM2.5',read('pm2_5','мкг/м³'),'мелкие частицы')}${wp80Metric('PM10',read('pm10','мкг/м³'),'взвешенные частицы')}${wp80Metric('UV Index',read('uv_index',''),'ультрафиолет')}</div><div class="wp80-note">${aqi===null?'Индекс качества воздуха сейчас не предоставлен.':`Категория AQI: ${aqiText[0]}. Индекс рассчитывается по европейской шкале.`} Местные датчики могут показывать отличающиеся значения.</div><h4 style="margin:15px 0 8px;font-size:12px">Пыльца</h4><table class="wp80-table"><thead><tr><th>Тип</th><th>Концентрация</th></tr></thead><tbody>${pollen}</tbody></table><p class="wp80-note" style="margin-top:10px">${WP80.airStale?'Air Quality API временно недоступен: показан сохранённый результат, он может быть устаревшим. ':''}Озон: ${read('ozone','мкг/м³')} · Время источника: ${wp80Esc(v.time||'не указано')} · ${wp80Esc(d.timezone||'локальное время')}. Данные основаны на моделях CAMS, не на домашнем датчике.</p>`;
  wp80Status(`Air Intelligence: ${c.name}`,aqi!==null);
}
function wp80AccuracyItems(){try{return JSON.parse(localStorage.getItem('wp80_accuracy_v1')||'[]').filter(x=>x&&x.city&&Number.isFinite(Number(x.target))&&Number.isFinite(Number(x.predicted)));}catch(e){return [];}}
function wp80SaveAccuracy(items){try{localStorage.setItem('wp80_accuracy_v1',JSON.stringify(items.slice(-500)));}catch(e){}}
function wp80CaptureAccuracy(current,forecast){
  if(!current?.coord||!current?.main||!Array.isArray(forecast?.list))return;
  const city=String(current.name||currentCity||'').toLowerCase(),actualTime=Number(current.dt||Math.floor(Date.now()/1000))*1000,actual=wp80Celsius(current.main.temp);if(!Number.isFinite(actual))return;
  const items=wp80AccuracyItems();
  items.forEach(x=>{if(x.city===city&&x.actual==null&&Math.abs(Number(x.target)-actualTime)<=90*60*1000&&Number(x.savedAt)<actualTime){x.actual=actual;x.actualAt=actualTime;x.error=Math.abs(actual-Number(x.predicted));}});
  forecast.list.slice(0,8).forEach(f=>{const target=Number(f.dt)*1000,predicted=wp80Celsius(f.main?.temp);if(!Number.isFinite(target)||!Number.isFinite(predicted)||target<=actualTime)return;const existing=items.find(x=>x.city===city&&Number(x.target)===target&&!x.actual);if(existing){existing.predicted=predicted;existing.savedAt=actualTime;}else items.push({city,target,predicted,savedAt:actualTime,actual:null});});
  wp80SaveAccuracy(items);
}
function wp80RenderAccuracy(){
  const p=wp80El('wp80ModulePanel');if(!p)return;
  const c=wp80Coords(),items=wp80AccuracyItems().filter(x=>!c||x.city===String(c.name).toLowerCase()).filter(x=>Number.isFinite(Number(x.actual))).sort((a,b)=>a.target-b.target).slice(-40);
  const mae=items.length?items.reduce((s,x)=>s+Math.abs(Number(x.actual)-Number(x.predicted)),0)/items.length:null;
  const avgBias=items.length?items.reduce((s,x)=>s+(Number(x.predicted)-Number(x.actual)),0)/items.length:null;
  p.innerHTML=wp80Panel('Weather Accuracy Lab · точность прогноза','Приложение сравнивает ранее сохранённые прогнозы активного погодного источника с фактической температурой при следующем обновлении. Работает только для периодов, когда приложение получало данные.',`<button class="wp80-btn" onclick="wp80RenderAccuracy()"><i class="fa-solid fa-rotate"></i> Пересчитать</button>`)+
    `<div class="wp80-metrics">${wp80Metric('Проверено прогнозов',String(items.length),'совпадение по времени ±90 мин')}${wp80Metric('Средняя ошибка',mae===null?'—':`${mae.toFixed(1)}°`,'MAE температуры')}${wp80Metric('Смещение',avgBias===null?'—':`${avgBias>0?'+':''}${avgBias.toFixed(1)}°`,avgBias===null?'нет данных':avgBias>0?'прогноз был теплее':'прогноз был холоднее')}${wp80Metric('Город',c?.name||'Все города','локальная история устройства')}</div>`+
    (items.length?'<div class="wp80-chart"><canvas id="wp80AccuracyChart"></canvas></div>':'<div class="wp80-empty">Проверенных прогнозов пока нет. Weather Pro будет сохранять следующие 24 часа прогноза и оценивать их после последующих обновлений погоды. Данные не загружаются в Firebase.</div>')+
    `<div class="wp80-note">Результат зависит от регулярности запусков приложения, временного совпадения и выбранного погодного источника. Это личная выборка, а не независимая сертификация точности метеомодели.</div>`;
  if(items.length&&window.Chart){try{WP80.accuracyChart?.destroy();}catch(e){}const ctx=wp80El('wp80AccuracyChart');WP80.accuracyChart=new Chart(ctx,{type:'line',data:{labels:items.map(x=>new Date(x.target).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})),datasets:[{label:'Прогноз',data:items.map(x=>x.predicted),borderColor:'#60a5fa',borderWidth:2,tension:.3,pointRadius:2},{label:'Факт',data:items.map(x=>x.actual),borderColor:'#34d399',borderWidth:2,tension:.3,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8',font:{size:10}}}},scales:{x:{ticks:{color:'#94a3b8',maxTicksLimit:8},grid:{color:'rgba(148,163,184,.07)'}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.07)'}}}}});}
  wp80Status(items.length?`Accuracy Lab: ${items.length} проверок`:'Накопление точности',!!items.length);
}
async function wp80LoadSafety(){
  if(wp80NoCoords())return;const p=wp80El('wp80ModulePanel'),c=wp80Coords();let air=null,airError='';try{air=await wp80FetchAir(false);}catch(e){airError=e.message;}
  const w=lastWeatherData,f=lastForecastData;if(!w?.main){p.innerHTML=wp80Panel('Personal Safety AI','Нет фактической погоды для активного города.')+'<div class="wp80-empty">Сначала обновите погоду на главной странице.</div>';return;}
  const temp=wp80Celsius(w.main.temp),wind=Number(w.wind?.speed||0)*(settings?.units==='imperial'?0.44704:settings?.units==='standard'?1:1),hum=Number(w.main.humidity||0),near=(f?.list||[]).filter(x=>Number(x.dt)*1000>Date.now()).slice(0,2),rainProb=Math.max(0,...near.map(x=>Number(x.pop||0)*100)),rainMm=Math.max(0,...near.map(x=>Number(x.rain?.['3h']||x.snow?.['3h']||0))),aqi=wp80N(air?.current?.european_aqi),uv=wp80N(air?.current?.uv_index);
  let score=100,risks=[];const add=(points,title,desc)=>{score=Math.max(0,score-points);risks.push({title,desc,points});};
  if(temp!==null&&temp>=35)add(28,'Сильная жара',`Температура около ${temp.toFixed(1)}°C. Снизьте физическую нагрузку и избегайте длительного пребывания на солнце.`);else if(temp!==null&&temp>=30)add(16,'Жаркая погода',`Температура около ${temp.toFixed(1)}°C. Пейте воду и планируйте активность в более прохладные часы.`);
  if(temp!==null&&temp<=-20)add(28,'Экстремальный холод',`Температура около ${temp.toFixed(1)}°C. Ограничьте долгое пребывание на улице.`);else if(temp!==null&&temp<=-10)add(16,'Холод',`Температура около ${temp.toFixed(1)}°C. Нужны тёплая одежда и защита открытых участков кожи.`);
  if(wind>=20)add(28,'Очень сильный ветер',`Скорость около ${wind.toFixed(1)} м/с. Избегайте открытых участков и неустойчивых конструкций.`);else if(wind>=12)add(15,'Сильный ветер',`Скорость около ${wind.toFixed(1)} м/с. Учитывайте порывы и условия на открытых местах.`);
  if(rainProb>=80||rainMm>=5)add(17,'Вероятны интенсивные осадки',`В ближайших 6 часах вероятность осадков до ${Math.round(rainProb)}%, модельное количество до ${rainMm.toFixed(1)} мм за 3 часа.`);else if(rainProb>=55)add(9,'Возможен дождь',`Вероятность осадков в ближайших часах до ${Math.round(rainProb)}%.`);
  if(aqi!==null&&aqi>80)add(18,'Низкое качество воздуха',`Европейский AQI около ${aqi.toFixed(0)}. При ухудшении самочувствия сократите интенсивные нагрузки на улице.`);else if(aqi!==null&&aqi>60)add(10,'Повышенный AQI',`Европейский AQI около ${aqi.toFixed(0)}. Людям с чувствительностью к загрязнению стоит следить за самочувствием.`);
  if(uv!==null&&uv>=8)add(12,'Очень высокий UV Index',`UV Index около ${uv.toFixed(1)}. Ищите тень и используйте защиту от солнца.`);else if(uv!==null&&uv>=6)add(7,'Высокий UV Index',`UV Index около ${uv.toFixed(1)}. Учитывайте солнечную нагрузку.`);
  if(!risks.length)risks.push({title:'Сильные пороговые факторы не обнаружены',desc:'В доступных данных не выявлены значения, превышающие встроенные пороги этого индекса. Проверяйте официальные предупреждения.',points:0});
  const label=score>=85?'Низкий погодный риск':score>=65?'Умеренные ограничения':score>=40?'Повышенная осторожность':'Высокий погодный риск';
  p.innerHTML=wp80Panel('Personal Safety AI · индекс погодной безопасности','Прозрачная эвристика по текущей погоде, ближайшему прогнозу и доступному AQI/UV. Не является медицинской оценкой или официальным предупреждением.',`<button class="wp80-btn" onclick="wp80LoadSafety()"><i class="fa-solid fa-rotate"></i> Пересчитать</button>`)+
    `<div class="wp80-metrics">${wp80Metric('Индекс',`${score}/100`,label)}${wp80Metric('Температура',temp===null?'—':`${temp.toFixed(1)}°C`,'пересчёт в °C')}${wp80Metric('Ветер',`${wind.toFixed(1)} м/с`,'текущая скорость')}${wp80Metric('Дождь',`${Math.round(rainProb)}%`,'макс. вероятность в ближайших 6 ч')}</div><div class="wp80-risk-list">${risks.map(x=>`<div class="wp80-risk"><i class="fa-solid ${x.points>=16?'fa-triangle-exclamation':'fa-circle-info'}"></i><div><strong>${wp80Esc(x.title)}</strong><p>${wp80Esc(x.desc)}</p></div></div>`).join('')}</div><div class="wp80-note">Город: ${wp80Esc(c.name)} · Влажность ${hum}% · ${aqi===null?'AQI недоступен':`AQI ${aqi.toFixed(0)}`} · ${uv===null?'UV недоступен':`UV ${uv.toFixed(1)}`} ${airError?`· Дополнительный источник: ${wp80Esc(airError)}`:''}. Индекс — ориентир планирования, не гарантия безопасности; всегда проверяйте MeteoAlarm и местную метеослужбу.</div>`;
  wp80Status(`Safety AI: ${score}/100`,score>=65);
}
async function wp80LoadHistory(force=false){
  if(wp80NoCoords())return;const c=wp80Coords(),p=wp80El('wp80ModulePanel'),key=`wp80_history_${c.lat.toFixed(3)}_${c.lon.toFixed(3)}`;
  let data=null,stale=null;try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.data?.daily?.time?.length){stale=saved.data;if(!force&&Date.now()-saved.ts<24*60*60*1000)data=saved.data;}}catch(e){}
  WP80.historyStale=false;
  if(!data){const end=new Date();end.setDate(end.getDate()-7);const start=new Date(end);start.setFullYear(start.getFullYear()-10);const iso=d=>d.toISOString().slice(0,10);const q=new URLSearchParams({latitude:c.lat,longitude:c.lon,start_date:iso(start),end_date:iso(end),daily:'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum',timezone:'auto'});try{data=await wp80RequestJSON('https://archive-api.open-meteo.com/v1/archive?'+q.toString(),'Historical Weather API',3);if(!data.daily?.time?.length)throw new Error('Архив не вернул ежедневные значения.');try{localStorage.setItem(key,JSON.stringify({ts:Date.now(),data}));}catch(e){}}catch(error){if(stale){data=stale;WP80.historyStale=true;}else throw error;}}
  WP80.history=data;const d=data.daily,years={};(d.time||[]).forEach((day,i)=>{const y=day.slice(0,4),t=wp80N(d.temperature_2m_mean?.[i]),rain=wp80N(d.precipitation_sum?.[i]);if(!years[y])years[y]={temps:[],rain:0,rainDays:0,days:0};const o=years[y];if(t!==null)o.temps.push(t);if(rain!==null){o.rain+=rain;if(rain>.1)o.rainDays++;}o.days++;});
  const rows=Object.entries(years).map(([year,o])=>({year,temp:o.temps.length?o.temps.reduce((a,b)=>a+b,0)/o.temps.length:null,rain:o.rain,days:o.days})).filter(x=>x.temp!==null).sort((a,b)=>a.year.localeCompare(b.year));
  p.innerHTML=wp80Panel('Climate History · климатический архив','Десятилетний архив реаналитических данных для расчётной ячейки активного города. Это не показания местной метеостанции.',`<button class="wp80-btn" onclick="wp80LoadHistory(true)"><i class="fa-solid fa-rotate"></i> Обновить архив</button>`)+
    `<div class="wp80-metrics">${wp80Metric('Лет в архиве',String(rows.length),'по годовым данным')}${wp80Metric('Последний год',rows.at(-1)?.year||'—','доступный ряд')}${wp80Metric('Средняя температура',rows.length?`${(rows.reduce((s,x)=>s+x.temp,0)/rows.length).toFixed(1)}°C`:'—','среднее годовых значений')}${wp80Metric('Период',`${d.time[0]} — ${d.time.at(-1)}`,'дата архивных данных')}</div><div class="wp80-chart"><canvas id="wp80HistoryChart"></canvas></div><table class="wp80-table"><thead><tr><th>Год</th><th>Средняя t°</th><th>Осадки</th><th>Дней</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.year}</td><td>${x.temp.toFixed(1)}°C</td><td>${x.rain.toFixed(0)} мм</td><td>${x.days}</td></tr>`).join('')}</tbody></table><div class="wp80-note" style="margin-top:10px">${WP80.historyStale?'Historical Weather API временно недоступен: показан ранее сохранённый архив. ':''}Источник: Open-Meteo Historical Weather API. Реанализ объединяет наблюдения и модели; разрешение и характеристики набора зависят от периода. Годовые средние показывают изменение погодного ряда в выбранной ячейке, но не заменяют климатическое исследование с корректировкой станционных данных.</div>`;
  if(window.Chart){try{WP80.historyChart?.destroy();}catch(e){}WP80.historyChart=new Chart(wp80El('wp80HistoryChart'),{type:'line',data:{labels:rows.map(x=>x.year),datasets:[{label:'Средняя годовая температура',data:rows.map(x=>Number(x.temp.toFixed(2))),borderColor:'#60a5fa',backgroundColor:'rgba(96,165,250,.12)',fill:true,borderWidth:2,tension:.28,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8',font:{size:10}}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.07)'}},y:{ticks:{color:'#94a3b8',callback:v=>v+'°C'},grid:{color:'rgba(148,163,184,.07)'}}}}});}
  wp80Status(`Climate History: ${rows.length} лет`,!!rows.length);
}


setLang('ru');
try{wp6LoadStudio();}catch(e){}
window.addEventListener('online',()=>{wp6RunDiagnostics?.();});
window.addEventListener('offline',()=>{wp6RunDiagnostics?.();});
console.log('%cWeather Pro v9.0 — INTERFACE ARCHITECTURE','color:#3b82f6;font-weight:800;font-size:14px');

