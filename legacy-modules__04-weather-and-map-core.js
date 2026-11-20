/* Weather Pro V16 module: 04-weather-and-map-core.js — extracted from the existing app script. */
/* ============================================================
   RENDER
   ============================================================ */

function renderCurrent(d){
  applyWeatherAtmosphere(d);
  const isM=settings.units==='metric';
  const tU=isM?'°C':'°F';
  $('locationName').textContent=`${d.name}, ${d.sys.country}`;
  const tempInt = Math.round(d.main.temp);
  $('temperature').textContent = tempInt;
  applyTempColor(tempInt);
  $('weatherDescription').textContent=d.weather[0].description;
  $('weatherIconWrap').innerHTML=svg(iconFor(d.weather[0].main));
  $('feelsLike').textContent=Math.round(d.main.feels_like)+tU;
  let windMs = d.wind.speed;
  if(settings.units === 'imperial') windMs = d.wind.speed / 2.237;
  $('windSpeed').textContent=convertWind(windMs);
  $('windDirection').textContent=d.wind.deg!==undefined?'('+windDir(d.wind.deg)+')':'';
  $('humidity').textContent=d.main.humidity+'%';
  $('pressure').textContent=d.main.pressure+' гПа';
  $('tempUnit').textContent=tU;
  if(d.visibility!==undefined) $('visibility').textContent=(d.visibility/1000).toFixed(1)+' км';
  if(d.wind && d.wind.gust!==undefined){
    let gustMs = d.wind.gust;
    if(settings.units === 'imperial') gustMs = d.wind.gust / 2.237;
    $('windGust').textContent=convertWind(gustMs);
  }
  if(d.sys.sunrise) $('sunrise').textContent=formatTime(d.sys.sunrise*1000);
  if(d.sys.sunset) $('sunset').textContent=formatTime(d.sys.sunset*1000);
  $('moonPhase').textContent=moonPhase();
  $('lastUpdate').textContent='Обновлено: '+formatTime(new Date());
  updateUVGauge(d);
  updateHumidityGauge(d.main.humidity);
  const t=Math.round(d.main.temp), desc=d.weather[0].description;
  checkWeatherChange(t,desc);
  addHistEntry(d.name,d.main.temp,d.main.humidity,d.main.pressure);

  if(lastForecastData && lastForecastData.list && lastForecastData.list.length > 1){
    updateTempTrend(d.main.temp, lastForecastData.list[1].main.temp);
  } else if(historyData[d.name] && historyData[d.name].length > 1){
    updateTempTrend(d.main.temp, historyData[d.name][historyData[d.name].length - 2].temp);
  } else updateTempTrend(d.main.temp, null);
}

function renderAQI(d){
  if(!d.list||!d.list.length) return;
  const aqi=d.list[0].main.aqi;
  const comp=d.list[0].components || {};
  const txt=['Отличное','Хорошее','Умеренное','Плохое','Опасное'][aqi-1]||'—';
  const cls=['good','good','moderate','unhealthy','hazardous'][aqi-1]||'moderate';
  $('aqiValue').textContent=aqi;
  const b=$('aqiBadge'); b.textContent=txt; b.className='aqi-badge '+cls;
  const item=document.querySelector('.aqi-item');
  if(item) item.classList.toggle('alert-aqi', aqi>=4);
  const set = (id, val, digits=1) => { const el=$(id); if(el) el.textContent = (val!=null) ? Number(val).toFixed(digits) : '--'; };
  set('pollPM25', comp.pm2_5, 1);
  set('pollPM10', comp.pm10, 1);
  set('pollO3', comp.o3, 1);
  set('pollNO2', comp.no2, 1);
  set('pollSO2', comp.so2, 1);
  set('pollCO', comp.co, 0);
  const recs = {
    1:{ text:'Идеальные условия для прогулок и спорта на улице', icon:'i-check-circle', cls:'' },
    2:{ text:'Воздух чистый — можно гулять без ограничений', icon:'i-check-circle', cls:'' },
    3:{ text:'Чувствительным людям стоит ограничить время на улице', icon:'i-info', cls:'warn' },
    4:{ text:'Ограничьте пребывание на улице, при необходимости носите маску', icon:'i-alert-tri', cls:'danger' },
    5:{ text:'Оставайтесь дома, закройте окна и включите очиститель воздуха', icon:'i-alert-circle', cls:'danger' }
  };
  const rec = recs[aqi] || recs[3];
  const recEl = $('aqiRecommendation');
  if(recEl){
    recEl.className = 'aqi-recommendation ' + rec.cls;
    recEl.innerHTML = `<span class="aqi-rec-icon">${svg(rec.icon)}</span><span>${rec.text}</span>`;
  }
}

function renderAlerts(d){
  const c=$('alertContainer'); c.innerHTML='';
  const list=[];
  if(d.alerts && d.alerts.length) d.alerts.forEach(a=>list.push({t:a.event||'Предупреждение',b:a.description||'',time:a.start?new Date(a.start*1000).toLocaleString():''}));
  if(d.wind && d.wind.speed>12) list.push({t:'Сильный ветер',b:`Ожидается ${Math.round(d.wind.speed)} м/с`,time:new Date().toLocaleString()});
  if(d.weather&&d.weather[0].main==='Rain'&&d.rain&&d.rain['1h']>5) list.push({t:'Сильный дождь',b:`${d.rain['1h']} мм/ч`,time:new Date().toLocaleString()});
  if(!list.length){ c.innerHTML='<div class="alert-empty">Активных предупреждений нет</div>'; return; }
  list.forEach(a=>{
    const div=document.createElement('div');
    div.className='alert-banner show';
    div.innerHTML=`<div class="alert-title">${svg('i-alert-circle')} ${esc(a.t)}</div><div class="alert-desc">${esc(a.b)}</div><div class="alert-time">${esc(a.time)}</div>`;
    c.appendChild(div);
  });
}

function renderHourly(data) {
  const c = $('hourlyForecast');
  c.innerHTML = '';
  if (!data || !data.list) return;
  const items = data.list.slice(0, 12);
  if (!items.length) return;
  const temps = items.map(it => it.main.temp);
  const minT = Math.min(...temps) - 1;
  const maxT = Math.max(...temps) + 1;
  const range = maxT - minT || 1;
  const itemW = 72;
  const trackW = items.length * itemW;
  const chartH = 55;
  const chartTop = 10;
  const points = items.map((it, i) => {
    const x = i * itemW + itemW / 2;
    const y = chartTop + (1 - (it.main.temp - minT) / range) * chartH;
    return { x, y };
  });
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }
  const lineD = smoothPath(points);
  const areaD = lineD + ` L ${points[points.length-1].x} ${chartTop + chartH} L ${points[0].x} ${chartTop + chartH} Z`;
  let svgHTML = `
    <svg class="hourly-line-svg" width="${trackW}" height="${chartTop + chartH + 10}" viewBox="0 0 ${trackW} ${chartTop + chartH + 10}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tempAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa" stop-opacity="0.35"/><stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/></linearGradient>
        <linearGradient id="tempLineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#tempAreaGrad)"/>
      <path d="${lineD}" fill="none" stroke="url(#tempLineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  let itemsHTML = '';
  items.forEach((it, i) => {
    const d = new Date(it.dt * 1000);
    const isNow = i === 0;
    const time = isNow ? 'Сейчас' : formatHour(d);
    const topOffset = chartTop + (1 - (it.main.temp - minT) / range) * chartH;
    let windMs = it.wind.speed;
    if(settings.units === 'imperial') windMs = it.wind.speed / 2.237;
    itemsHTML += `
      <div class="hourly-item">
        <div class="hourly-temp" style="top:${topOffset - 30}px;">${Math.round(it.main.temp)}°</div>
        <div class="hourly-icon">${svg(iconFor(it.weather[0].main))}</div>
        <div class="hourly-wind">${svg('i-wind')} ${convertWind(windMs)}</div>
        <div class="hourly-time ${isNow ? 'now' : ''}">${time}</div>
      </div>`;
  });
  c.innerHTML = `<div class="hourly-scroll"><div class="hourly-track" style="width:${trackW}px;">${svgHTML}${itemsHTML}</div></div>`;
}

function renderForecast(data) {
  const c = $('forecast');
  c.innerHTML = '';
  if (!data || !data.list) return;
  const daily = [];
  for (let i = 0; i < data.list.length; i += 8) daily.push(data.list[i]);
  if (!daily.length) return;
  const allMin = Math.min(...daily.map(f => f.main.temp_min));
  const allMax = Math.max(...daily.map(f => f.main.temp_max));
  const range = allMax - allMin || 1;
  daily.slice(0, 5).forEach((f, i) => {
    const d = new Date(f.dt * 1000);
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dn = i === 0 ? 'Сегодня' : (i === 1 ? 'Завтра' : dayNames[d.getDay()]);
    const ds = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
    const minT = Math.round(f.main.temp_min);
    const maxT = Math.round(f.main.temp_max);
    const leftPct = ((f.main.temp_min - allMin) / range) * 100;
    const widthPct = ((f.main.temp_max - f.main.temp_min) / range) * 100;
    const el = document.createElement('div');
    el.className = 'forecast-row';
    el.style.cursor = 'pointer';
    el.title = 'Нажмите для деталей';
    el.innerHTML = `
      <div class="forecast-row-day">${dn}<small>${ds}</small></div>
      <div class="forecast-row-icon">${svg(iconFor(f.weather[0].main))}</div>
      <div class="forecast-row-bar-wrap">
        <span class="forecast-row-min">${minT}°</span>
        <div class="forecast-row-bar"><div class="forecast-row-bar-fill" style="left:${leftPct}%;width:${Math.max(widthPct, 6)}%;"></div></div>
        <span class="forecast-row-max">${maxT}°</span>
      </div>`;
    el.onclick = () => showDayDetail(i);
    c.appendChild(el);
  });
}

function updateUVGauge(d) {
  const label=$('uvLabel'),value=$('uvText'),arc=$('uvArc'),marker=$('uvMarker');
  if(label)label.textContent='Загрузка данных';
  if(value)value.textContent='—';
  if(arc)arc.setAttribute('stroke-dashoffset','141.4');
  if(marker){marker.setAttribute('cx','15');marker.setAttribute('cy','70');marker.setAttribute('stroke','#94a3b8');}
  const card=label?.closest('.gauge-card');
  if(card){card.title='УФ-индекс загружается из Open-Meteo. Расчётных значений нет.';card.setAttribute('aria-label','УФ-индекс: загрузка фактических данных Open-Meteo');}
  if(typeof window.wp16LoadUV==='function')window.wp16LoadUV(d);
} 

function updateHumidityGauge(h) {
  $('humLabel').textContent = h + '%';
  $('humText').textContent = h + '%';
  const maxArc = 141.4;
  const offset = maxArc - (h / 100) * maxArc;
  $('humArc').setAttribute('stroke-dashoffset', offset);
  const angle = (h / 100) * 180;
  const rad = (180 - angle) * Math.PI / 180;
  const cx = 60 + 45 * Math.cos(rad);
  const cy = 70 - 45 * Math.sin(rad);
  const marker = $('humMarker');
  marker.setAttribute('cx', cx);
  marker.setAttribute('cy', cy);
}

function renderCharts(data){
  const daily=[]; for(let i=0;i<data.list.length;i+=8) daily.push(data.list[i]);
  const labels=[],temps=[],hums=[];
  daily.slice(0,5).forEach(f=>{
    const d=new Date(f.dt*1000);
    labels.push(d.toLocaleDateString('ru-RU',{weekday:'short',day:'numeric'}));
    temps.push(Math.round(f.main.temp)); hums.push(f.main.humidity);
  });
  if(tempChart){ tempChart.data.labels=labels; tempChart.data.datasets[0].data=temps; tempChart.update(); }
  if(humidityChart){ humidityChart.data.labels=labels; humidityChart.data.datasets[0].data=hums; humidityChart.update(); }
}
function renderStats(data){
  const daily=[]; for(let i=0;i<data.list.length;i+=8) daily.push(data.list[i]);
  const temps=daily.map(f=>f.main.temp);
  const mx=Math.max(...temps), mn=Math.min(...temps), av=temps.reduce((a,b)=>a+b,0)/temps.length;
  const rd=daily.filter(f=>['Rain','Snow'].includes(f.weather[0].main)).length;
  const tU=settings.units==='metric'?'°C':'°F';
  $('statMaxTemp').textContent=Math.round(mx)+tU;
  $('statMinTemp').textContent=Math.round(mn)+tU;
  $('statAvgTemp').textContent=Math.round(av)+tU;
  $('statRainDays').textContent=rd;
}
function windDir(deg){ return ['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'][Math.round(deg%360/45)%8]; }
function moonPhase(){
  const days=(Date.now()-new Date(2024,0,1).getTime())/864e5;
  const p=(days%29.53)/29.53;
  if(p<.03)return'Новолуние'; if(p<.25)return'Молодая'; if(p<.47)return'1-я четверть';
  if(p<.53)return'Прибывающая'; if(p<.75)return'Полнолуние'; if(p<.97)return'Убывающая'; return'Старая';
}

function initCharts(){
  tempChart=new Chart($('tempChart'),{type:'line',data:{labels:[],datasets:[{label:'Температура',data:[],borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.1)',tension:.3,fill:true,pointBackgroundColor:'#3b82f6'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.1)'}},x:{ticks:{color:'#94a3b8'},grid:{display:false}}}}});
  humidityChart=new Chart($('humidityChart'),{type:'line',data:{labels:[],datasets:[{label:'Влажность',data:[],borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.1)',tension:.3,fill:true,pointBackgroundColor:'#10b981'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.1)'}},x:{ticks:{color:'#94a3b8'},grid:{display:false}}}}});
}

function initHistoryChart(){
  historyChart=new Chart($('historyChart'),{type:'line',data:{labels:[],datasets:[
    {label:'Температура',data:[],borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,.1)',tension:.3,fill:true},
    {label:'Влажность',data:[],borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.1)',tension:.3,fill:true}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.1)'}},x:{ticks:{color:'#94a3b8'},grid:{display:false}}}}});
}
function loadHistoryData(){
  try{ historyData=JSON.parse(localStorage.getItem(KEYS.HIST))||{}; }catch(e){historyData={};}
  const sel=$('historyCitySelect'); const cities=Object.keys(historyData);
  if(cities.length){
    sel.innerHTML=''; cities.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o);});
    const cur=$('locationName').textContent.split(',')[0];
    if(cities.includes(cur)) sel.value=cur;
  } else {
    sel.innerHTML='<option value="Москва">Москва</option><option value="Санкт-Петербург">Санкт-Петербург</option>';
  }
}
function addHistEntry(city,t,h,p){
  if(!historyData[city]) historyData[city]=[];
  historyData[city].push({date:new Date().toISOString(),temp:t,humidity:h,pressure:p});
  if(historyData[city].length>30) historyData[city]=historyData[city].slice(-30);
  localStorage.setItem(KEYS.HIST,JSON.stringify(historyData)); loadHistoryData();
}
function saveHist(city,data){
  if(!data||!data.list) return;
  const daily=[]; for(let i=0;i<data.list.length;i+=8) daily.push(data.list[i]);
  daily.forEach(f=>{
    const d=new Date(f.dt*1000);
    if(!historyData[city]) historyData[city]=[];
    const exists=historyData[city].some(e=>new Date(e.date).toDateString()===d.toDateString());
    if(!exists) historyData[city].push({date:d.toISOString(),temp:f.main.temp,humidity:f.main.humidity,pressure:f.main.pressure});
  });
  if(historyData[city]&&historyData[city].length>30) historyData[city]=historyData[city].slice(-30);
  localStorage.setItem(KEYS.HIST,JSON.stringify(historyData)); loadHistoryData();
}
function loadHistory(){
  const city=$('historyCitySelect').value;
  const d=historyData[city]||[];
  if(historyChart){
    historyChart.data.labels=d.map(e=>new Date(e.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}));
    historyChart.data.datasets[0].data=d.map(e=>e.temp);
    historyChart.data.datasets[1].data=d.map(e=>e.humidity);
    historyChart.update();
  }
}
window.loadHistory=loadHistory;
function clearHistory(){
  if(!confirm('Очистить всю историю?')) return;
  historyData={}; localStorage.removeItem(KEYS.HIST); loadHistoryData(); loadHistory();
  showNotification('История очищена');
}
window.clearHistory=clearHistory;


/* ============================================================
   MAP / RADAR
   ============================================================ */

function initMap(){
  mapInst=L.map('weatherMap',{zoomControl:true}).setView([55.7558,37.6173],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInst);
  L.marker([55.7558,37.6173]).addTo(mapInst).bindPopup('Москва');
  setLayerByName(mapLayerName);
  window.addEventListener('resize',()=>mapInst&&mapInst.invalidateSize());
}
async function initRadar(){
  try{
    const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if(!r.ok) throw 0;
    const data = await r.json();
    radarHost = data.host || 'https://tilecache.rainviewer.com';
    const past = (data.radar && Array.isArray(data.radar.past)) ? data.radar.past : [];
    // RainViewer discontinued free nowcast frames on 2026-01-01.
    // Keep only historical radar frames and never label them as a forecast.
    radarFrames = past.filter(frame => Number.isFinite(Number(frame.time)) && typeof frame.path === 'string');
    radarCurrentIdx = Math.max(0, radarFrames.length - 1);
    const slider = $('radarSlider');
    if(slider){ slider.max = Math.max(0, radarFrames.length - 1); slider.value = radarCurrentIdx; slider.disabled = radarFrames.length < 2; }
    const status = $('wp70RadarStatus');
    if(status) status.textContent = radarFrames.length ? `Доступно кадров: ${radarFrames.length} · данные примерно за последние 2 часа.` : 'Источник ответил без доступных радарных кадров.';
    const tag = $('wp70RadarTag'); if(tag) tag.textContent = radarFrames.length ? `${radarFrames.length} кадров · RainViewer` : 'Нет кадров';
    updateRadarFrameLabel();
    if(currentRadarMode)updateRadarFrame(radarCurrentIdx);
  }catch(e){
    console.warn('Radar init failed', e);
    const status = $('wp70RadarStatus'); if(status) status.textContent = 'Радар временно недоступен. Проверьте сеть или откройте полную карту позже.';
    const tag = $('wp70RadarTag'); if(tag) tag.textContent = 'Источник недоступен';
  }
}
function updateRadarFrame(idx){
  if(!radarFrames.length || !mapInst) return;
  radarCurrentIdx = Math.max(0, Math.min(idx, radarFrames.length - 1));
  const frame = radarFrames[radarCurrentIdx];
  const slider = $('radarSlider');
  if(slider && parseInt(slider.value) !== radarCurrentIdx) slider.value = radarCurrentIdx;
  if(radarLayer) mapInst.removeLayer(radarLayer);
  radarLayer = L.tileLayer(
    `${radarHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
    { opacity: 0.75, zIndex: 200, maxNativeZoom: 7, maxZoom: 19, attribution: 'Radar © RainViewer' }
  ).addTo(mapInst);
  updateRadarFrameLabel();
}
window.updateRadarFrame=updateRadarFrame;
function updateRadarFrameLabel(){
  if(!radarFrames.length) return;
  const frame = radarFrames[radarCurrentIdx];
  const t = new Date(frame.time * 1000);
  const isFuture = frame.time * 1000 > Date.now();
  if($('radarTime')) $('radarTime').textContent = (isFuture ? '+' : '') + formatTime(t);
  const last = radarFrames[radarFrames.length-1];
  if($('radarForecast')) $('radarForecast').textContent = formatTime(new Date(last.time * 1000));
}
function toggleRadarPlay(){
  if(!radarFrames.length){ showNotification('Радар загружается...',true); return; }
  radarPlaying = !radarPlaying;
  const btn = $('radarPlayBtn');
  if(radarPlaying){
    if(btn) btn.innerHTML = svg('i-stop');
    radarAnimTimer = setInterval(()=>{ if(wpPerformanceShouldPause())return; updateRadarFrame((radarCurrentIdx + 1) % radarFrames.length); }, 650);
  } else {
    if(btn) btn.innerHTML = svg('i-play');
    clearInterval(radarAnimTimer);
  }
}
window.toggleRadarPlay=toggleRadarPlay;
function setLayerByName(name){
  if(radarLayer){ mapInst.removeLayer(radarLayer); radarLayer=null; }
  if(mapLayerObj){ mapInst.removeLayer(mapLayerObj); mapLayerObj=null; }
  const rc = $('radarControls');
  if(name === 'radar'){
    currentRadarMode = true;
    if(rc) rc.classList.add('show');
    updateRadarFrame(radarCurrentIdx);
    mapLayerName = 'radar';
    return;
  } else {
    currentRadarMode = false;
    if(rc) rc.classList.remove('show');
    if(radarPlaying){ radarPlaying=false; clearInterval(radarAnimTimer); const b=$('radarPlayBtn'); if(b) b.innerHTML = svg('i-play'); }
  }
  if(name === 'none'){ mapLayerName = 'none'; return; }
  mapLayerObj = L.tileLayer(`https://tile.openweathermap.org/map/${name}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,{opacity:.7}).addTo(mapInst);
  if(typeof wp15BindMapFailover==='function') wp15BindMapFailover(name,mapLayerObj);
  if(mapLayerObj?.setOpacity) mapLayerObj.setOpacity(window.WP15_MAP_OPACITY??.72);
  mapLayerName = name;
}
function setMapLayer(btn){
  document.querySelectorAll('.layer-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  setLayerByName(btn.dataset.layer);
}
window.setMapLayer=setMapLayer;
function updateMap(lat,lon){
  if(!mapInst) return;
  mapInst.setView([lat,lon],8);
  mapInst.eachLayer(l=>{ if(l instanceof L.Marker) mapInst.removeLayer(l); });
  L.marker([lat,lon]).addTo(mapInst).bindPopup(esc(currentCity));
  setTimeout(()=>mapInst.invalidateSize(),150);
}

/* ============================================================
   WIDGET / PDF / SHARE
   ============================================================ */

function updateWidget(){
  const city=$('locationName')?.textContent?.split(',')[0]||currentCity||'—';
  const temp=$('temperature')?.textContent||'—';
  const desc=$('weatherDescription')?.textContent||'—';
  const wind=$('windSpeed')?.textContent||'—';
  const humidity=$('humidity')?.textContent||'—';
  const unit=$('tempUnit')?.textContent||'°C';
  if($('widgetCity'))$('widgetCity').textContent=city;
  if($('widgetTemp'))$('widgetTemp').textContent=temp;
  if($('widgetDesc'))$('widgetDesc').textContent=desc;
  if($('wp92WidgetUnit'))$('wp92WidgetUnit').textContent=unit;
  if($('wp92WidgetWind'))$('wp92WidgetWind').textContent=wind;
  if($('wp92WidgetHumidity'))$('wp92WidgetHumidity').textContent=humidity;
  const safeCity=esc(city),safeTemp=esc(temp),safeUnit=esc(unit),safeDesc=esc(desc),safeWind=esc(wind),safeHumidity=esc(humidity);
  const windLabel=lang==='en'?'Wind':'Ветер',humidityLabel=lang==='en'?'Humidity':'Влажность';
  const code=`<div style="box-sizing:border-box;max-width:420px;padding:22px;border:1px solid rgba(120,170,255,.25);border-radius:24px;color:#f8fbff;background:radial-gradient(circle at 90% 0,rgba(59,130,246,.34),transparent 42%),linear-gradient(145deg,#142442,#081225);font:14px/1.4 Inter,Arial,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.28)">
  <div style="display:flex;justify-content:space-between;align-items:center;color:#9fc5ff;font-size:11px;font-weight:800;letter-spacing:1.4px"><span>◈ WEATHER PRO</span><span style="padding:5px 9px;border-radius:99px;background:rgba(52,211,153,.12);color:#6ee7b7">LIVE</span></div>
  <div style="margin-top:22px;color:#c6d5ed;font-size:16px;font-weight:650">${safeCity}</div>
  <div style="display:flex;align-items:center;gap:14px;margin-top:4px"><strong style="font-size:64px;line-height:1;letter-spacing:-4px">${safeTemp}${safeUnit}</strong><span style="color:#b4c4dc;font-size:15px">${safeDesc}</span></div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:22px;padding-top:14px;border-top:1px solid rgba(255,255,255,.12);color:#aabbd4;font-size:12px"><span>${windLabel} <b style="color:#fff">${safeWind}</b></span><span>${humidityLabel} <b style="color:#fff">${safeHumidity}</b></span></div>
  <div style="margin-top:18px;color:#7194c6;font-size:10px;font-weight:700;letter-spacing:1px">SMART WEATHER SUITE</div>
</div>`;
  if($('widgetCode'))$('widgetCode').textContent=code;
}
function copyWidgetCode(){
  const code=$('widgetCode')?.textContent||'';
  if(navigator.clipboard?.writeText){navigator.clipboard.writeText(code).then(()=>showNotification('Код скопирован')).catch(()=>wp92FallbackCopy(code));}
  else wp92FallbackCopy(code);
}
function wp92FallbackCopy(value){
  const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');showNotification('Код скопирован');}catch(e){showNotification('Не удалось скопировать код',true);}finally{document.body.removeChild(ta);}
}
window.copyWidgetCode=copyWidgetCode;

function wp92PdfWeatherIcon(description=''){
  const type=wp92WeatherType(description);
  const sun='<circle cx="30" cy="25" r="11" fill="#FFC857"/><g stroke="#FFC857" stroke-width="3" stroke-linecap="round"><path d="M30 5v5M30 40v5M10 25h5M45 25h5M16 11l4 4M40 35l4 4M44 11l-4 4M20 35l-4 4"/></g>';
  const cloud='<path d="M15 43h29a10 10 0 0 0 0-20h-1a14 14 0 0 0-27-2 11 11 0 0 0-1 22Z" fill="#E8F3FF"/>';
  let extra='';
  if(type==='sun')extra=sun;
  else if(type==='partly')extra=sun+cloud;
  else if(type==='cloud')extra=cloud;
  else if(type==='rain')extra=cloud+'<g stroke="#35BFF4" stroke-width="3.5" stroke-linecap="round"><path d="m22 47-4 8m15-8-4 8m15-8-4 8"/></g>';
  else if(type==='snow')extra=cloud+'<g stroke="#A9DDFB" stroke-width="2.5" stroke-linecap="round"><path d="M19 49v8m-4-4h8m10-4v8m-4-4h8m10-4v8m-4-4h8"/></g>';
  else if(type==='thunder')extra=cloud+'<path d="m32 42-9 14h8l-3 11 15-19h-9l4-6Z" fill="#FFD15C" stroke="#F6B83F" stroke-width="1.5"/>';
  else extra=cloud+'<g stroke="#9DB7D5" stroke-width="3" stroke-linecap="round"><path d="M8 50h40M14 57h34"/></g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 70" width="60" height="70" aria-hidden="true">${extra}</svg>`;
}
async function exportPDF(){
  const el=id=>$(id)?.textContent?.trim()||'—';
  const city=(el('locationName').split(',')[0]||currentCity||'—');
  const temp=el('temperature'),unit=el('tempUnit')||'°C',desc=el('weatherDescription'),feels=el('feelsLike');
  const wind=el('windSpeed'),hum=el('humidity'),press=el('pressure'),visibility=el('visibility');
  const forecast=typeof wp92ForecastItems==='function'?wp92ForecastItems():[];
  const safe=v=>esc(String(v??'—'));
  const fmtDay=(item,i)=>i===0?(lang==='en'?'Today':'Сегодня'):new Date(item.dt*1000).toLocaleDateString(lang==='en'?'en-US':'ru-RU',{weekday:'short',day:'numeric'});
  const forecastRows=forecast.length?forecast.map((f,i)=>{
    const fdesc=f.weather?.[0]?.description||'';
    const hi=Number.isFinite(f.main?.temp_max)?Math.round(f.main.temp_max):Math.round(f.main?.temp??0);
    const lo=Number.isFinite(f.main?.temp_min)?Math.round(f.main.temp_min):Math.round(f.main?.temp??0);
    const t=Math.round(f.main?.temp??0);
    return `<div class="pdf-day"><div class="pdf-day-date">${safe(fmtDay(f,i))}</div><div class="pdf-day-icon">${wp92PdfWeatherIcon(fdesc)}</div><div class="pdf-day-desc">${safe(fdesc||'—')}</div><div class="pdf-day-temp">${t}°</div><div class="pdf-day-range"><span>${hi}°</span><span>${lo}°</span></div></div>`;
  }).join(''):`<div class="pdf-empty">${lang==='en'?'Multi-day forecast is currently unavailable.':'Прогноз на несколько дней сейчас недоступен.'}</div>`;
  const now=new Date().toLocaleString(lang==='en'?'en-US':'ru-RU',{dateStyle:'long',timeStyle:'short'});
  const html=`<div id="pdf-content" class="pdf-report">
    <div class="pdf-top"><div class="pdf-brand"><div class="pdf-mark">${wp92PdfWeatherIcon(desc)}</div><div><strong>WEATHER PRO</strong><small>SMART WEATHER SUITE</small></div></div><span class="pdf-live"><i></i> ${lang==='en'?'WEATHER REPORT':'ПОГОДНЫЙ ОТЧЁТ'}</span></div>
    <div class="pdf-heading"><span class="pdf-kicker">${lang==='en'?'LOCAL WEATHER BRIEFING':'ПОГОДА В ВАШЕМ ГОРОДЕ'}</span><h1>${safe(city)}</h1><p>${safe(now)}</p></div>
    <section class="pdf-hero"><div class="pdf-hero-copy"><span class="pdf-section-label">${lang==='en'?'CURRENT CONDITIONS':'СЕЙЧАС'}</span><div class="pdf-temperature">${safe(temp)}<small>${safe(unit)}</small></div><h2>${safe(desc)}</h2><p>${lang==='en'?'Feels like':'Ощущается как'} <b>${safe(feels)}</b></p></div><div class="pdf-hero-icon">${wp92PdfWeatherIcon(desc)}</div></section>
    <section class="pdf-metrics">
      <div class="pdf-metric"><span class="pdf-metric-icon">↗</span><small>${lang==='en'?'WIND':'ВЕТЕР'}</small><b>${safe(wind)}</b></div>
      <div class="pdf-metric"><span class="pdf-metric-icon">◌</span><small>${lang==='en'?'HUMIDITY':'ВЛАЖНОСТЬ'}</small><b>${safe(hum)}</b></div>
      <div class="pdf-metric"><span class="pdf-metric-icon">⌁</span><small>${lang==='en'?'PRESSURE':'ДАВЛЕНИЕ'}</small><b>${safe(press)}</b></div>
      <div class="pdf-metric"><span class="pdf-metric-icon">◎</span><small>${lang==='en'?'VISIBILITY':'ВИДИМОСТЬ'}</small><b>${safe(visibility)}</b></div>
    </section>
    <section class="pdf-forecast"><div class="pdf-section-head"><div><span class="pdf-kicker">${lang==='en'?'UPCOMING DAYS':'БЛИЖАЙШИЙ ПРОГНОЗ'}</span><h2>${lang==='en'?'5-day outlook':'Прогноз на 5 дней'}</h2></div><span class="pdf-forecast-count">${forecast.length||0}/5</span></div><div class="pdf-days">${forecastRows}</div></section>
    <div class="pdf-bottom"><span>${lang==='en'?'Generated by Weather Pro':'Сформировано приложением Weather Pro'}</span><b>WEATHER PRO <i>•</i> SMART WEATHER SUITE</b></div>
  </div>`;
  const wrapper=document.createElement('div');wrapper.innerHTML=html;
  wrapper.style.cssText='position:fixed;left:-12000px;top:0;width:794px;z-index:-1;pointer-events:none;';
  const style=document.createElement('style');style.textContent=`
    .pdf-report{width:794px;min-height:1123px;padding:38px 42px 30px;box-sizing:border-box;overflow:hidden;color:#f4f8ff;background:radial-gradient(circle at 88% 7%,rgba(39,111,232,.22),transparent 30%),linear-gradient(150deg,#081426,#0e1e37 58%,#081321);font-family:Inter,Arial,sans-serif;border:1px solid #35547e;position:relative}
    .pdf-report:before{content:'';position:absolute;inset:13px;border:1px solid rgba(130,180,255,.22);border-radius:20px;pointer-events:none}
    .pdf-top,.pdf-brand,.pdf-live,.pdf-section-head,.pdf-bottom{display:flex;align-items:center;justify-content:space-between}
    .pdf-brand{justify-content:flex-start;gap:12px}.pdf-mark{width:48px;height:48px;border-radius:14px;background:linear-gradient(145deg,#2876eb,#0a8eb8);display:grid;place-items:center;border:1px solid rgba(180,220,255,.45)}.pdf-mark svg{width:35px;height:38px}
    .pdf-brand strong{display:block;font-size:19px;letter-spacing:.3px}.pdf-brand small{display:block;margin-top:3px;color:#8fb6e8;font-size:9px;letter-spacing:1px;font-weight:700}
    .pdf-live{gap:7px;padding:8px 12px;border-radius:99px;background:rgba(48,210,157,.09);border:1px solid rgba(48,210,157,.3);font-size:9px;letter-spacing:1px;color:#83e9c2;font-weight:800}.pdf-live i{width:7px;height:7px;border-radius:50%;background:#50d7a2;display:inline-block}
    .pdf-heading{margin:30px 0 18px}.pdf-kicker{display:block;color:#83b6f2;font-size:9px;font-weight:800;letter-spacing:1.6px}.pdf-heading h1{margin:6px 0 3px;font-size:36px;letter-spacing:-1px;line-height:1.05}.pdf-heading p{color:#91a8c7;font-size:11px}
    .pdf-hero{display:flex;align-items:center;justify-content:space-between;min-height:205px;padding:22px 27px;border-radius:22px;background:linear-gradient(135deg,rgba(25,54,94,.95),rgba(11,26,48,.96));border:1px solid rgba(124,178,255,.35);box-shadow:0 14px 35px rgba(0,0,0,.18)}
    .pdf-section-label{color:#b1c8e7;font-size:10px;font-weight:800;letter-spacing:1.3px}.pdf-temperature{margin:8px 0 0;font-size:83px;line-height:1;font-weight:300;letter-spacing:-5px}.pdf-temperature small{font-size:33px;color:#8cbcff;letter-spacing:0;margin-left:8px}.pdf-hero-copy h2{margin:6px 0;color:#e4efff;font-size:19px}.pdf-hero-copy p{color:#9bb4d5;font-size:12px}.pdf-hero-copy p b{color:#eaf3ff}.pdf-hero-icon{width:160px;height:150px;display:grid;place-items:center}.pdf-hero-icon svg{width:148px;height:148px;filter:drop-shadow(0 8px 18px rgba(56,154,255,.28))}
    .pdf-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 20px}.pdf-metric{min-height:75px;padding:12px 13px;border:1px solid rgba(128,171,228,.2);border-radius:14px;background:rgba(12,28,51,.82)}.pdf-metric-icon{display:inline-block;color:#86baff;font-size:18px;margin-right:6px}.pdf-metric small{color:#8ea9cc;font-size:9px;letter-spacing:.8px;font-weight:700}.pdf-metric b{display:block;margin-top:7px;color:#f5f8ff;font-size:18px}
    .pdf-section-head{margin-bottom:10px}.pdf-section-head h2{margin-top:4px;font-size:19px}.pdf-forecast-count{padding:5px 9px;border:1px solid rgba(124,178,255,.2);border-radius:99px;color:#9fc6ff;font-size:10px}.pdf-days{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.pdf-day{min-height:165px;padding:12px 7px;text-align:center;border:1px solid rgba(128,171,228,.2);border-radius:14px;background:rgba(12,28,51,.84);box-sizing:border-box}.pdf-day-date{font-size:11px;color:#a7bedc;font-weight:700}.pdf-day-icon{height:67px;display:grid;place-items:center}.pdf-day-icon svg{width:56px;height:62px;filter:drop-shadow(0 4px 8px rgba(42,148,255,.2))}.pdf-day-desc{height:27px;overflow:hidden;color:#91a9cb;font-size:8px;line-height:1.25;text-transform:lowercase}.pdf-day-temp{font-size:20px;font-weight:800;color:#f7faff}.pdf-day-range{display:flex;justify-content:center;gap:10px;margin-top:3px;color:#91a9ca;font-size:9px}.pdf-day-range span:first-child{color:#f3c56a}.pdf-empty{padding:20px;text-align:center;border:1px dashed rgba(128,171,228,.25);border-radius:14px;color:#9aafcc;font-size:12px}
    .pdf-bottom{position:absolute;left:42px;right:42px;bottom:30px;padding-top:12px;border-top:1px solid rgba(128,171,228,.2);color:#819cbe;font-size:9px}.pdf-bottom b{color:#a8caff;letter-spacing:.8px}.pdf-bottom i{color:#4fb7f1;font-style:normal}
  `;
  document.head.appendChild(style);document.body.appendChild(wrapper);
  try{
    showNotification(lang==='en'?'Creating PDF report…':'Создаём PDF-отчёт…');
    if(document.fonts?.ready)await document.fonts.ready;
    const node=wrapper.firstElementChild;
    const canvas=await html2canvas(node,{scale:2,backgroundColor:'#081426',logging:false,useCORS:true});
    const {jsPDF}=window.jspdf;const pdf=new jsPDF('p','mm','a4');
    const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight();
    const sourcePageH=Math.floor(canvas.width*pageH/pageW);
    let offset=0,page=0;
    while(offset<canvas.height){
      const sliceH=Math.min(sourcePageH,canvas.height-offset);const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=sliceH;
      slice.getContext('2d').drawImage(canvas,0,offset,canvas.width,sliceH,0,0,canvas.width,sliceH);
      if(page>0)pdf.addPage();const img=slice.toDataURL('image/jpeg',.94);pdf.addImage(img,'JPEG',0,0,pageW,sliceH*pageW/canvas.width,'','FAST');offset+=sliceH;page++;
    }
    pdf.save(`weather-pro-${city.toLowerCase().replace(/[^a-z0-9а-яё]+/gi,'-')}-report.pdf`);
    showNotification(lang==='en'?'PDF report created':'PDF-отчёт создан');
  }catch(e){console.error('[Weather Pro PDF]',e);showNotification(lang==='en'?'Could not create PDF report':'Не удалось создать PDF-отчёт',true);}
  finally{wrapper.remove();style.remove();}
}
window.exportPDF=exportPDF;

function shareWeather(){
  const city=$('locationName').textContent;
  const temp=$('temperature').textContent;
  const desc=$('weatherDescription').textContent;
  const text=`Погода в ${city}: ${temp}°C, ${desc}. Weather Pro`;
  const url=location.href;
  if(navigator.share) navigator.share({title:'Погода',text,url}).catch(()=>{});
  else navigator.clipboard?.writeText(text+'\n'+url).then(()=>showNotification('Скопировано'));
}
window.shareWeather=shareWeather;
function shareProfile(){
  const text=`${currentUser.name} — Weather Pro\nГород: ${currentUser.defaultCity||'—'}\n${currentUser.bio||''}`;
  const url=location.href;
  if(navigator.share) navigator.share({title:currentUser.name,text,url}).catch(()=>{});
  else navigator.clipboard?.writeText(text+'\n'+url).then(()=>showNotification('Скопировано'));
}
window.shareProfile=shareProfile;
function shareSocial(p){
  const city=$('locationName').textContent;
  const temp=$('temperature').textContent;
  const desc=$('weatherDescription').textContent;
  const text=`Погода в ${city}: ${temp}°C, ${desc}`;
  const url=encodeURIComponent(location.href), txt=encodeURIComponent(text);
  let u='';
  if(p==='vk') u=`https://vk.com/share.php?url=${url}&title=${txt}`;
  if(p==='tg') u=`https://t.me/share/url?url=${url}&text=${txt}`;
  if(p==='tw') u=`https://twitter.com/intent/tweet?text=${txt}&url=${url}`;
  if(u) window.open(u,'_blank','width=600,height=400');
}
window.shareSocial=shareSocial;
function getLocation(){
  if(!navigator.geolocation){showNotification('Геолокация не поддерживается',true);return;}
  showNotification('Определяем местоположение...');
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      const {latitude,longitude}=pos.coords;
      const r=await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${OWM_KEY}`);
      const d=await r.json();
      if(d&&d.length){ $('cityInput').value=d[0].name; getWeather(d[0].name); showNotification('Найдено: '+d[0].name); }
    }catch(e){showNotification('Не удалось определить город',true);}
  },()=>showNotification('Разрешите доступ к геолокации',true));
}
window.getLocation=getLocation;
function showQRModal(){
  $('qrModal').classList.add('show');
  setTimeout(()=>{
    const c=$('qrcode'); c.innerHTML='';
    try{ qrInst=new QRCode(c,{text:location.href,width:200,height:200,colorDark:'#0a0e17',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H}); }catch(e){}
  },100);
}
window.showQRModal=showQRModal;
function closeQRModal(){ $('qrModal').classList.remove('show'); }
window.closeQRModal=closeQRModal;

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

function showNotifBanner() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (localStorage.getItem(KEYS.NOTIF) === '1') return;
  setTimeout(() => $('notifBanner').classList.add('show'), 5000);
}
function dismissNotifBanner() {
  $('notifBanner').classList.remove('show');
  localStorage.setItem(KEYS.NOTIF, '1');
}
window.dismissNotifBanner=dismissNotifBanner;
async function allowNotifications() {
  if (!('Notification' in window)) { showNotification('Уведомления не поддерживаются', true); return; }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      settings.browserNotifications = true; saveSettingsSilent(); $('browserNotifications').checked = true;
      showNotification('Уведомления включены');
      try { new Notification('Weather Pro', { body: 'Уведомления подключены' }); } catch (e) {}
    } else showNotification('Уведомления отклонены', true);
  } catch (e) { showNotification('Ошибка запроса', true); }
  dismissNotifBanner();
}
window.allowNotifications=allowNotifications;
function sendNotif(title,body){
  if('Notification' in window && Notification.permission==='granted' && settings.browserNotifications)
    try{ new Notification(title,{body}); }catch(e){}
}
function checkWeatherChange(t,desc){
  if(settings.weatherNotifications){
    if(lastTemp!==null && Math.abs(t-lastTemp)>3) sendNotif('Изменение температуры',`Δ ${t-lastTemp}°C`);
    if(lastDesc && lastDesc!==desc && /дожд|снег/i.test(desc)) sendNotif('Изменение погоды',desc);
  }
  lastTemp=t; lastDesc=desc;
}

/* ============================================================
   AI
   ============================================================ */

function initAI(){
  const c=$('aiModelSelector');
  if(!c)return;
  c.innerHTML='';
  ALLOWED_MODELS.forEach(m=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='ai-model-btn'+(m.id==='openai'?' active':'');
    b.innerHTML=`${svg(m.icon)} ${m.name}`;
    b.setAttribute('aria-pressed',m.id==='openai'?'true':'false');
    b.onclick=()=>{
      document.querySelectorAll('.ai-model-btn').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-pressed','false');});
      b.classList.add('active');b.setAttribute('aria-pressed','true');
      window._aiModel=m.id;
      const label=$('wp13AiModelLabel');if(label)label.textContent=m.name;
      $('wp13AiTools')?.removeAttribute('open');
    };
    c.appendChild(b);
  });
  window._aiModel='openai';
  const label=$('wp13AiModelLabel');
  const selected=ALLOWED_MODELS.find(m=>m.id==='openai');
  if(label)label.textContent=selected?.name||'OpenAI';
}
function buildWeatherContext(){
  if(!lastWeatherData) return 'Данных о погоде нет — пользователь ещё не загружал город.';
  const w=lastWeatherData,metric=(settings.units||'metric')==='metric';
  const tempUnit=metric?'°C':'°F',windVal=metric?Number(w.wind?.speed||0):(Number(w.wind?.speed||0)*2.237),windUnit=metric?'м/с':'миль/ч';
  const L=[
    `Город: ${w.name}, ${w.sys.country}`,
    `Температура: ${Math.round(w.main.temp)}${tempUnit} (ощущается ${Math.round(w.main.feels_like)}${tempUnit})`,
    `Погода: ${w.weather?.[0]?.description||'—'}`,
    `Влажность: ${w.main.humidity}%, ветер ${Math.round(windVal*10)/10} ${windUnit}, давление ${w.main.pressure} гПа`,
    `Координаты: ${w.coord?.lat ?? '—'}, ${w.coord?.lon ?? '—'}`
  ];
  if(lastForecastData?.list?.length){
    L.push('Ближайшие прогнозные интервалы (время местное для города):');
    lastForecastData.list.slice(0,8).forEach(f=>{
      const d=new Date(f.dt*1000).toLocaleString('ru-RU',{weekday:'short',hour:'2-digit',minute:'2-digit'});
      const rain=Math.round((f.pop||0)*100),wind=metric?Number(f.wind?.speed||0):Number(f.wind?.speed||0)*2.237;
      L.push(`  ${d}: ${Math.round(f.main.temp)}${tempUnit}, ${f.weather?.[0]?.description||'—'}, осадки ${rain}%, ветер ${Math.round(wind*10)/10} ${windUnit}`);
    });
  }
  if(wp5LastRoute?.weatherPoints?.length){
    L.push(`Последний анализ маршрута: ${wp5LastRoute.origin?.name||'Старт'} → ${wp5LastRoute.destination?.name||'Финиш'}, ${Math.round(wp5LastRoute.route.distance/1000)} км.`);
    wp5LastRoute.weatherPoints.forEach(point=>L.push(`  ${point.label}: ${point.time}, ${Math.round(point.temp)}°C, осадки ${Math.round(point.rain)}%, ветер ${Number(point.wind).toFixed(1)} м/с.`));
  }
  const prefs=getSmartAlertPrefs();
  L.push(`Пользовательские пороги уведомлений: дождь ${prefs.rain?'вкл':'выкл'} от ${prefs.rainThreshold}%, ветер ${prefs.wind?'вкл':'выкл'} от ${prefs.windThreshold} м/с, холод ${prefs.cold?'вкл':'выкл'} ниже ${prefs.coldThreshold}°C, жара ${prefs.heat?'вкл':'выкл'} выше ${prefs.heatThreshold}°C, гроза ${prefs.storm?'вкл':'выкл'}, снег ${prefs.snow?'вкл':'выкл'}.`);
  return L.join('\n');
}
function wp13AutoSizeAIInput(input){
  if(!input)return;
  input.style.height='auto';
  const minHeight=56;
  const maxHeight=window.matchMedia&&window.matchMedia('(max-width:768px)').matches?108:116;
  const next=Math.max(minHeight,Math.min(maxHeight,input.scrollHeight||minHeight));
  input.style.height=next+'px';
}
async function sendAIMessage() {
  const input = $('aiInput');
  const sendButton = $('aiSendBtn');
  if (!input) return;
  const msg = String(input.value || '').trim();
  if (!msg || window.__wp13AiBusy) return;

  window.__wp13AiBusy = true;
  if (sendButton) {
    sendButton.disabled = true;
    sendButton.setAttribute('aria-busy', 'true');
  }

  // Chat persistence is deliberately fire-and-forget. It must never be awaited
  // by the AI request, because Firestore availability must not block a reply.
  addMsg('user', msg);
  try {
    if (typeof wp16AIAppendMessage === 'function') wp16AIAppendMessage('user', msg);
  } catch (historyError) {
    console.warn('[Weather Pro/AI] Не удалось сохранить сообщение локально:', historyError);
  }
  input.value = '';
  input.style.height = '56px';
  wp13AutoSizeAIInput(input);

  const thinkingId = 'thinking_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'ai-message assistant';
  thinkingEl.id = thinkingId;
  thinkingEl.style.maxWidth = '85%';
  thinkingEl.style.padding = '0';
  thinkingEl.style.background = 'transparent';
  thinkingEl.style.border = 'none';
  thinkingEl.innerHTML = '<div class="ai-thinking"><div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div><div class="ai-thinking-dot"></div></div><div class="ai-progress"><div class="ai-progress-bar" id="prog_' + thinkingId + '"></div></div>';
  $('aiMessages')?.appendChild(thinkingEl);
  scrollAIToLatest('auto');

  let progress = 0;
  const progBar = $('prog_' + thinkingId);
  const progInterval = window.setInterval(() => {
    progress = Math.min(90, progress + Math.random() * 12 + 3);
    if (progBar) progBar.style.width = progress + '%';
  }, 400);

  let requestTimer = null;
  try {
    const selectedModel = String(window._aiModel || 'openai');
    const system = `Ты — Weather AI 2.0, практичный погодный помощник в приложении Weather Pro. Отвечай на русском, структурируй ответ короткими блоками. Используй фактические данные ниже; не выдумывай прогнозы, предупреждения, время дождя или температуру. Если данных недостаточно — прямо скажи об этом. Для рекомендаций объясняй, какие параметры повлияли на вывод, отделяй факт прогноза от совета. Учитывай комфорт, осадки, ветер и ощущаемую температуру. Не выдавай оценку активности за гарантию безопасности.\n\nДанные о погоде:\n${buildWeatherContext()}`;

    // This is the same request flow the app used before chat-history persistence:
    // send only the current user message plus live weather context to Pollinations.
    // Do not wait for Firebase Functions or prepend a growing chat transcript.
    const url = `${CHAT_API}${encodeURIComponent(msg)}?model=${encodeURIComponent(selectedModel)}&system=${encodeURIComponent(system)}`;
    const controller = new AbortController();
    requestTimer = window.setTimeout(() => controller.abort(), 35000);
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Accept': 'text/plain' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error('AI HTTP ' + response.status);
    const answer = (await response.text()).trim();
    if (!answer) throw new Error('AI вернул пустой ответ');

    if (progBar) progBar.style.width = '100%';
    thinkingEl.remove();
    addMsg('assistant', answer);
    window.wp16LastAIResponse = answer;
    try {
      if (typeof wp16AIAppendMessage === 'function') wp16AIAppendMessage('assistant', answer);
    } catch (historyError) {
      console.warn('[Weather Pro/AI] Ответ получен, но история не сохранилась:', historyError);
    }
  } catch (error) {
    console.warn('[Weather Pro/AI] Request failed:', error);
    thinkingEl.remove();
    const failureText = error?.name === 'AbortError'
      ? 'Нейросеть не ответила за 35 секунд. Проверьте соединение и попробуйте ещё раз.'
      : 'Не удалось получить ответ от нейросети. Проверьте подключение и попробуйте ещё раз.';
    addMsg('assistant', failureText);
    try {
      if (typeof wp16AIAppendMessage === 'function') wp16AIAppendMessage('assistant', failureText);
    } catch (historyError) {
      console.warn('[Weather Pro/AI] Не удалось сохранить сообщение об ошибке:', historyError);
    }
  } finally {
    if (requestTimer) window.clearTimeout(requestTimer);
    window.clearInterval(progInterval);
    thinkingEl.remove();
    window.__wp13AiBusy = false;
    if (sendButton) {
      sendButton.disabled = false;
      sendButton.removeAttribute('aria-busy');
    }
    scrollAIToLatest('auto');
    wp13UpdateAIViewport();
  }
}
window.sendAIMessage=sendAIMessage;
function quickAsk(text) { const input=$('aiInput'); if(!input)return; input.value=String(text||''); wp13AutoSizeAIInput(input); $('wp13AiTools')?.removeAttribute('open'); sendAIMessage(); }
window.quickAsk=quickAsk;
function scrollAIToLatest(behavior='smooth'){
  const box=$('aiMessages');
  if(!box)return;
  requestAnimationFrame(()=>{
    box.scrollTo({top:box.scrollHeight,behavior:behavior==='auto'?'auto':'smooth'});
  });
}
function addMsg(role,content,tmp=false){
  const box=$('aiMessages');
  if(!box)return null;
  const w=document.createElement('div');
  w.className='ai-message '+(role==='user'?'user':'assistant');
  const t=document.createElement('div');
  t.textContent=String(content??'');
  w.appendChild(t);
  const tm=document.createElement('div');
  tm.className='msg-time';
  tm.textContent=formatTime(new Date());
  w.appendChild(tm);
  box.appendChild(w);
  scrollAIToLatest('smooth');
  return tmp?w:null;
}

/* ============================================================
   COMPARE / DAY DETAIL
   ============================================================ */

async function compareCities(){
  const first=String($('compareCity1')?.value||'').trim()||'Москва';
  const second=String($('compareCity2')?.value||'').trim()||'Санкт-Петербург';
  if($('compareCity1'))$('compareCity1').value=first;if($('compareCity2'))$('compareCity2').value=second;
  const names=[first,second,...[3,4].map(i=>String($('compareCity'+i)?.value||'').trim()).filter(Boolean)];
  if(names.length<2){showNotification('Укажите минимум два города',true);return;}
  const u=settings.units||'metric';
  try{
    const results=await Promise.all(names.slice(0,2).map(async name=>{const r=await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(name)}&appid=${OWM_KEY}&units=${u}&lang=ru`);const d=await r.json();return {name,data:r.ok&&Number(d.cod)===200?d:null,error:d.message||'Город не найден'};}));
    results.forEach((item,i)=>{
      const p=String(i+1),d=item.data;
      if(d){let windMs=d.wind.speed;if(settings.units==='imperial')windMs=d.wind.speed/2.237;$('compName'+p).textContent=`${d.name}, ${d.sys.country}`;$('compTemp'+p).textContent=Math.round(d.main.temp);$('compDesc'+p).textContent=d.weather?.[0]?.description||'—';$('compWind'+p).textContent=convertWind(windMs);$('compHum'+p).textContent=d.main.humidity+'%';}
      else{$('compName'+p).textContent=item.name+' (не найден)';$('compTemp'+p).textContent='--';$('compDesc'+p).textContent='—';$('compWind'+p).textContent='--';$('compHum'+p).textContent='--';}
    });
    const extraNames=names.slice(2);const box=$('wp10CompareExtra');if(box){box.innerHTML='';await Promise.all(extraNames.map((name,i)=>wp10CompareExtraCity(name,i+3)));}
    await renderCompareChart(names[0],names[1]);
  }catch(e){showNotification('Ошибка сравнения: '+(e.message||'не удалось загрузить погоду'),true);}
}
window.compareCities=compareCities;

async function renderCompareChart(c1, c2){
  const box = $('compareChartContainer');
  if(!box) return;
  try{
    const u = settings.units || 'metric';
    const [r1, r2] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(c1)}&appid=${OWM_KEY}&units=${u}&lang=ru`).then(x => x.json()),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(c2)}&appid=${OWM_KEY}&units=${u}&lang=ru`).then(x => x.json())
    ]);
    if(r1.cod !== '200' || r2.cod !== '200') return;
    const labels = [], t1 = [], t2 = [];
    const n = Math.min(r1.list.length, r2.list.length, 16);
    for(let i = 0; i < n; i += 2){
      const d = new Date(r1.list[i].dt * 1000);
      labels.push(d.toLocaleDateString('ru-RU', { weekday: 'short', hour: '2-digit' }));
      t1.push(Math.round(r1.list[i].main.temp));
      t2.push(Math.round(r2.list[i].main.temp));
    }
    box.classList.add('show');
    if(compareChartInst) compareChartInst.destroy();
    const ctx = $('compareChart').getContext('2d');
    compareChartInst = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: r1.city.name, data: t1, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', tension: .35, fill: true, pointRadius: 3 },
        { label: r2.city.name, data: t2, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.1)', tension: .35, fill: true, pointRadius: 3 }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: { y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.1)' } },
                  x: { ticks: { color: '#94a3b8', maxRotation: 45 }, grid: { display: false } } }
      }
    });
  }catch(e){ console.warn('compareChart', e); }
}

function showDayDetail(dayIndex){
  if(!lastForecastData || !lastForecastData.list) return;
  const daily = [];
  for(let i = 0; i < lastForecastData.list.length; i += 8) daily.push(i);
  const startIdx = daily[dayIndex];
  if(startIdx == null) return;
  const slice = lastForecastData.list.slice(startIdx, startIdx + 8);
  const d0 = new Date(slice[0].dt * 1000);
  const dayNames = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  $('dayDetailTitle').textContent = `${dayNames[d0.getDay()]}, ${d0.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  const labels = slice.map(f => formatHour(new Date(f.dt * 1000)));
  const temps = slice.map(f => Math.round(f.main.temp));
  const hums = slice.map(f => f.main.humidity);
  const winds = slice.map(f => Math.round(f.wind.speed));
  if(dayDetailChartInst) dayDetailChartInst.destroy();
  dayDetailChartInst = new Chart($('dayDetailChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Температура', data: temps, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)', tension: .35, fill: true, yAxisID: 'y' },
      { label: 'Влажность', data: hums, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.05)', tension: .35, fill: false, yAxisID: 'y1' }
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        y: { position: 'left', ticks: { color: '#3b82f6' }, grid: { color: 'rgba(148,163,184,.1)' } },
        y1: { position: 'right', ticks: { color: '#10b981' }, grid: { display: false } },
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
      }
    }
  });
  const tU = settings.units === 'metric' ? '°C' : '°F';
  const avg = slice.reduce((a, f) => a + f.main.temp, 0) / slice.length;
  const maxT = Math.max(...temps), minT = Math.min(...temps);
  const maxWind = Math.max(...winds);
  const rainProb = Math.round(Math.max(...slice.map(f => (f.pop || 0) * 100)));
  $('dayDetailList').innerHTML = `
    <div class="detail-item"><div class="detail-icon">${svg('i-thermometer')}</div><div class="detail-content"><div class="detail-label">Средняя</div><div class="detail-value">${Math.round(avg)}${tU}</div></div></div>
    <div class="detail-item"><div class="detail-icon">${svg('i-arrow-up')}</div><div class="detail-content"><div class="detail-label">Максимум</div><div class="detail-value">${maxT}${tU}</div></div></div>
    <div class="detail-item"><div class="detail-icon">${svg('i-arrow-down')}</div><div class="detail-content"><div class="detail-label">Минимум</div><div class="detail-value">${minT}${tU}</div></div></div>
    <div class="detail-item"><div class="detail-icon">${svg('i-wind')}</div><div class="detail-content"><div class="detail-label">Макс. ветер</div><div class="detail-value">${maxWind} м/с</div></div></div>
    <div class="detail-item" style="grid-column:1/-1"><div class="detail-icon">${svg('i-droplet')}</div><div class="detail-content"><div class="detail-label">Вероятность осадков</div><div class="detail-value">${rainProb}%</div></div></div>
  `;
  $('dayDetailModal').classList.add('show');
}
function closeDayDetail(){ $('dayDetailModal').classList.remove('show'); }
window.closeDayDetail=closeDayDetail;

/* ============================================================
   VOICE / NAV / NOTIF
   ============================================================ */

function initVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ $('voiceBtn').style.display='none'; return; }
  recognition=new SR(); recognition.lang=lang==='ru'?'ru-RU':'en-US';
  recognition.onresult=e=>{
    const t=e.results[0][0].transcript;
    $('cityInput').value=t; getWeather(t); addToSearch(t); showNotification('Голос: '+t); stopVoice();
  };
  recognition.onerror=()=>stopVoice(); recognition.onend=()=>stopVoice();
}
function startVoiceSearch(){
  if(!recognition){showNotification('Голосовой поиск недоступен',true);return;}
  if(listening){stopVoice();return;}
  try{
    recognition.lang=lang==='ru'?'ru-RU':'en-US'; recognition.start();
    listening=true; $('voiceBtn').classList.add('listening');
    $('voiceBtn').innerHTML=svg('i-stop');
  }catch(e){}
}
window.startVoiceSearch=startVoiceSearch;
function stopVoice(){
  if(recognition){try{recognition.stop();}catch(e){}}
  listening=false; $('voiceBtn').classList.remove('listening');
  $('voiceBtn').innerHTML=svg('i-mic');
}


function toggleNavGroup(groupId, trigger){
  const links=document.getElementById('navLinks');
  if(links?.classList.contains('mobile-open')) return;
  const target=document.querySelector(`.nav-group[data-nav-group="${groupId}"]`);
  if(!target) return;
  const shouldOpen=!target.classList.contains('open');
  document.querySelectorAll('.nav-group').forEach(group=>{
    group.classList.remove('open');
    const btn=group.querySelector('.nav-group-trigger');
    if(btn) btn.setAttribute('aria-expanded','false');
  });
  if(shouldOpen){
    target.classList.add('open');
    const btn=trigger||target.querySelector('.nav-group-trigger');
    if(btn) btn.setAttribute('aria-expanded','true');
  }
  // The nav-links surface uses backdrop-filter and therefore forms its own
  // stacking context. Raise that whole surface while a desktop dropdown is open.
  document.querySelector('.navbar')?.classList.toggle('nav-group-open',shouldOpen);
}
function filterNavCatalog(value){
  const query=String(value||'').trim().toLocaleLowerCase();
  let total=0;
  document.querySelectorAll('#navLinks .nav-group').forEach(group=>{
    const title=(group.querySelector('.nav-group-trigger')?.textContent||'').toLocaleLowerCase();
    const groupMatch=!!query && title.includes(query);
    let visible=0;
    group.querySelectorAll('.nav-link[data-page]').forEach(link=>{
      const match=!query || groupMatch || link.textContent.toLocaleLowerCase().includes(query);
      link.hidden=!match;
      if(match) visible++;
    });
    group.hidden=visible===0;
    total+=visible;
  });
  const empty=document.getElementById('navCatalogEmpty');
  if(empty) empty.hidden=total!==0;
}
window.filterNavCatalog=filterNavCatalog;
function toggleNavCatalog(force){
  const links=document.getElementById('navLinks');
  const scrim=document.getElementById('navCatalogScrim');
  const toggle=document.querySelector('.bottom-nav-item.catalog-toggle');
  if(!links) return;
  const open=typeof force==='boolean'?force:!links.classList.contains('mobile-open');
  links.classList.toggle('mobile-open',open);
  document.body.classList.toggle('wp91-catalog-open',open);
  document.querySelector('.container')?.classList.toggle('wp91-catalog-layer',open);
  document.querySelector('.navbar')?.classList.toggle('wp91-catalog-active',open);
  if(scrim) scrim.classList.toggle('show',open);
  if(toggle){toggle.setAttribute('aria-expanded',String(open));toggle.classList.toggle('active',open);}
  links.setAttribute('aria-modal',open?'true':'false');
  links.setAttribute('role',open?'dialog':'navigation');
  if(open){
    document.querySelectorAll('.nav-group').forEach(group=>{
      group.classList.add('open');
      const btn=group.querySelector('.nav-group-trigger');
      if(btn) btn.setAttribute('aria-expanded','true');
    });
    const search=document.getElementById('navCatalogSearch');
    if(search) search.value='';
    filterNavCatalog('');
    // Keep the catalog in its calm default state; search receives focus only after a deliberate tap.
    const activePage=document.querySelector('.page.active')?.id?.replace(/-page$/,'');
    if(activePage){document.querySelectorAll('#navLinks .nav-link[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page===activePage));syncNavGroupState(activePage);}
  }else{
    document.querySelectorAll('.nav-group').forEach(group=>{
      group.classList.remove('open');
      const btn=group.querySelector('.nav-group-trigger');
      if(btn) btn.setAttribute('aria-expanded','false');
      group.querySelectorAll('.nav-link[hidden]').forEach(link=>link.hidden=false);
      group.hidden=false;
    });
    const empty=document.getElementById('navCatalogEmpty');if(empty)empty.hidden=true;
    document.querySelector('.navbar')?.classList.remove('nav-group-open');
  }
}
function syncNavGroupState(pageId){
  document.querySelectorAll('.nav-group-trigger').forEach(btn=>btn.classList.remove('active'));
  const current=document.querySelector(`.nav-link[data-page="${pageId}"]`);
  const group=current?.closest('.nav-group');
  const trigger=group?.querySelector('.nav-group-trigger');
  if(trigger) trigger.classList.add('active');
}
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    toggleNavCatalog(false);
    document.querySelectorAll('.nav-group.open').forEach(group=>group.classList.remove('open'));
    document.querySelectorAll('.nav-group-trigger').forEach(btn=>btn.setAttribute('aria-expanded','false'));
    document.querySelector('.navbar')?.classList.remove('nav-group-open');
  }
});
document.addEventListener('click',event=>{
  if(event.target.closest('.nav-group') || event.target.closest('.bottom-nav-item.catalog-toggle') || event.target.closest('#navLinks.mobile-open')) return;
  document.querySelectorAll('.nav-group.open').forEach(group=>group.classList.remove('open'));
  document.querySelectorAll('.nav-group-trigger').forEach(btn=>btn.setAttribute('aria-expanded','false'));
  document.querySelector('.navbar')?.classList.remove('nav-group-open');
});

function showPage(id){
  const targetPage=document.getElementById(id+'-page');
  if(!targetPage){console.warn('[Weather Pro] Unknown page:',id);return false;}
  if(id!=='game' && typeof window.wp17GamePageClosed==='function') window.wp17GamePageClosed();
  if(id!=='chat' && activeChatId){if(typeof wpPushSetChatPresence==='function')wpPushSetChatPresence(activeChatId,false);if(activeChatUnsubscribe){activeChatUnsubscribe();activeChatUnsubscribe=null;}if(activeChatReadUnsubscribe){activeChatReadUnsubscribe();activeChatReadUnsubscribe=null;}activeChatId=null;activeChatOtherUid=null;activeChatMessagesCache=[];activeChatOtherReadAt=null;activeChatOtherDeliveredAt=null;}
  if(id!=='engine'){if(typeof wp104StopCamera==='function'){wp104StopCamera();wp104StopMic();if(wp104AudioContext){wp104AudioContext.close().catch(()=>{});wp104AudioContext=null;}wp104StopDisplayTest();}if(typeof wp10StopSensors==='function'&&typeof wp10SensorsActive!=='undefined'&&wp10SensorsActive)wp10StopSensors();if(typeof wp10MonitorTimer!=='undefined'&&wp10MonitorTimer&&typeof wp10ToggleMonitor==='function')wp10ToggleMonitor();}
  if((id==='profile'||id==='settings') && (fbUser||fbAuth?.currentUser)){
    const restoredUser=fbUser||fbAuth.currentUser;
    if(restoredUser){fbUser=restoredUser;wp6AdoptFirebaseIdentity(restoredUser);}
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  targetPage.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.page===id));
  syncNavGroupState(id);
  toggleNavCatalog(false);
  if(id==='home') loadWeather();
  if(id==='ai') wp80Init();
  if(id==='planet') wp70Init();
  if(id==='planner') renderSmartPlanner();
  if(id==='activities') renderActivityScores();
  if(id==='smart-alerts'){syncSmartAlertControls();if(lastWeatherData&&lastForecastData)evaluateSmartWeatherAlerts(lastWeatherData,lastForecastData);}
  if(id==='route'){wp5DefaultRouteTime();setTimeout(()=>wp5RouteMap&&wp5RouteMap.invalidateSize(),180);}
  if(id==='favorites') renderFavorites();
  if(id==='widget') updateWidget();
  if(id==='compare') compareCities();
  if(id==='history'){ loadHistoryData(); loadHistory(); }
  if(id==='people' && $('peopleResults').innerHTML==='') $('peopleResults').innerHTML='<div class="person-empty">Введите имя или email</div>';
  if(id==='people') wp6WaitForAuth().then(user=>{if(user){fbUser=user;wp6AdoptFirebaseIdentity(user);loadSocialHub();}});
  if(id==='map') setTimeout(()=>{ mapInst && mapInst.invalidateSize(); if(currentRadarMode) updateRadarFrame(radarCurrentIdx); if(typeof wp13Resize3DMap==='function')wp13Resize3DMap(); },200);
  if(id==='intelligence'){wp6RenderIntelligence();if(wp10Prefs.autoBrief!==false)wp10RefreshAIForecast(false);}
  if(id==='stats')wp10RefreshStats(false);
  if(id==='globe') wp6StartGlobe(); else wp6StopGlobe();
  if(id==='community'){wp6InitCommunityMap();wp6LoadCommunity();}
  if(id==='emergency') wp6LoadEmergency();
  if(id==='confidence' && !WP6_STATE.confidenceLoaded) wp6LoadConfidence();
  if(id==='life') wp6RenderLife();
  if(id==='studio') wp6LoadStudio();
  if(id==='engine'){wp6RunDiagnostics();wp10InitDeviceEngine();wp10RefreshDeviceInfo();wp104InitMax();if(typeof wp14RefreshPanels==='function')setTimeout(wp14RefreshPanels,80);}
  if(id==='command-center' && typeof window.wp17CommandCenterOpened==='function') window.wp17CommandCenterOpened();
  if(id==='game' && typeof window.wp17GamePageOpened==='function') window.wp17GamePageOpened();
  $('userMenu').classList.remove('show');
  window.scrollTo({top:0,behavior:'smooth'});
  updateBottomNav(id);
  return true;
}
window.showPage=showPage;
function toggleUserMenu(e){ e?.stopPropagation(); $('userMenu').classList.toggle('show'); }
window.toggleUserMenu=toggleUserMenu;
document.addEventListener('click',e=>{
  if(!$('userProfile').contains(e.target) && !$('userMenu').contains(e.target))
    $('userMenu').classList.remove('show');
});
function showSaveIndicator(){ $('saveIndicator').classList.add('show'); setTimeout(()=>$('saveIndicator').classList.remove('show'),1800); }
function updateCurrentTime(){
  const now=new Date();
  const o={weekday:'long',year:'numeric',month:'long',day:'numeric'};
  $('currentTime').textContent=now.toLocaleDateString('ru-RU',o)+', '+formatTime(now);
}
function showLoading(s){ if(s){$('weatherContent').style.display='none';$('loading').style.display='block';} else {$('loading').style.display='none';$('weatherContent').style.display='block';} }
function showNotification(msg,isErr=false){
  $('notificationText').textContent=msg;
  const n=$('notification'); const i=n.querySelector('svg use');
  if(isErr){ n.style.borderLeftColor='var(--danger)'; i.setAttribute('href','#i-alert-circle'); i.parentElement.style.color='var(--danger)'; }
  else { n.style.borderLeftColor='var(--success)'; i.setAttribute('href','#i-check-circle'); i.parentElement.style.color='var(--success)'; }
  n.classList.add('show');
  clearTimeout(n._t); n._t=setTimeout(()=>n.classList.remove('show'),3000);
}
window.showNotification=showNotification;
function updateBottomNav(pageId){
  const aliases={
    home:'home', map:'map', globe:'map', planet:'map',
    ai:'ai', intelligence:'ai',
    people:'people', community:'people',
    profile:'profile', settings:'profile', auth:'profile'
  };
  const activeId=Object.prototype.hasOwnProperty.call(aliases,pageId)?aliases[pageId]:'';
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(b=>{
    if(b.dataset.page==='catalog') { b.classList.remove('active'); b.setAttribute('aria-expanded','false'); return; }
    const active=b.dataset.page===activeId;
    b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
}

