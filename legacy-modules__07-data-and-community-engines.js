/* Weather Pro V16 module: 07-data-and-community-engines.js — extracted from the existing app script. */
/* ============================================================
   WEATHER PRO 6.0.1 — WEATHER OS MODULES
   ============================================================ */
const WP6_STATE={globe:null,globeTimer:null,communityMap:null,communityMarkers:null,communityLoaded:false,confidenceLoaded:false,confidenceBusy:false,lastConfidence:null,officialWarnings:[],diagnosticsAt:null};
const WP6_REPORT_TYPES={rain:{label:'Дождь / ливень',icon:'fa-cloud-rain'},ice:{label:'Гололёд',icon:'fa-snowflake'},fog:{label:'Туман',icon:'fa-smog'},wind:{label:'Сильный ветер',icon:'fa-wind'},snow:{label:'Снег / метель',icon:'fa-snowflake'},flood:{label:'Подтопление',icon:'fa-water'},other:{label:'Другое',icon:'fa-circle-info'}};
const WP6_MODELS=[{id:'ecmwf_ifs025',label:'ECMWF IFS'},{id:'ncep_gfs_seamless',label:'NOAA GFS'},{id:'icon_seamless',label:'DWD ICON'}];
const WP6_METEOALARM={EE:'estonia',FI:'finland',LV:'latvia',LT:'lithuania',SE:'sweden',NO:'norway',DK:'denmark',DE:'germany',PL:'poland',FR:'france',NL:'netherlands',BE:'belgium',AT:'austria',CH:'switzerland',CZ:'czechia',SK:'slovakia',SI:'slovenia',HR:'croatia',IT:'italy',ES:'spain',PT:'portugal',GB:'united-kingdom',IE:'ireland',IS:'iceland',HU:'hungary',RO:'romania',BG:'bulgaria',GR:'greece',CY:'cyprus',MT:'malta',LU:'luxembourg',RS:'serbia',BA:'bosnia-herzegovina',ME:'montenegro',MK:'republic-of-north-macedonia',MD:'moldova',UA:'ukraine'};
function wp6FmtTime(date){return new Date(date).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
function wp6ForecastItems(hours=24){return (lastForecastData?.list||[]).filter(x=>x?.dt*1000>=Date.now()).slice(0,Math.max(1,Math.ceil(hours/3)));}
function wp6TempC(v){return (settings.units||'metric')==='metric'?Number(v):(Number(v)-32)*5/9;}
function wp6WindMs(v){return (settings.units||'metric')==='metric'?Number(v):Number(v)/2.237;}
function wp6Comfort(tC,windMs,rain){let score=100;score-=Math.min(36,Math.abs(tC-18)*1.8);score-=Math.min(24,windMs*1.6);score-=Math.min(40,rain*.55);return Math.max(0,Math.min(100,Math.round(score)));}
function wp6SetText(id,value){const el=$(id);if(el)el.textContent=value;}
function wp6RefreshWeather(current=lastWeatherData,forecast=lastForecastData){
  if(!current||!forecast)return;
  wp6RenderIntelligence();wp6RenderLife();wp6RenderLocalRisks();
  const home=$('wp6HomeInsight');if(home){const first=wp6BuildInsightData(current,forecast);home.textContent=first.summary;}
  const engine=$('wp6HomeEngine');if(engine)engine.textContent=(navigator.onLine?'Сеть доступна':'Офлайн')+' · '+(fbReady?'Firebase подключён':'Firebase недоступен')+' · погодный прогноз получен';
  if($('globe-page')?.classList.contains('active'))wp6GlobeDraw();
  if($('emergency-page')?.classList.contains('active'))wp6RenderLocalRisks();
  if($('life-page')?.classList.contains('active'))wp6RenderLife();
}
function wp6BuildInsightData(current,forecast){
  const items=wp6ForecastItems(24),unit=(settings.units||'metric')==='metric'?'°C':'°F';
  const t=Math.round(Number(current.main.temp)),feels=Math.round(Number(current.main.feels_like));
  const rainPeak=items.reduce((best,x)=>Math.max(best,Math.round((x.pop||0)*100)),0);
  const rainAt=items.find(x=>Math.round((x.pop||0)*100)>=50);
  const maxWind=Math.max(wp6WindMs(current.wind?.speed||0),...items.map(x=>wp6WindMs(x.wind?.speed||0)));
  const minTemp=items.length?Math.min(...items.map(x=>wp6TempC(x.main.temp_min??x.main.temp))):wp6TempC(t);
  const maxTemp=items.length?Math.max(...items.map(x=>wp6TempC(x.main.temp_max??x.main.temp))):wp6TempC(t);
  let summary=`${current.name||currentCity}: сейчас ${current.weather?.[0]?.description||'погодные условия обновлены'}, ${t>0?'+':''}${t}${unit}, ощущается как ${feels}${unit}.`;
  if(rainAt)summary+=` Окно повышенного риска осадков начинается около ${new Date(rainAt.dt*1000).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}.`;
  else summary+=' В доступных прогнозных интервалах вероятность осадков ниже 50%.';
  if(maxWind>=10)summary+=` Ветер может усиливаться до ${maxWind.toFixed(1)} м/с.`;
  const advice=[];
  if(rainPeak>=50)advice.push({icon:'fa-umbrella',title:'Подготовьтесь к осадкам',text:`Максимальная вероятность осадков в выбранных интервалах — ${rainPeak}%. Планируйте непромокаемую одежду.`});
  else advice.push({icon:'fa-cloud-sun',title:'Осадки не выглядят главным фактором',text:`Наивысшая вероятность осадков в ближайших 24 часах — ${rainPeak}%. Это не исключает локальный дождь.`});
  if(maxWind>=8)advice.push({icon:'fa-wind',title:'Учитывайте ветер',text:`Ожидаемый максимум по текущему прогнозу — ${maxWind.toFixed(1)} м/с. На открытых участках будет менее комфортно.`});
  if(minTemp<=2)advice.push({icon:'fa-temperature-low',title:'Холодные часы',text:`Минимум прогнозного диапазона около ${Math.round(minTemp)}°C. Учитывайте риск замерзания влаги и охлаждения.`});
  if(maxTemp>=27)advice.push({icon:'fa-sun',title:'Тёплый период',text:`Максимум может достигнуть ${Math.round(maxTemp)}°C. Держите воду под рукой и ищите тень.`});
  if(!advice.length)advice.push({icon:'fa-check-circle',title:'Выраженных сигналов в прогнозе немного',text:'Погода выглядит относительно спокойной по выбранным параметрам. Проверяйте обновления перед выходом.'});
  const score=wp6Comfort(wp6TempC(current.main.temp),wp6WindMs(current.wind?.speed||0),rainPeak);
  return {summary,advice,score,rainPeak,maxWind,minTemp,maxTemp,items};
}
function wp6RenderIntelligence(){
  const current=lastWeatherData,forecast=lastForecastData;
  if(!current||!forecast){wp6SetText('wp6BriefSummary','Сначала загрузите актуальный прогноз на главной странице.');return;}
  const d=wp6BuildInsightData(current,forecast);
  wp6SetText('wp6BriefMeta',`${current.name||currentCity} · анализ обновлён ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · ближайшие 24 часа`);
  wp6SetText('wp6BriefSummary',d.summary);
  const cards=[['Комфорт',d.score+'/100','Оценка температуры, ветра и вероятности осадков'],['Риск осадков',d.rainPeak+'%','Максимум среди доступных прогнозных интервалов'],['Ветер',d.maxWind.toFixed(1)+' м/с','Максимум по текущим данным и ближайшим срокам']];
  const grid=$('wp6InsightGrid');if(grid)grid.innerHTML=cards.map(x=>`<article class="wp6-card"><div class="wp6-kicker">${esc(x[0])}</div><div class="wp6-value">${esc(x[1])}</div><p>${esc(x[2])}</p></article>`).join('');
  const list=$('wp6AdviceList');if(list)list.innerHTML=d.advice.map(a=>`<div class="wp6-list-item"><div class="wp6-list-icon">${wp5FaIcon(a.icon)}</div><div><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p></div></div>`).join('');
  const home=$('wp6HomeInsight');if(home)home.textContent=d.summary;
}
function wp6RenderLife(){
  const grid=$('wp6LifeGrid');if(!grid)return;
  if(!lastWeatherData||!lastForecastData){grid.innerHTML='<div class="wp5-empty">Загрузите прогноз для выбранного города.</div>';return;}
  const mode=$('wp6LifeMode')?.value||'sport',items=wp6ForecastItems(48);
  const profiles={sport:{title:'Спорт и тренировки',icon:'fa-person-biking',desc:'Умеренная температура, слабый ветер и низкий риск осадков.',ideal:[8,22],wind:8,rain:25},travel:{title:'Путешествия',icon:'fa-suitcase-rolling',desc:'Комфорт для перемещения и прогулок, без сильных осадков.',ideal:[10,25],wind:10,rain:35},garden:{title:'Сад и растения',icon:'fa-seedling',desc:'Оцениваются холод, жара и осадки; это не агрономический прогноз.',ideal:[8,26],wind:9,rain:65},home:{title:'Дом и дела',icon:'fa-house',desc:'Оценка удобства обычных дел вне дома и кратких поездок.',ideal:[5,27],wind:12,rain:45},outdoor:{title:'Активности на улице',icon:'fa-person-hiking',desc:'Общий комфорт для прогулок, отдыха и активностей на открытом воздухе.',ideal:[10,24],wind:8,rain:25}};
  const p=profiles[mode],rank=items.map(x=>{const t=wp6TempC(x.main.temp),w=wp6WindMs(x.wind?.speed||0),r=(x.pop||0)*100;let sc=100;sc-=Math.max(0,p.ideal[0]-t)*2.4;sc-=Math.max(0,t-p.ideal[1])*2.2;sc-=Math.max(0,w-p.wind)*3;sc-=Math.max(0,r-p.rain)*.65;return {x,score:Math.max(0,Math.min(100,Math.round(sc))),t,w,r};}).sort((a,b)=>b.score-a.score);
  const best=rank.slice(0,3);grid.innerHTML=best.length?best.map((v,i)=>`<article class="wp6-card"><div class="wp6-kicker">${i===0?'ЛУЧШЕЕ ОКНО':i===1?'АЛЬТЕРНАТИВА':'ЕЩЁ ВАРИАНТ'}</div><h3>${esc(p.title)}</h3><div class="wp6-value">${v.score}/100</div><div class="wp6-meter"><span style="width:${v.score}%"></span></div><p style="margin-top:10px">${wp6FmtTime(v.x.dt*1000)} · ${Math.round(v.x.main.temp)}° · осадки ${v.r}% · ветер ${v.w.toFixed(1)} м/с</p></article>`).join(''):'<div class="wp5-empty">Недостаточно прогнозных точек.</div>';
  const avg=best.length?Math.round(best.reduce((a,b)=>a+b.score,0)/best.length):0;
  wp6SetText('wp6LifeAdvice',`${p.title}: ${avg>=75?'условия в целом благоприятные':avg>=50?'есть погодные компромиссы':'лучше рассмотреть другое время'}. ${p.desc} Не используйте этот индекс как гарантию безопасности.`);
  const win=$('wp6LifeWindows');if(win)win.innerHTML=best.map(v=>`<div class="wp6-list-item"><div class="wp6-list-icon">${wp5FaIcon(p.icon)}</div><div><strong>${wp6FmtTime(v.x.dt*1000)} · ${v.score}/100</strong><p>${Math.round(v.x.main.temp)}° · осадки ${v.r}% · ветер ${v.w.toFixed(1)} м/с</p></div></div>`).join('');
}

/* 3D globe: D3 orthographic projection + public Natural Earth topology. */
async function wp6LoadLibrary(urls, isReady, label){
  if(isReady()) return;
  let lastError=null;
  for(const src of urls){
    if(isReady()) return;
    try{
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=src;script.async=true;script.crossOrigin='anonymous';
        const timeout=setTimeout(()=>{script.remove();reject(new Error('тайм-аут загрузки '+label));},12000);
        script.onload=()=>{clearTimeout(timeout);isReady()?resolve():reject(new Error('API '+label+' не найдено после загрузки'));};
        script.onerror=()=>{clearTimeout(timeout);script.remove();reject(new Error('CDN недоступен: '+new URL(src).host));};
        document.head.appendChild(script);
      });
    }catch(error){lastError=error;console.warn('[WeatherPro/Globe] CDN fallback:',src,error.message);}
  }
  if(!isReady()) throw new Error(label+' недоступна. '+(lastError?.message||'Проверьте интернет-соединение.'));
}

async function wp6EnsureGlobeLibraries(){
  await wp6LoadLibrary([
    'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js',
    'https://unpkg.com/d3@7.9.0/dist/d3.min.js'
  ],()=>!!(window.d3&&typeof window.d3.geoOrthographic==='function'&&typeof window.d3.geoPath==='function'&&typeof window.d3.geoGraticule10==='function'),'D3 Geo');
  await wp6LoadLibrary([
    'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js',
    'https://unpkg.com/topojson-client@3/dist/topojson-client.min.js'
  ],()=>!!(window.topojson&&typeof window.topojson.feature==='function'),'TopoJSON');
}

async function wp6FetchWorldTopology(){
  const urls=[
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
    'https://unpkg.com/world-atlas@2/countries-110m.json'
  ];
  let lastError=null;
  for(const url of urls){
    try{
      const response=await fetch(url,{cache:'force-cache'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const topo=await response.json();
      if(!topo?.objects?.countries)throw new Error('Некорректная географическая подложка');
      return topo;
    }catch(error){lastError=error;console.warn('[WeatherPro/Globe] Не удалось загрузить подложку:',url,error.message);}
  }
  throw new Error('Географическая подложка недоступна. '+(lastError?.message||''));
}

async function wp6StartGlobe(){
  wp6StopGlobe();
  const status=$('wp6GlobeStatus');if(!status)return;
  status.textContent='Подключаем географические библиотеки…';
  try{
    await wp6EnsureGlobeLibraries();
    if(!WP6_STATE.globe?.countries){
      const topo=await wp6FetchWorldTopology();
      const countries=window.topojson.feature(topo,topo.objects.countries);
      const previous=WP6_STATE.globe||{};
      WP6_STATE.globe={...previous,countries,rotation:previous.rotation||[0,-12,0],spin:previous.spin!==false,drag:false};
    }
    if(!wp6GlobeDraw())throw new Error('D3 Geo не предоставил необходимые функции проекции.');
    const spin=$('wp6GlobeSpin');if(spin)spin.checked=WP6_STATE.globe.spin!==false;
    if(WP6_STATE.globe.spin!==false){
      WP6_STATE.globeTimer=setInterval(()=>{
        if(wpPerformanceShouldPause()||!$('globe-page')?.classList.contains('active'))return;
        WP6_STATE.globe.rotation[0]+=.16;wp6GlobeDraw();
      },90);
    }
  }catch(e){
    console.warn('[WeatherPro/Globe]',e);
    status.textContent='Глобус не загрузился: '+(e.message||'ошибка загрузки библиотек');
  }
}
function wp6StopGlobe(){if(WP6_STATE.globeTimer){clearInterval(WP6_STATE.globeTimer);WP6_STATE.globeTimer=null;}}
function wp6SetGlobeSpin(on){
  if(!WP6_STATE.globe)return;
  WP6_STATE.globe.spin=!!on;
  if(on){wp6StopGlobe();WP6_STATE.globeTimer=setInterval(()=>{if(wpPerformanceShouldPause()||!$('globe-page')?.classList.contains('active'))return;WP6_STATE.globe.rotation[0]+=.16;wp6GlobeDraw();},90);}
  else wp6StopGlobe();
}
function wp6GlobeReset(){if(!WP6_STATE.globe)return;WP6_STATE.globe.rotation=[0,-12,0];wp6GlobeDraw();}
function wp6GlobeDraw(){
  const canvas=$('wp6GlobeCanvas'),state=WP6_STATE.globe,d3Api=window.d3;
  if(!canvas||!state?.countries)return false;
  if(!d3Api||typeof d3Api.geoOrthographic!=='function'||typeof d3Api.geoPath!=='function'||typeof d3Api.geoGraticule10!=='function'){
    const status=$('wp6GlobeStatus');if(status)status.textContent='Библиотека D3 Geo загружена не полностью. Перезагрузите страницу.';
    return false;
  }
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,scale=Math.min(w,h)*.405;
  ctx.clearRect(0,0,w,h);
  const grad=ctx.createRadialGradient(cx,cy,scale*.12,cx,cy,scale*1.8);grad.addColorStop(0,'rgba(24,61,105,.2)');grad.addColorStop(1,'rgba(2,8,17,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  const projection=d3Api.geoOrthographic().translate([cx,cy]).scale(scale).clipAngle(90).precision(.45).rotate(state.rotation);
  const path=d3Api.geoPath(projection,ctx),sphere={type:'Sphere'};
  ctx.beginPath();path(sphere);ctx.fillStyle='#102b49';ctx.fill();ctx.strokeStyle='rgba(125,190,255,.5)';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();path(d3Api.geoGraticule10());ctx.strokeStyle='rgba(148,197,239,.18)';ctx.lineWidth=.7;ctx.stroke();
  ctx.beginPath();path(state.countries);ctx.fillStyle='#244d70';ctx.fill();ctx.strokeStyle='rgba(150,195,228,.36)';ctx.lineWidth=.55;ctx.stroke();
  const points=[];
  if(lastWeatherData?.coord)points.push({name:currentCity||lastWeatherData.name,lat:lastWeatherData.coord.lat,lon:lastWeatherData.coord.lon,temp:lastWeatherData.main?.temp,active:true});
  try{getFavs().forEach(city=>{const c=cacheGet(city);if(c?.current?.coord&&(!lastWeatherData||city!==currentCity))points.push({name:city,lat:c.current.coord.lat,lon:c.current.coord.lon,temp:c.current.main?.temp});});}catch(e){}
  points.forEach(p=>{
    const xy=projection([p.lon,p.lat]);if(!xy)return;
    ctx.beginPath();ctx.arc(xy[0],xy[1],p.active?7:4.5,0,Math.PI*2);ctx.fillStyle=p.active?'#fbbf24':'#60a5fa';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.3;ctx.stroke();
    if(p.active){ctx.font='600 13px Inter, sans-serif';ctx.fillStyle='#fff';ctx.shadowColor='#06111f';ctx.shadowBlur=6;ctx.fillText(`${p.name} · ${Number.isFinite(Number(p.temp))?Math.round(Number(p.temp))+'°':'—'}`,xy[0]+12,xy[1]-9);ctx.shadowBlur=0;}
  });
  const status=$('wp6GlobeStatus');if(status)status.textContent=`Географическая подложка загружена · точек с сохранёнными координатами: ${points.length}. Перетаскивайте глобус для вращения.`;
  if(!canvas.dataset.dragBound){
    let dragging=false,lastX=0,lastY=0;
    canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!dragging||!WP6_STATE.globe)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;WP6_STATE.globe.rotation[0]+=dx*.35;WP6_STATE.globe.rotation[1]-=dy*.35;WP6_STATE.globe.rotation[1]=Math.max(-85,Math.min(85,WP6_STATE.globe.rotation[1]));wp6GlobeDraw();});
    canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);canvas.dataset.dragBound='1';
  }
  return true;
}

/* Community reports live in Firestore; no Storage uploads are involved. */
function wp6InitCommunityMap(){
  const el=$('wp6CommunityMap');if(!el||!window.L)return;
  if(!WP6_STATE.communityMap){WP6_STATE.communityMap=L.map(el,{zoomControl:true}).setView(lastWeatherData?.coord?[lastWeatherData.coord.lat,lastWeatherData.coord.lon]:[59.437,24.7536],7);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(WP6_STATE.communityMap);WP6_STATE.communityMarkers=L.layerGroup().addTo(WP6_STATE.communityMap);}else setTimeout(()=>WP6_STATE.communityMap.invalidateSize(),120);
  setTimeout(()=>WP6_STATE.communityMap?.invalidateSize(),160);
}
function wp6RenderCommunity(docs){
  const feed=$('wp6CommunityFeed');if(!feed)return;
  const now=Date.now(),reports=docs.filter(x=>x.expiresAt?.toDate?x.expiresAt.toDate().getTime()>now:(x.expiresAt?.seconds||0)*1000>now);
  if(!reports.length)feed.innerHTML='<div class="wp5-empty">Пока нет активных наблюдений. Вы можете добавить первое сообщение.</div>';
  else feed.innerHTML=reports.map(r=>{const t=WP6_REPORT_TYPES[r.type]||WP6_REPORT_TYPES.other;const when=r.createdAt?.toDate?wp6FmtTime(r.createdAt.toDate()):'Недавно';return `<article class="wp6-report"><div class="wp6-report-head"><strong>${wp5FaIcon(t.icon)} ${esc(t.label)} · ${esc(r.city||'Локация')}</strong><time>${esc(when)}</time></div><p>${esc(r.description||'')}</p><div class="wp6-map-note">Автор: ${esc(r.displayName||'Пользователь')}</div></article>`;}).join('');
  if(WP6_STATE.communityMarkers){WP6_STATE.communityMarkers.clearLayers();reports.forEach(r=>{if(typeof r.lat!=='number'||typeof r.lon!=='number')return;const t=WP6_REPORT_TYPES[r.type]||WP6_REPORT_TYPES.other;L.circleMarker([r.lat,r.lon],{radius:8,color:'#60a5fa',fillColor:'#3b82f6',fillOpacity:.8,weight:2}).bindPopup(`<strong>${esc(t.label)}</strong><br>${esc(r.city||'')}<br>${esc(r.description||'')}`).addTo(WP6_STATE.communityMarkers);});if(reports.some(r=>typeof r.lat==='number')){const first=reports.find(r=>typeof r.lat==='number');WP6_STATE.communityMap.setView([first.lat,first.lon],8);}}
  wp6SetText('wp6CommunityStatus',`${reports.length} активных наблюдений · сообщения старше 6 часов скрыты.`);
}
async function wp6LoadCommunity(){
  const feed=$('wp6CommunityFeed');if(!feed)return;
  const authUser=await wp6WaitForAuth();
  if(!fbReady||!authUser){
    feed.innerHTML='<div class="wp6-status warn">Firebase не подтвердил вход. Нажмите на профиль → «Войти через Google» и завершите вход в этом же браузере.</div>';
    wp6SetText('wp6CommunityStatus','Требуется активная сессия Google в Firebase.');
    return;
  }
  fbUser=authUser;wp6AdoptFirebaseIdentity(authUser);
  feed.innerHTML='<div class="wp5-empty">Загружаем сообщения сообщества…</div>';
  try{
    const snap=await fbDb.collection('weatherReports').orderBy('createdAt','desc').limit(60).get();
    if(fbUser?.uid!==authUser.uid)return;
    const docs=snap.docs.map(d=>d.data());wp6RenderCommunity(docs);WP6_STATE.communityLoaded=true;
  }catch(e){
    console.error('[WeatherPro/Community]',e);
    const code=e.code||e.message;
    feed.innerHTML=`<div class="wp6-status warn">Не удалось прочитать ленту: ${esc(code)}. Проверьте Firestore Rules для коллекции weatherReports.</div>`;
  }
}
async function wp6SubmitReport(event){
  event?.preventDefault();
  const submitButton=event?.submitter||document.querySelector('.wp6-report-form button[type="submit"]');
  if(submitButton?.disabled)return;
  if(submitButton)submitButton.disabled=true;
  try{
    const authUser=await wp6WaitForAuth();
    if(!fbReady||!authUser){
      showNotification('Firebase не видит активную сессию. Войдите по email или через Google в этом браузере.',true);
      return;
    }
    fbUser=authUser;wp6AdoptFirebaseIdentity(authUser);
    if(!lastWeatherData?.coord){showNotification('Сначала загрузите погоду с координатами города',true);return;}
    const type=$('wp6ReportType')?.value||'other';
    const city=String($('wp6ReportCity')?.value||currentCity||lastWeatherData.name||'').trim().slice(0,80);
    const description=String($('wp6ReportText')?.value||'').trim().slice(0,240);
    if(!city){showNotification('Укажите город или район',true);return;}
    if(description.length<3){showNotification('Добавьте короткое описание наблюдения',true);return;}
    const lat=Number(lastWeatherData.coord.lat),lon=Number(lastWeatherData.coord.lon);
    if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lon)||lon < -180||lon > 180){
      showNotification('Координаты погодного места некорректны. Обновите погоду.',true);return;
    }
    const payload={
      uid:authUser.uid,
      displayName:String(currentUser?.name||authUser.displayName||'Пользователь').slice(0,48),
      type,city,description,lat,lon,
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt:firebase.firestore.Timestamp.fromDate(new Date(Date.now()+6*60*60*1000))
    };
    await fbDb.collection('weatherReports').add(payload);
    const textarea=$('wp6ReportText');if(textarea)textarea.value='';
    showNotification('Наблюдение опубликовано');
    await wp6LoadCommunity();
  }catch(e){
    console.error('[WeatherPro/Community] publish',e);
    const code=e.code||e.message||'unknown';
    showNotification(code==='permission-denied'?'Firebase отклонил публикацию. Обновите Firestore Rules из файла rules.txt.':'Ошибка публикации: '+code,true);
  }finally{if(submitButton)submitButton.disabled=false;}
}
window.wp6SubmitReport=wp6SubmitReport;

/* Official warnings from country Atom feeds published by MeteoAlarm. */
async function wp6LoadEmergency(){
  const box=$('wp6OfficialAlerts');if(!box)return;
  wp6RenderLocalRisks();const country=String(lastWeatherData?.sys?.country||'EE').toUpperCase(),slug=WP6_METEOALARM[country];
  const feed=slug?`https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${slug}`:'https://feeds.meteoalarm.org/';
  const link=$('wp6MeteoAlarmLink');if(link){link.href=slug?feed:'https://www.meteoalarm.org/';link.textContent=slug?`Открыть официальную ленту ${country}`:'Открыть портал MeteoAlarm';}
  wp6SetText('wp6EmergencyMeta',`${lastWeatherData?.name||currentCity} · страна ${country} · источник MeteoAlarm`);
  if(!slug){box.innerHTML='<div class="wp6-status warn">Для страны активного города не найден прямой Atom feed в списке MeteoAlarm. Откройте общий портал и выберите страну вручную.</div>';return;}
  box.innerHTML='<div class="wp5-empty">Запрашиваем официальный канал предупреждений…</div>';
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    const res=await fetch(feed,{signal:controller.signal,cache:'no-store'});clearTimeout(timer);if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const xmlText=await res.text(),xml=new DOMParser().parseFromString(xmlText,'application/xml');if(xml.querySelector('parsererror'))throw new Error('Не удалось разобрать Atom feed');
    const entries=Array.from(xml.querySelectorAll('entry')).slice(0,20);
    if(!entries.length){box.innerHTML='<div class="wp6-status">В загруженной ленте сейчас нет активных записей. Это не отменяет необходимости проверять официальный национальный источник перед опасной погодой.</div>';return;}
    box.innerHTML=entries.map(entry=>{const title=entry.querySelector('title')?.textContent?.trim()||'Погодное предупреждение';const content=entry.querySelector('summary,content')?.textContent?.trim()||'';const updated=entry.querySelector('updated,published')?.textContent?.trim();const href=entry.querySelector('link[rel="alternate"]')?.getAttribute('href')||entry.querySelector('link')?.getAttribute('href')||feed;return `<article class="wp6-list-item"><div class="wp6-list-icon">${wp5FaIcon('fa-triangle-exclamation')}</div><div><strong>${esc(title)}</strong><p>${esc(content.slice(0,420))}</p><div class="wp6-map-note">${updated?esc(wp6FmtTime(new Date(updated))):'Время публикации не указано'} · <a class="wp6-source" href="${esc(href)}" target="_blank" rel="noopener">Источник</a></div></div></article>`;}).join('');
  }catch(e){console.warn('[WeatherPro/MeteoAlarm]',e);box.innerHTML=`<div class="wp6-status warn">Автоматически получить Atom feed не удалось (${esc(e.message)}). Возможна блокировка CORS или временная недоступность канала. Откройте официальный источник вручную: <a class="wp6-source" href="${esc(feed)}" target="_blank" rel="noopener">лента MeteoAlarm для ${country}</a>.</div>`;}
}
function wp6RenderLocalRisks(){
  const box=$('wp6LocalRisks');if(!box)return;
  if(!lastWeatherData||!lastForecastData){box.innerHTML='<div class="wp5-empty">Загрузите прогноз.</div>';return;}
  const items=wp6ForecastItems(24),risks=[];
  const rain=Math.max(0,...items.map(x=>(x.pop||0)*100)),wind=Math.max(wp6WindMs(lastWeatherData.wind?.speed||0),...items.map(x=>wp6WindMs(x.wind?.speed||0))),min=items.length?Math.min(...items.map(x=>wp6TempC(x.main.temp_min??x.main.temp))):wp6TempC(lastWeatherData.main.temp),desc=items.map(x=>String(x.weather?.[0]?.main||'')).join(' ').toLowerCase();
  if(rain>=70)risks.push(['fa-cloud-showers-heavy','Высокая вероятность осадков',`До ${Math.round(rain)}% в доступных прогнозных интервалах.`]);
  if(wind>=15)risks.push(['fa-wind','Сильный ветер',`Прогнозный максимум около ${wind.toFixed(1)} м/с.`]);
  if(min<=-2)risks.push(['fa-snowflake','Мороз и возможная скользкая поверхность',`Минимум прогнозного диапазона около ${Math.round(min)}°C.`]);
  if(/thunder/.test(desc))risks.push(['fa-bolt','Грозовые условия',`В прогнозе есть грозовые погодные коды. Следите за официальными предупреждениями.`]);
  box.innerHTML=risks.length?risks.map(r=>`<div class="wp6-list-item"><div class="wp6-list-icon">${wp5FaIcon(r[0])}</div><div><strong>${esc(r[1])}</strong><p>${esc(r[2])}</p></div></div>`).join(''):'<div class="wp6-status">По доступным данным не обнаружены выраженные локальные погодные сигналы из набора Weather Pro. Это не означает полного отсутствия риска.</div>';
}

/* Model agreement from Open-Meteo's model-selectable forecast API. */
async function wp6LoadConfidence(){
  const status=$('wp6ConfidenceStatus');if(!status)return;
  if(!lastWeatherData?.coord){status.textContent='Сначала загрузите город с координатами.';return;}
  if(WP6_STATE.confidenceBusy)return;WP6_STATE.confidenceBusy=true;status.className='wp6-status';status.textContent='Запрашиваем несколько моделей Open-Meteo…';
  try{
    const q=new URLSearchParams({latitude:lastWeatherData.coord.lat,longitude:lastWeatherData.coord.lon,hourly:'temperature_2m,wind_speed_10m',models:WP6_MODELS.map(x=>x.id).join(','),forecast_days:'3',timezone:'auto'});
    const r=await fetch('https://api.open-meteo.com/v1/forecast?'+q.toString(),{cache:'no-store'});if(!r.ok)throw new Error(`Open-Meteo HTTP ${r.status}`);const data=await r.json();
    const h=data.hourly||{},times=h.time||[];const rows=[];
    WP6_MODELS.forEach(model=>{
      const tempKey=Object.keys(h).find(k=>k.startsWith('temperature_2m_')&&k.toLowerCase().includes(model.id.replace('_','')))||Object.keys(h).find(k=>k.startsWith('temperature_2m_')&&k.includes(model.id));
      const windKey=Object.keys(h).find(k=>k.startsWith('wind_speed_10m_')&&k.includes(model.id));
      const temps=tempKey?(h[tempKey]||[]).slice(0,24).filter(Number.isFinite):[];const winds=windKey?(h[windKey]||[]).slice(0,24).filter(Number.isFinite):[];
      if(temps.length)rows.push({name:model.label,temp:temps.reduce((a,b)=>a+b,0)/temps.length,wind:winds.length?winds.reduce((a,b)=>a+b,0)/winds.length:null,temps});
    });
    if(rows.length<2){const keys=Object.keys(h).filter(k=>k.startsWith('temperature_2m_'));throw new Error('API вернул недостаточно отдельных модельных рядов ('+keys.join(', ')+').');}
    const spread=Math.max(...rows.map(x=>x.temp))-Math.min(...rows.map(x=>x.temp));const score=Math.max(0,Math.min(100,Math.round(100-spread*13)));WP6_STATE.lastConfidence={rows,spread,score,at:Date.now()};WP6_STATE.confidenceLoaded=true;
    const cards=$('wp6ConfidenceCards');if(cards)cards.innerHTML=`<article class="wp6-card"><div class="wp6-kicker">СОГЛАСОВАННОСТЬ</div><div class="wp6-value">${score}/100</div><div class="wp6-meter"><span style="width:${score}%"></span></div><p>Индикатор разброса средней температуры между моделями.</p></article><article class="wp6-card"><div class="wp6-kicker">РАЗБРОС ТЕМПЕРАТУРЫ</div><div class="wp6-value">${spread.toFixed(1)}°C</div><p>Разница между самым высоким и самым низким средним значением за 24 часа.</p></article><article class="wp6-card"><div class="wp6-kicker">МОДЕЛЕЙ ПОЛУЧЕНО</div><div class="wp6-value">${rows.length}</div><p>Из запрошенных ${WP6_MODELS.length} модельных источников.</p></article>`;
    const tb=$('wp6ModelRows');if(tb)tb.innerHTML=rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.temp.toFixed(1)} °C</td><td>${x.wind==null?'—':x.wind.toFixed(1)+' км/ч'}</td></tr>`).join('');
    const meta=`${lastWeatherData.name||currentCity} · первые 24 часа · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`;wp6SetText('wp6ConfidenceMeta',meta);status.textContent=score>=80?'Модели хорошо согласуются по средней температуре. Это повышает уверенность в общем тренде, но не гарантирует точность конкретного часа.':score>=55?'Есть умеренные различия между моделями. Используйте диапазон значений и проверяйте обновления.':'Модели заметно расходятся. Планируйте с запасом и проверяйте прогноз ближе к событию.';status.className='wp6-status '+(score<55?'warn':'');wp6SetText('wp6HomeConfidence',`Согласованность ${score}/100 · разброс средних температур ${spread.toFixed(1)}°C.`);
  }catch(e){console.warn('[WeatherPro/Confidence]',e);status.className='wp6-status warn';status.textContent='Сравнение моделей недоступно: '+e.message+'. Основной прогноз остаётся доступен на главной странице.';}
  finally{WP6_STATE.confidenceBusy=false;}
}

/* Studio: safe local-only appearance preferences. */
function wp6StudioPrefs(){try{return JSON.parse(localStorage.getItem('wp6_studio')||'{}')||{};}catch(e){return {};}}
function wp6LoadStudio(){const p=wp6StudioPrefs();const c=$('wp6Accent');if(c)c.value=p.accent||'#3b82f6';const compact=$('wp6Compact');if(compact)compact.checked=!!p.compact;const motion=$('wp6ReduceMotion');if(motion)motion.checked=!!p.reduceMotion;wp6ApplyStudio(p);}
function wp6ApplyStudio(p){const color=p.accent||'#3b82f6';document.documentElement.style.setProperty('--accent',color);document.documentElement.style.setProperty('--accent-light',color);document.documentElement.style.setProperty('--accent-dark',color);document.body.classList.toggle('compact',!!p.compact);if(p.reduceMotion){document.documentElement.style.setProperty('--wp6-motion','0');document.documentElement.classList.add('wp6-reduce-motion');}else{document.documentElement.style.removeProperty('--wp6-motion');document.documentElement.classList.remove('wp6-reduce-motion');}if(p.theme){const map={ocean:'#3b82f6',aurora:'#8b5cf6',sunset:'#f97316',forest:'#10b981'};if(map[p.theme])document.documentElement.style.setProperty('--accent',map[p.theme]);}}
function wp6SetTheme(theme){const map={ocean:'#3b82f6',aurora:'#8b5cf6',sunset:'#f97316',forest:'#10b981'};if(!map[theme])return;const p=Object.assign(wp6StudioPrefs(),{theme,accent:map[theme]});localStorage.setItem('wp6_studio',JSON.stringify(p));wp6ApplyStudio(p);if($('wp6Accent'))$('wp6Accent').value=map[theme];showNotification('Тема Weather Studio применена');}
function wp6SetAccent(color){const p=Object.assign(wp6StudioPrefs(),{theme:'custom',accent:color});localStorage.setItem('wp6_studio',JSON.stringify(p));wp6ApplyStudio(p);}
function wp6SaveStudio(){const p=Object.assign(wp6StudioPrefs(),{accent:$('wp6Accent')?.value||'#3b82f6',compact:!!$('wp6Compact')?.checked,reduceMotion:!!$('wp6ReduceMotion')?.checked});localStorage.setItem('wp6_studio',JSON.stringify(p));wp6ApplyStudio(p);showNotification('Настройки интерфейса сохранены');}
function wp6ExportStudio(){const blob=new Blob([JSON.stringify(wp6StudioPrefs(),null,2)],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='weather-pro-studio-settings.json';a.click();URL.revokeObjectURL(url);}
function wp6ResetStudio(){localStorage.removeItem('wp6_studio');wp6LoadStudio();showNotification('Визуальные настройки сброшены');}

/* Data engine MAX: provider probes, data lineage, freshness, browser storage and local audit journal. */
const WP13_ENGINE_HISTORY_KEY='wp13_data_engine_history_v1';
const WP13_ENGINE_STATE={running:false,lastRun:null,results:[],infra:null,quality:null,runAt:0};
function wp13Escape(v){return typeof esc==='function'?esc(String(v??'')):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function wp13FmtBytes(n){n=Number(n)||0;if(n<1024)return n.toFixed(0)+' Б';if(n<1048576)return (n/1024).toFixed(1)+' КБ';return (n/1048576).toFixed(2)+' МБ';}
function wp13FmtMs(n){return Number.isFinite(Number(n))?`${Math.round(Number(n))} мс`:'—';}
function wp13HistoryRead(){try{const v=JSON.parse(localStorage.getItem(WP13_ENGINE_HISTORY_KEY)||'[]');return Array.isArray(v)?v:[];}catch(_){return [];}}
function wp13HistoryWrite(items){try{localStorage.setItem(WP13_ENGINE_HISTORY_KEY,JSON.stringify(items.slice(0,30)));}catch(_){}}
function wp13Log(label,status,detail,latency){const row={at:Date.now(),label:String(label||'Проверка').slice(0,80),status,detail:String(detail||'').replace(/(appid|key|token|authorization)=([^&\s]+)/ig,'$1=[скрыто]').slice(0,180),latency:Number.isFinite(latency)?Math.round(latency):null};const all=[row,...wp13HistoryRead()].slice(0,30);wp13HistoryWrite(all);wp13RenderEngineLog();}
function wp13RenderEngineLog(){const box=$('wp13EngineLog');if(!box)return;const items=wp13HistoryRead();box.innerHTML=items.length?items.slice(0,18).map(x=>`<div class="wp13-log-row"><time>${new Date(x.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time><span><b>${wp13Escape(x.label)}</b><br><span style="color:var(--text-secondary)">${wp13Escape(x.detail||'')}</span></span><span class="wp13-status ${x.status==='ok'?'ok':x.status==='fail'?'fail':'skip'}">${x.status==='ok'?'OK':x.status==='fail'?'ОШИБКА':'ПРОПУСК'}${x.latency!=null?' · '+x.latency+' мс':''}</span></div>`).join(''):'<div class="wp13-empty">Журнал пуст. Запустите проверку источников.</div>';}
function wp13Download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function wp13SafeError(error){let m=String(error?.message||error||'Неизвестная ошибка');m=m.replace(/https?:\/\/[^\s]+/g,'внешний endpoint').replace(/(appid|key|token|authorization)=([^&\s]+)/ig,'$1=[скрыто]');return m.slice(0,180);}
let WP13_PROBE_COUNTER=0;
async function wp13Probe(id,label,description,url,validator){const started=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);try{const probeUrl=new URL(url);probeUrl.searchParams.set('_wp13_probe',`${Date.now()}_${++WP13_PROBE_COUNTER}`);const r=await fetch(probeUrl.toString(),{cache:'no-store',signal:controller.signal,headers:{'Accept':'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();const valid=validator?validator(data):!!data;if(!valid)throw new Error('Ответ получен, но структура данных не прошла проверку');const latency=performance.now()-started;return {id,label,description,status:'ok',latencyMs:latency,http:r.status,detail:'Ответ получен; базовая структура подтверждена.',checkedAt:Date.now()};}catch(e){const latency=performance.now()-started;return {id,label,description,status:'fail',latencyMs:latency,http:null,detail:e?.name==='AbortError'?'Тайм-аут: источник не ответил за 9 секунд.':wp13SafeError(e),checkedAt:Date.now()};}finally{clearTimeout(timer);}}
function wp13Skip(id,label,description,detail){return {id,label,description,status:'skip',latencyMs:null,http:null,detail,checkedAt:Date.now()};}
async function wp13CollectInfra(){
  const out={online:!!navigator.onLine,connection:null,storage:null,localCache:null,cacheStorage:null,indexedDB:null,serviceWorker:null,firebase:null,browser:null};
  const nc=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(nc)out.connection={type:nc.effectiveType||'—',downlink:Number.isFinite(nc.downlink)?nc.downlink:null,rtt:Number.isFinite(nc.rtt)?nc.rtt:null,saveData:!!nc.saveData};
  try{const est=await navigator.storage?.estimate?.();if(est)out.storage={usage:est.usage||0,quota:est.quota||0,percent:est.quota?Math.min(100,(est.usage||0)/est.quota*100):null,persisted:await (navigator.storage?.persisted ? navigator.storage.persisted().catch(()=>false) : false)};}catch(_){}
  try{const all=typeof loadCacheAll==='function'?loadCacheAll():{};const entries=Object.entries(all||{});out.localCache={cities:entries.length,bytes:entries.reduce((n,[k,v])=>n+(k.length+JSON.stringify(v).length)*2,0),latest:entries.reduce((m,[,v])=>Math.max(m,Number(v?.ts)||0),0)};}catch(_){}
  try{if('caches'in window){const names=await caches.keys(),details=await Promise.all(names.map(async name=>{try{return {name,count:(await (await caches.open(name)).keys()).length};}catch(_){return {name,count:null};}}));out.cacheStorage={names:details,total:details.reduce((n,x)=>n+(x.count||0),0)};}}catch(_){}
  try{if(window.indexedDB?.databases){const dbs=await window.indexedDB.databases();out.indexedDB={available:true,names:dbs.map(x=>x.name).filter(Boolean)};}else out.indexedDB={available:!!window.indexedDB,names:[]};}catch(_){out.indexedDB={available:!!window.indexedDB,names:[]};}
  try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();out.serviceWorker={supported:true,controlled:!!navigator.serviceWorker.controller,registrations:regs.length,active:regs.filter(x=>!!x.active).length,waiting:regs.filter(x=>!!x.waiting).length,script:navigator.serviceWorker.controller?.scriptURL?new URL(navigator.serviceWorker.controller.scriptURL).pathname:'—'};}else out.serviceWorker={supported:false,controlled:false,registrations:0,active:0,waiting:0,script:'—'};}catch(_){out.serviceWorker={supported:true,controlled:!!navigator.serviceWorker?.controller,registrations:null,active:null,waiting:null,script:'Ошибка чтения'};}
  out.firebase={sdk:!!window.firebase,ready:!!(fbReady&&fbDb&&fbAuth),auth:!!fbAuth?.currentUser,firestoreClient:!!fbDb};
  out.browser={secure:!!window.isSecureContext,language:navigator.language||'—',cores:navigator.hardwareConcurrency||null,deviceMemory:navigator.deviceMemory||null,visibility:document.visibilityState||'—'};
  return out;
}
function wp13BuildQuality(){
  const d=lastWeatherData,f=lastForecastData,items=Array.isArray(f?.list)?f.list:[];
  const currentAge=d?.dt?Math.max(0,Date.now()-Number(d.dt)*1000):null;
  const hasCoord=Number.isFinite(Number(d?.coord?.lat))&&Number.isFinite(Number(d?.coord?.lon));
  const checks=[
    {name:'Текущие наблюдения',ok:!!(d&&Number.isFinite(Number(d?.main?.temp))&&Number.isFinite(Number(d?.main?.humidity))),detail:d?'Температура и влажность присутствуют.':'Погодные наблюдения ещё не загружены.'},
    {name:'Географическая привязка',ok:hasCoord,detail:hasCoord?'Координаты присутствуют и имеют допустимый формат.':'Координаты активного города отсутствуют.'},
    {name:'Почасовой прогноз',ok:items.length>=8,detail:items.length?`${items.length} временных интервалов получено.`:'Список прогнозных интервалов пуст.'},
    {name:'Временная метка наблюдения',ok:currentAge!==null&&currentAge<3*3600000,detail:currentAge===null?'Время измерения отсутствует.':`Возраст измерения около ${Math.round(currentAge/60000)} мин.`},
    {name:'Согласованность моделей',ok:!!WP6_STATE.lastConfidence,detail:WP6_STATE.lastConfidence?`${WP6_STATE.lastConfidence.rows.length} модельных рядов; разброс ${WP6_STATE.lastConfidence.spread.toFixed(1)}°.`:'Сравнение моделей ещё не запускалось.'},
    {name:'Локальная копия',ok:!!(currentCity&&typeof cacheGet==='function'&&cacheGet(currentCity)),detail:currentCity&&cacheGet(currentCity)?'Для активного города найдена запись кэша.':'В кэше нет записи активного города.'}
  ];
  return {checks,currentAge,forecastCount:items.length,city:d?.name||currentCity||'—',ok:checks.filter(x=>x.ok).length,total:checks.length};
}
function wp13RenderSourceGrid(results){const box=$('wp13SourceGrid');if(!box)return;box.innerHTML=results.map(x=>`<article class="wp13-source"><div class="wp13-source-top"><div><h3>${wp13Escape(x.label)}</h3><p>${wp13Escape(x.description)}</p></div><span class="wp13-status ${x.status}">${x.status==='ok'?'РАБОТАЕТ':x.status==='fail'?'ОШИБКА':'ОЖИДАЕТ'}</span></div><p style="margin-top:9px">${wp13Escape(x.detail)}</p><div class="wp13-source-meta"><span>${x.latencyMs==null?'Задержка —':wp13FmtMs(x.latencyMs)}</span><span>${x.http?'HTTP '+x.http:'Без HTTP-проверки'}</span></div></article>`).join('');}
function wp13RenderQuality(q){const box=$('wp13QualityGrid');if(!box)return;box.innerHTML=q.checks.map(x=>`<article class="wp13-source"><div class="wp13-source-top"><h3>${wp13Escape(x.name)}</h3><span class="wp13-status ${x.ok?'ok':'skip'}">${x.ok?'ПРОЙДЕНО':'НЕТ ДАННЫХ'}</span></div><p style="margin-top:9px">${wp13Escape(x.detail)}</p></article>`).join('');}
function wp13RenderInfra(x){const box=$('wp13InfraGrid');if(!box)return;const c=x.connection,s=x.storage,l=x.localCache,cs=x.cacheStorage,idb=x.indexedDB,sw=x.serviceWorker,fb=x.firebase,b=x.browser;const cards=[
 ['Сеть',x.online?'Online':'Offline',c?`${c.type} · RTT ${c.rtt??'—'} мс · ${c.downlink??'—'} Мбит/с${c.saveData?' · экономия данных':''}`:'Тип соединения браузеру не раскрыт.'],
 ['Квота хранилища',s?wp13FmtBytes(s.usage)+' / '+wp13FmtBytes(s.quota):'Недоступно',s?`${s.percent==null?'—':s.percent.toFixed(1)+'%'} занято · постоянное хранилище: ${s.persisted?'да':'нет / не подтверждено'}`:'Storage Estimate API не поддерживается.'],
 ['Погодный кэш',l?l.cities+' городов':'0 городов',l?`Оценка ${wp13FmtBytes(l.bytes)} · последняя запись ${l.latest?new Date(l.latest).toLocaleString('ru-RU'):'нет'}`:'Нет записей.'],
 ['Cache Storage',cs?cs.total+' ресурсов':'Недоступно',cs?cs.names.map(n=>`${n.name} (${n.count??'?'})`).join(' · ')||'Кэши пока пусты.':'Cache API недоступен.'],
 ['IndexedDB',idb?.available?'Доступна':'Недоступна',idb?.names?.length?idb.names.join(' · '):'Базы не обнаружены или браузер не раскрывает их список.'],
 ['Service Worker',sw?.supported?(sw.controlled?'Контролирует страницу':'Поддерживается'):'Не поддерживается',sw?`${sw.registrations??'—'} регистраций · ${sw.active??'—'} активных · ${sw.waiting??'—'} ожидают обновления`:'Статус недоступен.'],
 ['Firebase',fb?.ready?'Клиент инициализирован':'Не готов',fb?`SDK ${fb.sdk?'есть':'нет'} · Auth ${fb.auth?'выполнен вход':'гость'} · Firestore SDK ${fb.firestoreClient?'есть':'нет'}`:'Статус неизвестен.'],
 ['Среда браузера',b?.secure?'Защищённый контекст':'Ограниченный контекст',b?`${b.language} · ${b.cores??'—'} логических потоков · RAM estimate ${b.deviceMemory??'—'} ГБ · вкладка ${b.visibility}`:'Нет данных.']
 ];box.innerHTML=cards.map(c=>`<article class="wp13-source"><h3>${wp13Escape(c[0])}</h3><div style="font-size:17px;font-weight:800;margin:7px 0">${wp13Escape(c[1])}</div><p>${wp13Escape(c[2])}</p></article>`).join('');}
function wp13RenderOverview(results,q){const checked=results.filter(x=>x.status!=='skip'),ok=checked.filter(x=>x.status==='ok'),failed=checked.filter(x=>x.status==='fail'),score=checked.length?Math.round(ok.length/checked.length*100):null,lat=ok.length?ok.reduce((n,x)=>n+x.latencyMs,0)/ok.length:null;wp6SetText('wp13HealthScore',score===null?'—':score+'/100');const meter=$('wp13HealthMeter');if(meter)meter.style.width=(score||0)+'%';wp6SetText('wp13SourceCount',`${ok.length} / ${checked.length}`);wp6SetText('wp13AvgLatency',lat===null?'—':Math.round(lat)+' мс');if(q.currentAge===null){wp6SetText('wp13DataFresh','Нет данных');wp6SetText('wp13DataFreshMeta','Сначала загрузите погоду для города.');}else{const mins=Math.round(q.currentAge/60000);wp6SetText('wp13DataFresh',mins<60?mins+' мин':Math.round(mins/60)+' ч');wp6SetText('wp13DataFreshMeta',mins<120?'Наблюдение достаточно свежее':'Наблюдение может быть устаревшим');}wp6SetText('wp13EngineRunMeta',`Город: ${q.city} · проверено ${new Date().toLocaleString('ru-RU')} · успешных ${ok.length}, ошибок ${failed.length}, пропущено ${results.length-checked.length}.`);}
async function wp13RunEngineAudit(force=false){
  if(WP13_ENGINE_STATE.running)return;
  if(!force&&WP13_ENGINE_STATE.runAt&&Date.now()-WP13_ENGINE_STATE.runAt<90000){wp13RenderSourceGrid(WP13_ENGINE_STATE.results);wp13RenderQuality(WP13_ENGINE_STATE.quality||wp13BuildQuality());if(WP13_ENGINE_STATE.infra)wp13RenderInfra(WP13_ENGINE_STATE.infra);wp13RenderEngineLog();return;}
  WP13_ENGINE_STATE.running=true;const runMeta=$('wp13EngineRunMeta');if(runMeta)runMeta.textContent='Выполняем независимые проверки источников и среды…';const sourceBox=$('wp13SourceGrid');if(sourceBox)sourceBox.innerHTML='<div class="wp13-empty">Проверяем погодные API. Каждый запрос ограничен тайм-аутом 9 секунд…</div>';
  const d=lastWeatherData,coord=d?.coord,validCoord=Number.isFinite(Number(coord?.lat))&&Number.isFinite(Number(coord?.lon)),lat=validCoord?Number(coord.lat):null,lon=validCoord?Number(coord.lon):null,city=encodeURIComponent(d?.name||currentCity||'');
  const results=[];const jobs=[];
  if(validCoord){
    jobs.push(wp13Probe('owm-current','OpenWeather · Current','Текущие наблюдения по координатам.',`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`,j=>!!j?.main&&Number.isFinite(Number(j.main.temp))));
    jobs.push(wp13Probe('owm-forecast','OpenWeather · Forecast','Прогноз на 5 дней с шагом 3 часа.',`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`,j=>Array.isArray(j?.list)&&j.list.length>0));
    jobs.push(wp13Probe('owm-air','OpenWeather · Air Pollution','Индекс качества воздуха и компоненты загрязнения.',`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`,j=>Array.isArray(j?.list)&&j.list.length>0));
    jobs.push(wp13Probe('meteo-forecast','Open-Meteo · Forecast','Независимый прогноз: текущие условия и почасовые ряды.',`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability&forecast_days=2&timezone=auto`,j=>!!j?.current&&Array.isArray(j?.hourly?.time)&&j.hourly.time.length>0));
    jobs.push(wp13Probe('meteo-models','Open-Meteo · Multi-model','Проверка доступности нескольких численных модельных рядов.',`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,wind_speed_10m&models=ecmwf_ifs025,ncep_gfs_seamless,icon_seamless&forecast_days=1&timezone=auto`,j=>!!j?.hourly&&Object.keys(j.hourly).some(k=>k.startsWith('temperature_2m'))));
    jobs.push(wp13Probe('meteo-air','Open-Meteo · Air Quality','Независимый источник атмосферных загрязнителей.',`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,european_aqi,us_aqi&timezone=auto`,j=>!!j?.current));
    const end=new Date(Date.now()-2*86400000),begin=new Date(Date.now()-4*86400000),iso=v=>v.toISOString().slice(0,10);
    jobs.push(wp13Probe('meteo-archive','Open-Meteo · Historical Archive','Архивные наблюдения за завершённые даты.',`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${iso(begin)}&end_date=${iso(end)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,j=>Array.isArray(j?.daily?.time)&&j.daily.time.length>0));
    jobs.push(wp13Probe('rainviewer','RainViewer · Radar metadata','Метаинформация о доступных исторических радарных кадрах.',`https://api.rainviewer.com/public/weather-maps.json`,j=>!!j?.host&&!!j?.radar&&Array.isArray(j.radar.past)));
  }else{
    ['owm-current','owm-forecast','owm-air','meteo-forecast','meteo-models','meteo-air','meteo-archive'].forEach((id)=>{const names={'owm-current':'OpenWeather · Current','owm-forecast':'OpenWeather · Forecast','owm-air':'OpenWeather · Air Pollution','meteo-forecast':'Open-Meteo · Forecast','meteo-models':'Open-Meteo · Multi-model','meteo-air':'Open-Meteo · Air Quality','meteo-archive':'Open-Meteo · Historical Archive'};results.push(wp13Skip(id,names[id],'Погодный источник','Сначала загрузите город с координатами на главной странице.'));});
    jobs.push(wp13Probe('rainviewer','RainViewer · Radar metadata','Метаинформация о доступных исторических радарных кадрах.','https://api.rainviewer.com/public/weather-maps.json',j=>!!j?.host&&!!j?.radar&&Array.isArray(j.radar.past)));
  }
  if(city)jobs.push(wp13Probe('owm-geocoding','OpenWeather · Geocoding','Проверка поиска активного города по названию.',`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${OWM_KEY}`,j=>Array.isArray(j)));
  try{
    const [probeResults,infra]=await Promise.all([Promise.all(jobs),wp13CollectInfra()]);results.push(...probeResults);results.push({id:'firebase-client',label:'Firebase · Client SDK',description:'Проверка инициализации клиента без чтения или записи Firestore.',status:fbReady&&fbDb&&fbAuth?'ok':'fail',latencyMs:null,http:null,detail:fbReady&&fbDb&&fbAuth?'Firebase SDK и клиенты Auth / Firestore инициализированы. Серверная проверка данных не выполнялась.':'Клиент Firebase не полностью инициализирован.',checkedAt:Date.now()});
    const quality=wp13BuildQuality();try{wp14UpdateForecastVerification();wp14CaptureForecastsSilent();wp14RenderForecast();wp14RenderCache();}catch(e){wp14RuntimeEvent('Data Engine capture',wp13SafeError(e));}WP13_ENGINE_STATE.results=results;WP13_ENGINE_STATE.infra=infra;WP13_ENGINE_STATE.quality=quality;WP13_ENGINE_STATE.lastRun=Date.now();WP13_ENGINE_STATE.runAt=Date.now();
    wp13RenderSourceGrid(results);wp13RenderQuality(quality);wp13RenderInfra(infra);wp13RenderOverview(results,quality);
    results.forEach(x=>{if(x.status!=='skip')wp13Log(x.label,x.status,x.detail,x.latencyMs);});
    const legacy=$('wp6EngineGrid');if(legacy){const basic=[['Интернет',infra.online,'Состояние сети браузера'],['Firebase SDK',infra.firebase.sdk,'Наличие клиентского SDK'],['Firebase Auth / Firestore',infra.firebase.ready,'Инициализация клиентских модулей'],['Service Worker',infra.serviceWorker.supported,'Поддержка PWA'],['OpenWeatherMap',results.some(x=>x.id==='owm-current'&&x.status==='ok'),'Проверка реального API-ответа'],['Open-Meteo',results.some(x=>x.id==='meteo-forecast'&&x.status==='ok'),'Проверка независимого API-ответа'],['RainViewer',results.some(x=>x.id==='rainviewer'&&x.status==='ok'),'Проверка метаданных радара']];legacy.innerHTML=basic.map(c=>`<article class="wp6-card"><div class="wp6-kicker">${c[1]?'ГОТОВО':'ПРОВЕРИТЬ'}</div><h3>${wp13Escape(c[0])}</h3><p>${wp13Escape(c[2])}</p><div class="wp6-tag" style="margin-top:10px;color:${c[1]?'#6ee7b7':'#fbbf24'}">${c[1]?'Доступен':'Не подтверждён'}</div></article>`).join('');}
    const stats=$('wp6CacheStats');if(stats){const cache=infra.localCache,storage=infra.storage;stats.innerHTML=`<article class="wp6-card"><div class="wp6-kicker">ПОГОДНЫЙ КЭШ</div><div class="wp6-value">${cache?.cities??0}</div><p>Городов · ${wp13FmtBytes(cache?.bytes||0)} по оценке JSON.</p></article><article class="wp6-card"><div class="wp6-kicker">СЕТЬ</div><div class="wp6-value">${infra.online?'Online':'Offline'}</div><p>Состояние соединения браузера.</p></article><article class="wp6-card"><div class="wp6-kicker">АККАУНТ</div><div class="wp6-value">${infra.firebase.auth?'Авторизован':'Гость'}</div><p>${infra.firebase.ready?'Firebase клиент инициализирован':'Firebase не готов'}.</p></article><article class="wp6-card"><div class="wp6-kicker">КВОТА БРАУЗЕРА</div><div class="wp6-value">${storage?wp13FmtBytes(storage.usage):'—'}</div><p>${storage?.quota?`из ${wp13FmtBytes(storage.quota)}`:'Storage API недоступен'}.</p></article>`;}
    wp6SetText('wp6EngineUpdated','Полная диагностика: '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}));wp6SetText('wp6HomeEngine',(navigator.onLine?'Сеть доступна':'Офлайн')+' · '+results.filter(x=>x.status==='ok').length+'/'+results.filter(x=>x.status!=='skip').length+' источников отвечают · '+(fbReady?'Firebase инициализирован':'Firebase не готов'));
  }catch(e){console.warn('[WeatherPro/DataEngine]',e);if(runMeta)runMeta.textContent='Ошибка выполнения диагностики: '+wp13SafeError(e);}finally{WP13_ENGINE_STATE.running=false;wp13RenderEngineLog();}
}
function wp13ExportEngineReport(kind='json'){
  const q=WP13_ENGINE_STATE.quality||wp13BuildQuality(),i=WP13_ENGINE_STATE.infra||null,results=WP13_ENGINE_STATE.results||[];const report={product:'Weather Pro',module:'Data Engine Extreme',version:'V14',generatedAt:new Date().toISOString(),activeCity:lastWeatherData?.name||currentCity||null,summary:{checked:results.filter(x=>x.status!=='skip').length,online:results.filter(x=>x.status==='ok').length,failed:results.filter(x=>x.status==='fail').length},providers:results.map(({id,label,description,status,latencyMs,http,detail,checkedAt})=>({id,label,description,status,latencyMs,http,detail,checkedAt})),dataQuality:q,environment:i?{online:i.online,connection:i.connection,storage:i.storage,localCache:i.localCache,cacheStorage:i.cacheStorage,indexedDB:i.indexedDB,serviceWorker:i.serviceWorker,firebase:{sdk:i.firebase.sdk,ready:i.firebase.ready,auth:i.firebase.auth},browser:i.browser}:null,localJournal:wp13HistoryRead().slice(0,30),advanced:typeof wp14BuildReport==='function'?wp14BuildReport():null};
  if(kind==='csv'){const rows=[['id','source','status','latency_ms','http','detail'],...report.providers.map(x=>[x.id,x.label,x.status,x.latencyMs??'',x.http??'',x.detail])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');wp13Download('weather-pro-data-engine-sources.csv','\ufeff'+csv,'text/csv;charset=utf-8');}else wp13Download('weather-pro-data-engine-report.json',JSON.stringify(report,null,2),'application/json');
}
function wp13ClearEngineHistory(){try{localStorage.removeItem(WP13_ENGINE_HISTORY_KEY);wp13RenderEngineLog();showNotification('Локальный журнал Data Engine очищен');}catch(e){showNotification('Не удалось очистить журнал',true);}}

