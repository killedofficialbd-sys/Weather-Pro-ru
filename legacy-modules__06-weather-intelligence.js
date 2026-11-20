/* Weather Pro V16 module: 06-weather-intelligence.js — extracted from the existing app script. */
/* ============================================================
   WEATHER PRO 5.0 — PLANNER / ROUTES / ACTIVITIES / ALERTS / AI
   ============================================================ */
const WP5_ACTIVITY_PROFILES=[
  {id:'walk',name:'Прогулка',icon:'fa-person-walking',desc:'Комфортная температура, небольшой ветер и низкий риск осадков.',temp:[8,24],wind:9,rain:30,humid:88},
  {id:'run',name:'Бег',icon:'fa-person-running',desc:'Умеренная температура и ветер, без сильного дождя.',temp:[5,20],wind:8,rain:25,humid:82},
  {id:'cycle',name:'Велосипед',icon:'fa-person-biking',desc:'Сухая погода, слабый ветер и хорошая видимость.',temp:[10,25],wind:7,rain:18,humid:80},
  {id:'picnic',name:'Пикник',icon:'fa-basket-shopping',desc:'Тепло, мало осадков и умеренный ветер.',temp:[17,29],wind:6,rain:12,humid:78},
  {id:'beach',name:'Пляж',icon:'fa-umbrella-beach',desc:'Тёплая погода и низкая вероятность дождя; температура воды не учитывается.',temp:[23,34],wind:7,rain:12,humid:78},
  {id:'fishing',name:'Рыбалка',icon:'fa-fish-fins',desc:'Умеренный ветер и отсутствие сильных осадков.',temp:[6,25],wind:6,rain:25,humid:95},
  {id:'dog',name:'Прогулка с собакой',icon:'fa-dog',desc:'Условия без экстремальной жары, холода и сильного ветра.',temp:[3,24],wind:10,rain:35,humid:90},
  {id:'travel',name:'Поездка',icon:'fa-car-side',desc:'Погодный комфорт и отсутствие выраженных осадков.',temp:[-5,28],wind:13,rain:40,humid:95},
  {id:'garden',name:'Работы на улице',icon:'fa-seedling',desc:'Сухое окно без сильного ветра и экстремальных температур.',temp:[10,27],wind:7,rain:15,humid:90}
];
let wp5RouteMap=null, wp5RouteLayer=null, wp5RouteMarkers=null, wp5LastRoute=null;
function wp5TempC(v){return (settings.units||'metric')==='metric'?Number(v):((Number(v)-32)*5/9);}
function wp5WindMs(v){return (settings.units||'metric')==='metric'?Number(v):Number(v)/2.237;}
function wp5ScoreClass(v){return v>=75?'':(v>=50?'mid':'low');}
function wp5WeatherGlyph(main,description=''){
  const t=String(main+' '+description).toLowerCase();
  if(/thunder|гроза|lightning/.test(t))return wp5FaIcon('fa-cloud-bolt');
  if(/snow|снег|sleet/.test(t))return wp5FaIcon('fa-snowflake');
  if(/rain|drizzle|дожд|лив/.test(t))return wp5FaIcon('fa-cloud-rain');
  if(/clear|ясно|sun/.test(t))return wp5FaIcon('fa-sun');
  if(/cloud|облач|пасмур/.test(t))return wp5FaIcon('fa-cloud');
  if(/mist|fog|туман/.test(t))return wp5FaIcon('fa-smog');
  return wp5FaIcon('fa-cloud-sun');
}
function wp5ScoreSlot(item,profile=null){
  if(!item||!item.main)return 0;
  const metric=(settings.units||'metric')==='metric';
  const temp=wp5TempC(item.main.feels_like??item.main.temp);
  const wind=wp5WindMs(item.wind?.speed||0);
  const rain=Math.max((item.pop||0)*100,Number(item.rain?.['3h']||0)*18);
  const humidity=Number(item.main.humidity||50);
  let score=100;
  const low=profile?.temp?.[0]??17, high=profile?.temp?.[1]??23;
  const tempPenalty=temp<low?Math.min(38,(low-temp)*2.8):temp>high?Math.min(38,(temp-high)*3.0):0;
  score-=tempPenalty;
  const windLimit=profile?.wind??8;
  score-=Math.max(0,wind-windLimit)*4.5;
  const rainLimit=profile?.rain??22;
  score-=Math.max(0,rain-rainLimit)*0.55;
  if(humidity>(profile?.humid??82))score-=(humidity-(profile?.humid??82))*0.22;
  const main=String(item.weather?.[0]?.main||'').toLowerCase();
  if(/thunder/.test(main))score-=30; else if(/snow/.test(main))score-=profile?.id==='travel'?15:10;
  return Math.max(0,Math.min(100,Math.round(score)));
}
function wp5ForecastItems(hours=24){
  if(!lastForecastData?.list)return [];
  const end=Date.now()+hours*3600000;
  return lastForecastData.list.filter(x=>x.dt*1000>=Date.now()-3600000 && x.dt*1000<=end);
}
function wp5TimeLabel(ts,withDay=false){return new Date(ts*1000).toLocaleString('ru-RU',withDay?{weekday:'short',hour:'2-digit',minute:'2-digit'}:{hour:'2-digit',minute:'2-digit'});}
function renderSmartPlanner(){
  const hours=Number($('plannerHorizon')?.value||24),items=wp5ForecastItems(hours),grid=$('plannerBestWindows'),timeline=$('plannerTimeline');
  if(!grid||!timeline)return;
  if(!lastWeatherData||!items.length){grid.innerHTML='<div class="wp5-empty">Почасовой прогноз отсутствует. Обновите погоду на главной странице при подключении к интернету.</div>';timeline.innerHTML='';$('plannerBestScore').textContent='—';return;}
  const scored=items.map(item=>({item,score:wp5ScoreSlot(item)}));
  const top=[...scored].sort((a,b)=>b.score-a.score).slice(0,3);
  $('plannerBestScore').textContent=top[0]?.score??'—';
  grid.innerHTML=top.map((x,i)=>{
    const item=x.item,temp=Math.round(item.main.temp),rain=Math.round((item.pop||0)*100),wind=Math.round(wp5WindMs(item.wind?.speed||0)*10)/10;
    const d=new Date(item.dt*1000),end=new Date(item.dt*1000+3*3600000);
    return `<article class="wp5-window-card"><div class="wp5-window-top"><span class="wp5-window-time">${i===0?'Лучшее окно':i===1?'Альтернатива':'Ещё вариант'} · ${d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}–${end.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span><b class="wp5-score ${wp5ScoreClass(x.score)}">${x.score}/100</b></div><div class="wp5-window-meta"><span>${wp5WeatherGlyph(item.weather?.[0]?.main,item.weather?.[0]?.description)} ${temp}${(settings.units||'metric')==='metric'?'°C':'°F'}</span><span>${wp5FaIcon('fa-umbrella')} ${rain}%</span><span>${wp5FaIcon('fa-wind')} ${wind} м/с</span></div></article>`;
  }).join('');
  timeline.innerHTML=scored.slice(0,Math.min(items.length,16)).map((x,i)=>{
    const d=new Date(x.item.dt*1000),temp=Math.round(x.item.main.temp),rain=Math.round((x.item.pop||0)*100);
    return `<div class="wp5-hour-slot ${x.item.dt===top[0]?.item.dt?'best':''}"><time>${d.toLocaleDateString('ru-RU',{weekday:'short'})} ${d.toLocaleTimeString('ru-RU',{hour:'2-digit'})}</time><strong>${temp}°</strong><small>${x.score}/100 · ${wp5FaIcon('fa-umbrella')} ${rain}%</small></div>`;
  }).join('');
  const best=top[0]?.item,desc=best?.weather?.[0]?.description||'умеренные условия';
  const rainMax=Math.max(...items.map(x=>(x.pop||0)*100));
  const advice=[];
  if(rainMax>45)advice.push('В течение выбранного периода возможны осадки — держите под рукой зонт.');
  if(items.some(x=>wp5WindMs(x.wind?.speed||0)>10))advice.push('В отдельные часы ожидается заметный ветер. Для велосипеда выбирайте более спокойное окно.');
  if(best)advice.push(`Оптимальный старт по текущей модели — около ${wp5TimeLabel(best.dt)} (${desc}).`);
  $('plannerAdvice').innerHTML=advice.map(x=>`<div class="wp5-advice-chip">${esc(x)}</div>`).join('');
  const home=$('wp5HomeSummary');if(home&&best)home.textContent=`Лучшее окно для дел на улице: ${wp5TimeLabel(best.dt)} · индекс комфорта ${top[0].score}/100. Можно также проверить погоду вдоль маршрута.`;
}
function renderActivityScores(){
  const grid=$('activityGrid');if(!grid)return;
  const items=wp5ForecastItems(24);if(!items.length||!lastWeatherData){grid.innerHTML='<div class="wp5-empty">Загрузите прогноз на главной странице, чтобы рассчитать индексы.</div>';return;}
  grid.innerHTML=WP5_ACTIVITY_PROFILES.map(profile=>{
    const ranked=items.map(item=>({item,score:wp5ScoreSlot(item,profile)})).sort((a,b)=>b.score-a.score);
    const now=ranked[0],score=now?.score??0;
    const time=now?wp5TimeLabel(now.item.dt):'—';
    const cls=wp5ScoreClass(score);
    const status=score>=80?'Отличные условия':score>=60?'В целом подходит':score>=40?'С компромиссами':'Лучше выбрать другое время';
    return `<article class="wp5-activity-card"><div class="wp5-activity-head"><div class="wp5-activity-icon">${wp5FaIcon(profile.icon)}</div><div><h3>${profile.name}</h3><div class="wp5-activity-scoreline"><strong class="${cls}">${score}</strong><span>/ 100</span></div></div></div><div class="wp5-progress"><i style="width:${score}%"></i></div><p><strong>${status}.</strong> Лучшее время: ${time}. ${profile.desc}</p></article>`;
  }).join('');
}
function refreshSmartModules(current=lastWeatherData,forecast=lastForecastData){
  if(current&&forecast){renderSmartPlanner();renderActivityScores();}
  if(typeof wp11RenderCommandCenter==='function') wp11RenderCommandCenter(current,forecast);
  if($('smart-alerts-page')?.classList.contains('active')&&current&&forecast)evaluateSmartWeatherAlerts(current,forecast);
  if(typeof wp6RefreshWeather==='function') wp6RefreshWeather(current,forecast);
}
function wp5GeocodeTime(date,timezone){
  try{return new Intl.DateTimeFormat('sv-SE',{timeZone:timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');}
  catch(e){return date.toISOString().slice(0,16);}
}
async function wp5Geocode(place){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=ru&format=json`;
  const r=await fetch(url);if(!r.ok)throw new Error('Не удалось выполнить поиск места');
  const d=await r.json();if(!d.results?.length)throw new Error(`Место «${place}» не найдено`);
  return d.results[0];
}
function wp5InitRouteMap(){
  const el=$('routeMap');if(!el||!window.L)return;
  if(!wp5RouteMap){wp5RouteMap=L.map(el,{zoomControl:true}).setView([59.437,24.7536],7);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(wp5RouteMap);}
  setTimeout(()=>wp5RouteMap?.invalidateSize(),120);
}
async function analyzeWeatherRoute(){
  const origin=$('routeOrigin')?.value.trim(),destination=$('routeDestination')?.value.trim(),departValue=$('routeDeparture')?.value;
  const status=$('routeStatus'),btn=$('routeAnalyzeBtn'),summary=$('routeSummary'),pointsBox=$('routeWeatherPoints'),riskBox=$('routeRisk');
  if(!origin||!destination){showNotification('Укажите начало и конец маршрута',true);return;}
  if(origin.toLowerCase()===destination.toLowerCase()){showNotification('Начало и конец маршрута должны различаться',true);return;}
  const depart=departValue?new Date(departValue):new Date(Date.now()+30*60000);
  if(Number.isNaN(depart.getTime())){showNotification('Проверьте время выезда',true);return;}
  btn.disabled=true;btn.textContent='Анализирую…';status.textContent='Ищу точки маршрута и строю дорожный путь…';summary.innerHTML='';pointsBox.innerHTML='';riskBox.innerHTML='';
  try{
    const [a,b]=await Promise.all([wp5Geocode(origin),wp5Geocode(destination)]);
    const routeUrl=`https://router.project-osrm.org/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson&steps=false`;
    const rr=await fetch(routeUrl);if(!rr.ok)throw new Error('Сервис маршрутизации временно недоступен');
    const rd=await rr.json();const route=rd.routes?.[0];if(!route)throw new Error('Не удалось построить автомобильный маршрут');
    const coords=route.geometry.coordinates,indices=[0,Math.floor((coords.length-1)/2),coords.length-1];
    const samples=indices.map((idx,i)=>{const c=coords[idx];return {id:i,longitude:c[0],latitude:c[1],label:['Старт','По пути','Прибытие'][i],fraction:[0,.5,1][i]};});
    status.textContent='Маршрут построен. Получаю погодные условия по трём контрольным точкам…';
    const durationMs=route.duration*1000;
    const targets=samples.map(point=>new Date(depart.getTime()+durationMs*point.fraction));
    const weatherQuery=new URLSearchParams({
      latitude:samples.map(point=>point.latitude.toFixed(5)).join(','),
      longitude:samples.map(point=>point.longitude.toFixed(5)).join(','),
      hourly:'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,weather_code',
      forecast_days:'16',timezone:samples.map(()=>'auto').join(','),wind_speed_unit:'ms'
    });
    status.textContent='Получаю общий прогноз сразу для трёх контрольных точек…';
    let forecastEntries=[],forecastError=null;
    try{
      const forecastData=await wp80RequestJSON('https://api.open-meteo.com/v1/forecast?'+weatherQuery.toString(),'Прогноз по маршруту',3);
      forecastEntries=Array.isArray(forecastData)?forecastData:[forecastData];
    }catch(error){forecastError=error;console.warn('[WeatherPro/Routes] forecast unavailable:',error);}
    const weatherPoints=samples.map((point,index)=>{
      const wd=forecastEntries[index],target=targets[index];
      if(!wd?.hourly?.time?.length)return {...point,time:null,timezone:wd?.timezone||null,temp:null,feels:null,rain:null,mm:null,wind:null,code:null,available:false};
      const times=wd.hourly.time,targetLocal=wp5GeocodeTime(target,wd.timezone);
      let bestIdx=0,bestDelta=Infinity;
      for(let i=0;i<times.length;i++){const delta=Math.abs(Date.parse(times[i])-Date.parse(targetLocal));if(delta<bestDelta){bestDelta=delta;bestIdx=i;}}
      if(bestDelta>90*60*1000)return {...point,time:targetLocal,timezone:wd.timezone,temp:null,feels:null,rain:null,mm:null,wind:null,code:null,available:false};
      const read=k=>wd.hourly?.[k]?.[bestIdx];
      const temp=read('temperature_2m');
      if(temp===undefined||temp===null)return {...point,time:targetLocal,timezone:wd.timezone,temp:null,feels:null,rain:null,mm:null,wind:null,code:null,available:false};
      return {...point,time:targetLocal,timezone:wd.timezone,temp,feels:read('apparent_temperature'),rain:read('precipitation_probability'),mm:read('precipitation'),wind:read('wind_speed_10m'),code:read('weather_code'),available:true};
    });
    const distance=route.distance/1000,durationHours=route.duration/3600,arrival=new Date(depart.getTime()+durationMs),arrivalZone=weatherPoints[2]?.timezone||b.timezone||'UTC';
    const arrivalTime=new Intl.DateTimeFormat('ru-RU',{timeZone:arrivalZone,hour:'2-digit',minute:'2-digit'}).format(arrival),arrivalDate=new Intl.DateTimeFormat('ru-RU',{timeZone:arrivalZone,day:'numeric',month:'short'}).format(arrival);
    summary.innerHTML=`<div class="wp5-route-metric"><strong>${distance.toFixed(1)} км</strong><small>Длина маршрута</small></div><div class="wp5-route-metric"><strong>${Math.floor(durationHours)} ч ${Math.round((durationHours%1)*60)} мин</strong><small>Оценка времени в пути</small></div><div class="wp5-route-metric"><strong>${arrivalTime}</strong><small>Прибытие · ${arrivalDate} · местное время</small></div>`;
    pointsBox.innerHTML=weatherPoints.map(p=>{
      const localTime=p.time?String(p.time).slice(11,16):'—',temp=p.available&&Number.isFinite(Number(p.temp))?Math.round(Number(p.temp)):'—';
      const danger=p.available&&(Number(p.rain)>=60||Number(p.wind)>=12||Number(p.code)>=95||(Number(p.temp)<=0&&Number(p.mm)>=0.5));
      return `<article class="wp5-route-point"><h3>${p.label} · ${localTime}</h3><div class="wp5-route-temp">${p.available?wp5WeatherGlyph(p.code>=95?'Thunderstorm':p.code>=70?'Snow':p.code>=51?'Rain':p.code===0?'Clear':'Clouds'):'<i class="fa-solid fa-cloud"></i>'} ${temp}${p.available?'°C':''}</div><p>${p.available?`Ощущается: ${Number.isFinite(Number(p.feels))?Math.round(Number(p.feels))+'°C':'—'}<br>Осадки: ${Number.isFinite(Number(p.rain))?Math.round(Number(p.rain))+'%':'—'} · ${Number.isFinite(Number(p.mm))?Number(p.mm).toFixed(1)+' мм':'—'}<br>Ветер: ${Number.isFinite(Number(p.wind))?Number(p.wind).toFixed(1)+' м/с':'—'}<br>${esc(p.timezone||'местное время')}`:'Прогноз для этой точки сейчас недоступен.'}</p><span class="wp5-risk-tag ${p.available?(danger?'':'good'):''}">${p.available?(danger?'Проверьте условия':'Без выраженного риска'):'Нет данных прогноза'}</span></article>`;
    }).join('');
    const risks=[];
    weatherPoints.forEach(p=>{if(p.rain>=60)risks.push(`${p.label}: вероятность осадков ${Math.round(p.rain)}%`);if(p.wind>=12)risks.push(`${p.label}: сильный ветер ${Number(p.wind).toFixed(1)} м/с`);if(p.code>=95)risks.push(`${p.label}: прогнозируется гроза`);if(p.code>=71&&p.code<=77)risks.push(`${p.label}: ожидается снег`);if(Number(p.temp)<=0&&Number(p.mm)>=0.5)risks.push(`${p.label}: осадки при температуре около/ниже 0°C — возможна скользкая поверхность`);});
    riskBox.innerHTML=risks.length?`<strong>На что обратить внимание:</strong><br>${risks.map(x=>`<span class="wp5-risk-tag">${esc(x)}</span>`).join('')}`:weatherPoints.every(p=>p.available)?'<span class="wp5-risk-tag good">По выбранным контрольным точкам выраженных погодных рисков не обнаружено</span><p>Прогноз по контрольным точкам не заменяет оперативную дорожную информацию.</p>':`<span class="wp5-risk-tag">Часть погодных данных недоступна. Оценка рисков неполная.</span><p>${esc(forecastError?.message||'Для отдельных временных точек нет данных в горизонте прогноза.')}</p>`;
    wp5LastRoute={origin:a,destination:b,route,weatherPoints,depart};
    $('routeMap').classList.add('ready');
    wp5InitRouteMap();
    if(wp5RouteMap){
      if(wp5RouteLayer){wp5RouteMap.removeLayer(wp5RouteLayer);wp5RouteLayer=null;}
      if(wp5RouteMarkers){wp5RouteMap.removeLayer(wp5RouteMarkers);wp5RouteMarkers=null;}
      const latlngs=coords.map(c=>[c[1],c[0]]);wp5RouteLayer=L.polyline(latlngs,{color:'#60a5fa',weight:5,opacity:.9}).addTo(wp5RouteMap);
      wp5RouteMarkers=L.layerGroup([L.marker([a.latitude,a.longitude]).bindPopup(esc(a.name||origin)),L.marker([b.latitude,b.longitude]).bindPopup(esc(b.name||destination))]).addTo(wp5RouteMap);
      wp5RouteMap.fitBounds(wp5RouteLayer.getBounds(),{padding:[24,24]});
    }
    status.textContent=`Маршрут ${a.name||origin} → ${b.name||destination}. ${weatherPoints.every(p=>p.available)?'Погода рассчитана для трёх контрольных точек.':`Маршрут построен, но прогноз доступен только для ${weatherPoints.filter(p=>p.available).length} из 3 точек.`}`;
  }catch(error){console.error('[WeatherPro/Routes]',error);status.textContent=error.message||'Не удалось проанализировать маршрут. Проверьте подключение и названия мест.';showNotification('Ошибка анализа маршрута',true);}
  finally{btn.disabled=false;btn.textContent='Проверить маршрут';}
}
window.analyzeWeatherRoute=analyzeWeatherRoute;
function wp5DefaultRouteTime(){const d=new Date(Date.now()+30*60000);d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);if($('routeDeparture')&&!$('routeDeparture').value)$('routeDeparture').value=local;if($('routeOrigin')&&!$('routeOrigin').value)$('routeOrigin').value=currentCity||'Tallinn';}
function getSmartAlertPrefs(){
  const defaults={rain:true,wind:true,cold:true,heat:true,storm:true,snow:true,rainThreshold:55,windThreshold:12,coldThreshold:0,heatThreshold:30};
  let saved={};
  if(fbUser){saved=settings.smartAlerts||{};}
  else{try{saved=JSON.parse(localStorage.getItem('wp_smart_alerts')||'{}')||{};}catch(e){saved={};}}
  return Object.assign(defaults,saved);
}
function syncSmartAlertControls(){
  const p=getSmartAlertPrefs();
  const set=(id,value)=>{const el=$(id);if(el)el.type==='checkbox'?el.checked=!!value:el.value=value;};
  set('wpAlertRain',p.rain);set('wpAlertWind',p.wind);set('wpAlertCold',p.cold);
  set('alertPrefRain',p.rain);set('alertPrefWind',p.wind);set('alertPrefCold',p.cold);set('alertPrefHeat',p.heat);set('alertPrefStorm',p.storm);set('alertPrefSnow',p.snow);
  set('alertRainThreshold',p.rainThreshold);set('alertWindThreshold',p.windThreshold);set('alertColdThreshold',p.coldThreshold);set('alertHeatThreshold',p.heatThreshold);
  set('alertBrowserToggle',!!settings.browserNotifications);
}
function saveSmartAlertSettings(){
  const old=getSmartAlertPrefs();
  const checked=(id,fallback)=>$(id)?!!$(id).checked:fallback;
  const number=(id,fallback,min,max)=>$(id)?Math.max(min,Math.min(max,Number($(id).value)||fallback)):fallback;
  const fullSettings=$('smart-alerts-page')?.classList.contains('active');
  const prefs={
    rain:fullSettings?checked('alertPrefRain',old.rain):checked('wpAlertRain',old.rain),
    wind:fullSettings?checked('alertPrefWind',old.wind):checked('wpAlertWind',old.wind),
    cold:fullSettings?checked('alertPrefCold',old.cold):checked('wpAlertCold',old.cold),
    heat:fullSettings?checked('alertPrefHeat',old.heat):old.heat,
    storm:fullSettings?checked('alertPrefStorm',old.storm):old.storm,
    snow:fullSettings?checked('alertPrefSnow',old.snow):old.snow,
    rainThreshold:number('alertRainThreshold',old.rainThreshold,10,100),windThreshold:number('alertWindThreshold',old.windThreshold,3,40),coldThreshold:number('alertColdThreshold',old.coldThreshold,-50,15),heatThreshold:number('alertHeatThreshold',old.heatThreshold,20,55)
  };
  localStorage.setItem('wp_smart_alerts',JSON.stringify(prefs));
  settings.smartAlerts=prefs;
  saveSettingsSilent();
  if($('alertBrowserToggle')){settings.browserNotifications=$('alertBrowserToggle').checked;$('browserNotifications').checked=settings.browserNotifications;saveSettingsSilent();}
  syncSmartAlertControls();
  syncToCloud();
  if(lastWeatherData&&lastForecastData)evaluateSmartWeatherAlerts(lastWeatherData,lastForecastData);
  const msg='Параметры погодных событий сохранены на этом устройстве и синхронизируются с аккаунтом.';
  ['wpAlertFeed','smartAlertFeed'].forEach(id=>{const el=$(id);if(el)el.innerHTML=`<div class="wp5-event"><div class="symbol"><i class="fa-solid fa-check" aria-hidden="true"></i></div><div><strong>Настройки сохранены</strong><p>${msg}</p></div></div>`;});
  if(settings.browserNotifications&&'Notification'in window&&Notification.permission==='default')Notification.requestPermission().then(()=>{});
  showNotification('Настройки уведомлений сохранены');
}
window.saveSmartAlertSettings=saveSmartAlertSettings;
function evaluateSmartWeatherAlerts(current,forecast){
  if(!current||!forecast?.list?.length)return;
  const p=getSmartAlertPrefs(),items=forecast.list.slice(0,8),events=[];
  const metric=(settings.units||'metric')==='metric';
  const tempC=v=>metric?Number(v):(Number(v)-32)*5/9;
  const windMs=v=>metric?Number(v):Number(v)/2.237;
  const rainMax=Math.max(0,...items.map(x=>(x.pop||0)*100));
  const windMax=Math.max(0,...items.map(x=>windMs(x.wind?.speed||0)));
  const minC=Math.min(...items.map(x=>tempC(x.main.temp_min??x.main.temp)));
  const maxC=Math.max(...items.map(x=>tempC(x.main.temp_max??x.main.temp)));
  const conditions=items.map(x=>String(x.weather?.[0]?.main||'').toLowerCase()+' '+String(x.weather?.[0]?.description||'').toLowerCase()).join(' ');
  const currentDesc=String(current.weather?.[0]?.main||'').toLowerCase()+' '+String(current.weather?.[0]?.description||'').toLowerCase();
  const add=(id,title,body,icon='fa-circle-exclamation')=>events.push({id,title,body,icon});
  if(p.rain&&rainMax>=Number(p.rainThreshold||55))add('rain','Вероятны осадки',`В ближайшие часы вероятность осадков достигает ${Math.round(rainMax)}%.`,'fa-umbrella');
  if(p.wind&&windMax>=Number(p.windThreshold||12))add('wind','Сильный ветер',`Ветер может усилиться примерно до ${windMax.toFixed(1)} м/с.`,'fa-wind');
  if(p.cold&&minC<=Number(p.coldThreshold??0))add('cold','Похолодание',`В прогнозе температура опускается до ${Math.round(minC)}°C.`,'fa-snowflake');
  if(p.heat&&maxC>=Number(p.heatThreshold||30))add('heat','Жаркая погода',`В отдельные часы ожидается до ${Math.round(maxC)}°C. Планируйте тень и воду.`,'fa-sun');
  if(p.storm&&/thunder|гроза/.test(conditions+' '+currentDesc))add('storm','Возможна гроза','В прогнозе есть грозовые условия. Следите за официальными предупреждениями.','fa-cloud-bolt');
  if(p.snow&&/snow|снег|sleet|мокрый снег/.test(conditions+' '+currentDesc))add('snow','Снег или мокрый снег','В прогнозе обнаружены снежные осадки. Возможны скользкие участки.','fa-snowflake');
  const city=String(current.name||currentCity||'город').toLowerCase();
  events.forEach(event=>{
    const key=`wp_smart_notif_${city}_${event.id}`,last=Number(localStorage.getItem(key)||0);
    if(Date.now()-last>3*60*60*1000){localStorage.setItem(key,String(Date.now()));sendNotif(`Weather Pro · ${event.title}`,event.body);}
  });
  const html=events.length?events.map(e=>`<div class="wp5-event"><div class="symbol">${wp5FaIcon(e.icon)}</div><div><strong>${esc(e.title)}</strong><p>${esc(e.body)}</p></div></div>`).join(''):'<div class="wp5-empty">По выбранным критериям новых событий не обнаружено.</div>';
  ['wpAlertFeed','smartAlertFeed'].forEach(id=>{const el=$(id);if(el)el.innerHTML=html;});
  if($('alertLastCheck'))$('alertLastCheck').textContent=`Проверено для ${current.name||currentCity} · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`;
}
function runSmartAlertsNow(){if(!lastWeatherData||!lastForecastData){showNotification('Сначала загрузите прогноз города',true);return;}evaluateSmartWeatherAlerts(lastWeatherData,lastForecastData);showNotification('Проверка погодных событий завершена');}
window.runSmartAlertsNow=runSmartAlertsNow;
function askAIQuick(prompt){const input=$('aiInput');if(!input)return;showPage('ai');setAIWorkspace('assistant');input.value=String(prompt||'');wp13AutoSizeAIInput(input);$('wp13AiTools')?.removeAttribute('open');sendAIMessage();}
window.askAIQuick=askAIQuick;


