/* Weather Pro V16 module: 13-device-sensors-and-runtime.js — extracted from the existing app script. */
/* ============================================================
   WEATHER PRO 11.0 — HYPER INTELLIGENCE / DECISION ENGINE
   Uses the existing OpenWeather 3-hour forecast. Scores are heuristic
   planning indicators, not official weather warnings or safety guarantees.
   ============================================================ */
let wp11Mission = 'walk';
try {
  const savedMission = localStorage.getItem('wp11_mission');
  if (['walk','sport','drive','cycle'].includes(savedMission)) wp11Mission = savedMission;
} catch (_) {}

const WP11_MISSIONS = {
  walk:  {label:'Прогулка', targetTemp:19, windLimit:6, rainWeight:0.52, tempWeight:1.15, windWeight:3.0},
  sport: {label:'Спорт', targetTemp:17, windLimit:5, rainWeight:0.58, tempWeight:1.35, windWeight:3.5},
  drive: {label:'Автомобиль', targetTemp:16, windLimit:12, rainWeight:0.42, tempWeight:0.45, windWeight:1.25},
  cycle: {label:'Велосипед', targetTemp:18, windLimit:5, rainWeight:0.62, tempWeight:1.25, windWeight:4.0}
};

function wp11Num(value, fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function wp11TempC(value){
  const n=wp11Num(value,NaN);
  if(!Number.isFinite(n)) return null;
  if(settings?.units==='imperial') return (n-32)*5/9;
  if(settings?.units==='standard') return n-273.15;
  return n;
}
function wp11WindMs(value){
  const n=wp11Num(value,NaN);
  if(!Number.isFinite(n)) return null;
  return settings?.units==='imperial'?n/2.236936:n;
}
function wp11TempLabel(c){
  if(!Number.isFinite(c)) return '—';
  const v=settings?.units==='imperial'?(c*9/5+32):c;
  return `${Math.round(v)}°${settings?.units==='imperial'?'F':'C'}`;
}
function wp11TimeParts(unixSeconds,offsetSeconds=0){
  const date=new Date((wp11Num(unixSeconds)+wp11Num(offsetSeconds))*1000);
  return {date,hour:String(date.getUTCHours()).padStart(2,'0'),minute:String(date.getUTCMinutes()).padStart(2,'0'),day:date.getUTCDate(),month:date.getUTCMonth(),year:date.getUTCFullYear()};
}
function wp11FormatWindow(dt,offset){
  const a=wp11TimeParts(dt,offset),b=wp11TimeParts(dt+3*3600,offset),now=wp11TimeParts(Date.now()/1000,offset);
  const same=a.day===now.day&&a.month===now.month&&a.year===now.year;
  const next=new Date(Date.UTC(now.year,now.month,now.day+1));
  const tomorrow=a.day===next.getUTCDate()&&a.month===next.getUTCMonth()&&a.year===next.getUTCFullYear();
  const dayLabel=same?'Сегодня':tomorrow?'Завтра':a.date.toLocaleDateString('ru-RU',{timeZone:'UTC',day:'numeric',month:'short'});
  return `${dayLabel}, ${a.hour}:${a.minute}–${b.hour}:${b.minute}`;
}
function wp11ScoreForecastItem(item,missionKey){
  const profile=WP11_MISSIONS[missionKey]||WP11_MISSIONS.walk;
  const temp=wp11TempC(item?.main?.temp);
  const wind=wp11WindMs(item?.wind?.speed);
  const pop=Math.max(0,Math.min(1,wp11Num(item?.pop,0)));
  const rain=Math.max(0,wp11Num(item?.rain?.['3h'],0));
  const snow=Math.max(0,wp11Num(item?.snow?.['3h'],0));
  const group=String(item?.weather?.[0]?.main||'').toLowerCase();
  let penalty=0;
  if(temp!==null) penalty+=Math.min(32,Math.abs(temp-profile.targetTemp)*profile.tempWeight);
  if(wind!==null) penalty+=Math.min(27,Math.max(0,wind-profile.windLimit)*profile.windWeight);
  penalty+=Math.min(38,pop*38*profile.rainWeight+rain*(missionKey==='drive'?1.4:2.1));
  if(snow>0.2) penalty+=Math.min(24,8+snow*3.2);
  if(group.includes('thunder')) penalty+=missionKey==='drive'?30:38;
  else if(group.includes('snow')) penalty+=missionKey==='cycle'?20:13;
  else if(group.includes('rain')||group.includes('drizzle')) penalty+=6;
  if(temp!==null&&temp<0) penalty+=missionKey==='drive'?9:7;
  if(temp!==null&&temp>30) penalty+=12;
  const score=Math.max(0,Math.min(100,Math.round(100-penalty)));
  return {score,temp,wind,pop,rain,snow,group,item};
}
function wp11ScoreText(score,mission){
  if(score>=82) return {label:'Отличные условия',text:`Подходящее окно для сценария «${mission}». Серьёзных ограничений по доступному прогнозу не видно.`};
  if(score>=66) return {label:'В целом благоприятно',text:`Можно планировать «${mission.toLowerCase()}», но учитывайте отмеченные погодные факторы.`};
  if(score>=45) return {label:'Есть ограничения',text:`Для сценария «${mission.toLowerCase()}» есть заметные погодные неудобства. Подберите время внимательнее.`};
  return {label:'Неблагоприятные условия',text:`По текущей оценке лучше перенести «${mission.toLowerCase()}» на другое окно.`};
}
function wp11BuildRisks(items,offset){
  const risks=[];
  const add=(key,icon,title,body,level='warn')=>{
    if(risks.some(r=>r.key===key)) return;
    risks.push({key,icon,title,body,level});
  };
  for(const item of items){
    const d=wp11TimeParts(item.dt,offset),time=`${d.hour}:${d.minute}`;
    const temp=wp11TempC(item?.main?.temp),wind=wp11WindMs(item?.wind?.speed);
    const pop=wp11Num(item?.pop,0),rain=wp11Num(item?.rain?.['3h'],0),snow=wp11Num(item?.snow?.['3h'],0);
    const group=String(item?.weather?.[0]?.main||'').toLowerCase();
    if(group.includes('thunder')) add('storm','fa-cloud-bolt','Гроза в прогнозе',`В одном из интервалов отмечена гроза · около ${time}.`,'high');
    if((pop>=0.5||rain>=0.8)&&risks.length<4) add('rain','fa-cloud-rain','Вероятны осадки',`Вероятность до ${Math.round(pop*100)}%, ожидаемое количество до ${rain.toFixed(1)} мм за 3 часа · около ${time}.`,'warn');
    if(wind!==null&&wind>=9) add('wind','fa-wind','Усиление ветра',`Порывы/скорость ветра по прогнозу: ${wind.toFixed(1)} м/с · около ${time}.`,'warn');
    if(snow>=0.5) add('snow','fa-snowflake','Снег или мокрый снег',`Прогнозируется около ${snow.toFixed(1)} мм осадков в виде снега · около ${time}.`,'warn');
    if(temp!==null&&temp<=-5) add('cold','fa-temperature-low','Сильное похолодание',`Температура может опуститься до ${wp11TempLabel(temp)} · около ${time}.`,'warn');
    if(temp!==null&&temp>=30) add('heat','fa-temperature-high','Жаркая погода',`Температура может достигнуть ${wp11TempLabel(temp)} · около ${time}.`,'warn');
    if(risks.length>=4) break;
  }
  return risks;
}
function wp11RenderCommandCenter(current=lastWeatherData,forecast=lastForecastData){
  const root=$('wp11CommandCenter');
  if(!root) return;
  const mission=WP11_MISSIONS[wp11Mission]||WP11_MISSIONS.walk;
  root.querySelectorAll('[data-mission]').forEach(button=>{
    const active=button.dataset.mission===wp11Mission;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
  const status=$('wp11Status');
  const items=Array.isArray(forecast?.list)?forecast.list.filter(x=>Number.isFinite(Number(x.dt))).slice(0,8):[];
  if(!current||!items.length){
    if(status){status.classList.remove('ready');status.innerHTML='<span class="wp11-status-dot"></span> Ожидает прогноз';}
    $('wp11Score').textContent='—';$('wp11ScoreLabel').textContent='Нет данных';$('wp11ScoreText').textContent='Загрузите прогноз для выбранного города.';$('wp11ScoreWindow').textContent='Лучшее окно появится после загрузки.';
    $('wp11ScoreRing').style.setProperty('--wp11-score','0deg');$('wp11BestTime').textContent='—';$('wp11BestDescription').textContent='Оценка появится после получения погодных данных.';$('wp11CityMeta').textContent=current?.name||'Город не выбран';
    $('wp11Rain').textContent='—';$('wp11Wind').textContent='—';$('wp11TempRange').textContent='—';$('wp11Precip').textContent='—';
    $('wp11RiskCount').textContent='Ожидаем данные';$('wp11RiskList').innerHTML='<div class="wp11-risk-empty"><i class="fa-solid fa-satellite-dish"></i><span>Погодные сигналы появятся после загрузки прогноза.</span></div>';
    $('wp11DataMeta').textContent='Источник: прогноз OpenWeather. Данные пока не загружены.';
    return;
  }
  const scores=items.map(item=>({...wp11ScoreForecastItem(item,wp11Mission),dt:item.dt}));
  const best=scores.reduce((a,b)=>b.score>a.score?b:a,scores[0]);
  const offset=wp11Num(current.timezone,0);
  const description=wp11ScoreText(best.score,mission.label);
  $('wp11Score').textContent=String(best.score);
  $('wp11ScoreLabel').textContent=description.label;
  $('wp11ScoreText').textContent=description.text;
  $('wp11ScoreWindow').textContent=`Выбран сценарий: ${mission.label.toLowerCase()}`;
  $('wp11ScoreRing').style.setProperty('--wp11-score',`${best.score*3.6}deg`);
  $('wp11BestTime').textContent=wp11FormatWindow(best.dt,offset);
  $('wp11BestDescription').textContent=`Индекс ${best.score}/100. Оценка учитывает температуру, вероятность и количество осадков, ветер и тип погодных условий.`;
  $('wp11CityMeta').textContent=current.name?`${current.name}${current.sys?.country?', '+current.sys.country:''}`:'Выбранный город';
  const maxPop=Math.max(...scores.map(x=>x.pop));
  const maxWind=Math.max(...scores.map(x=>x.wind??0));
  const temps=scores.map(x=>x.temp).filter(Number.isFinite);
  const minTemp=temps.length?Math.min(...temps):null,maxTemp=temps.length?Math.max(...temps):null;
  const totalRain=scores.reduce((sum,x)=>sum+x.rain+x.snow,0);
  $('wp11Rain').textContent=`${Math.round(maxPop*100)}%`;
  $('wp11RainMeta').textContent=maxPop>=.5?'Высокая вероятность в одном из интервалов':'Максимум по прогнозу';
  $('wp11Wind').textContent=`${maxWind.toFixed(1)} м/с`;
  $('wp11WindMeta').textContent=maxWind>=9?'Возможен сильный ветер':'Максимум по прогнозу';
  $('wp11TempRange').textContent=temps.length?`${wp11TempLabel(minTemp)} – ${wp11TempLabel(maxTemp)}`:'—';
  $('wp11Precip').textContent=`${totalRain.toFixed(1)} мм`;
  const risks=wp11BuildRisks(items,offset);
  $('wp11RiskCount').textContent=risks.length?`${risks.length} сигнал(а)`:'Нет выраженных сигналов';
  $('wp11RiskList').innerHTML=risks.length?risks.map(r=>`<article class="wp11-risk-card ${r.level==='high'?'high':''}"><span class="wp11-risk-icon"><i class="fa-solid ${r.icon}"></i></span><div><strong>${esc(r.title)}</strong><p>${esc(r.body)}</p></div></article>`).join(''):'<div class="wp11-risk-empty"><i class="fa-solid fa-circle-check"></i><span>В ближайших 24 часах не обнаружено выраженных сигналов по заданным порогам. Это не заменяет официальные предупреждения.</span></div>';
  if(status){status.classList.add('ready');status.innerHTML='<span class="wp11-status-dot"></span> Анализ готов';}
  const start=wp11TimeParts(items[0].dt,offset),end=wp11TimeParts(items[items.length-1].dt,offset);
  $('wp11DataMeta').textContent=`Данные OpenWeather · ${items.length} интервал(а) по 3 часа · период ${start.hour}:${start.minute}–${end.hour}:${end.minute}. Оценка — ориентир для планирования, не официальное предупреждение.`;
}
function wp11SetMission(mission){
  if(!WP11_MISSIONS[mission]) return;
  wp11Mission=mission;
  try{localStorage.setItem('wp11_mission',mission);}catch(_){}
  wp11RenderCommandCenter();
}
function wp11Recalculate(){
  wp11RenderCommandCenter();
  if(typeof showNotification==='function') showNotification('Оценка пересчитана по последнему загруженному прогнозу.');
}
window.wp11SetMission=wp11SetMission;
window.wp11Recalculate=wp11Recalculate;

