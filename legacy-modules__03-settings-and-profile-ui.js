/* Weather Pro V16 module: 03-settings-and-profile-ui.js — extracted from the existing app script. */
/* ============================================================
   UTILS
   ============================================================ */

function formatTime(dateOrTs){
  const d = (dateOrTs instanceof Date) ? dateOrTs : new Date(dateOrTs);
  if(settings.timeFormat === '12h'){
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function formatHour(dateOrTs){
  const d = (dateOrTs instanceof Date) ? dateOrTs : new Date(dateOrTs);
  if(settings.timeFormat === '12h'){
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h} ${ampm}`;
  }
  return String(d.getHours()).padStart(2,'0') + ':00';
}
function convertWind(speedMs){
  switch(settings.windUnit){
    case 'kmh': return (speedMs * 3.6).toFixed(1) + ' км/ч';
    case 'mph': return (speedMs * 2.237).toFixed(1) + ' mph';
    default: return speedMs.toFixed(1) + ' м/с';
  }
}

/* ============================================================
   I18N
   ============================================================ */

const T = {
  ru:{nav_home:'Главная',nav_charts:'Графики',nav_map:'Карта',nav_favorites:'Избранное',nav_stats:'Статистика',nav_history:'Архив',nav_widget:'Виджет',nav_ai:'Weather AI',nav_compare:'Сравнение',nav_people:'Люди',nav_profile:'Профиль',nav_settings:'Настройки',nav_about:'О нас',nav_planet:"Planet OS 7.0",nav_globe:"Глобус 3D",nav_intelligence:"Интеллект",nav_hourly:"Почасовой обзор",nav_confidence:"Точность",nav_emergency:"Риски",nav_smart_alerts:"Алерты",nav_planner:"План дня",nav_route:"Маршрут",nav_activities:"Активности",nav_life:"Weather Life",nav_studio:"Studio",nav_engine:"Data Engine",nav_community:"Сообщество",nav_group_weather:"Погода",nav_group_forecast:"Прогноз и риски",nav_group_planning:"Планирование",nav_group_analytics:"Аналитика",nav_group_tools:"Инструменты",nav_group_community:"Сообщество",nav_group_account:"Аккаунт",nav_catalog:"Разделы",nav_catalog_title:"Все разделы",nav_catalog_subtitle:"Каждый инструмент — в своём рабочем пространстве.",nav_catalog_search:"Найти раздел или функцию…",nav_catalog_empty:"Ничего не найдено",search_title:'Поиск города',search_btn:'Найти',history_title:'История поиска',history_clear:'Очистить',popular_title:'Популярные города',share_weather:'Поделиться',geo_btn:'Моё местоположение',pdf_btn:'Экспорт PDF',qr_btn:'QR-код',loading:'Загрузка данных...',feels_like:'Ощущается как',wind:'Ветер',humidity:'Влажность',pressure:'Давление',hourly_title:'Почасовой прогноз',forecast_title:'Прогноз на 5 дней',charts_title:'Графики погоды',chart_temp:'Температура',chart_humidity:'Влажность',map_title:'Карта осадков',fav_title:'Избранные города',stats_title:'Статистика погоды',stat_max_temp:'Макс. температура',stat_min_temp:'Мин. температура',stat_avg_temp:'Средняя температура',stat_rain_days:'Дней с осадками',history_desc:'Данные сохраняются локально',widget_title:'Виджет погоды',widget_desc:'Скопируйте этот код для вставки виджета.',widget_copy:'Копировать код',auth_login:'Вход',auth_register:'Регистрация',login_title:'Вход в аккаунт',email:'Email',password:'Пароль',login_btn:'Войти',login_register_link:'Нет аккаунта? Зарегистрируйтесь',register_title:'Регистрация',name:'Имя',confirm_password:'Подтвердите пароль',register_btn:'Зарегистрироваться',register_login_link:'Уже есть аккаунт? Войдите',profile_title:'Мой профиль',default_city:'Город по умолчанию',reg_date:'Дата регистрации',bio:'О себе',save_profile:'Сохранить изменения',share_profile:'Поделиться профилем',settings_title:'Настройки',settings_appearance:'Внешний вид',dark_theme:'Темная тема',dark_theme_desc:'Использовать темный режим',animations:'Анимации',animations_desc:'Плавные анимации интерфейса',accent_color:'Акцентный цвет',accent_color_desc:'Основной цвет оформления',theme:'Тема оформления',theme_desc:'Готовая тема',settings_weather:'Погода',units:'Единицы измерения',units_desc:'Система измерения',auto_location:'Автоопределение',auto_location_desc:'Определять местоположение',weather_notifications:'Уведомления о погоде',weather_notifications_desc:'Получать уведомления',settings_notifications:'Уведомления',browser_notifications:'Уведомления в браузере',browser_notifications_desc:'Показывать уведомления',sound_notifications:'Звуковые уведомления',sound_notifications_desc:'Звук при уведомлениях',settings_data:'Данные',save_history:'История поиска',save_history_desc:'Сохранять историю',auto_save:'Автосохранение',auto_save_desc:'Сохранять изменения',save_settings:'Сохранить настройки',reset_settings:'Сбросить настройки',choose_avatar:'Выберите аватар',upload_photo:'Или загрузите фото',save_avatar:'Сохранить аватар',cancel:'Отмена',ai_send:'Отправить',ai_placeholder:'Например: Нужен ли зонт завтра?',alerts_title:'Предупреждения',visibility:'Видимость',wind_gust:'Порывы ветра',uv_index:'УФ-индекс',now_label:'Сейчас'},
  en:{nav_home:'Home',nav_charts:'Charts',nav_map:'Map',nav_favorites:'Favorites',nav_stats:'Stats',nav_history:'History',nav_widget:'Widget',nav_ai:'Weather AI',nav_compare:'Compare',nav_people:'People',nav_profile:'Profile',nav_settings:'Settings',nav_about:'About',nav_planet:"Planet OS 7.0",nav_globe:"3D Globe",nav_intelligence:"Intelligence",nav_hourly:"Hourly Brief",nav_confidence:"Accuracy",nav_emergency:"Risks",nav_smart_alerts:"Alerts",nav_planner:"Day Planner",nav_route:"Route",nav_activities:"Activities",nav_life:"Weather Life",nav_studio:"Studio",nav_engine:"Data Engine",nav_community:"Community",nav_group_weather:"Weather",nav_group_forecast:"Forecast & Risks",nav_group_planning:"Planning",nav_group_analytics:"Analytics",nav_group_tools:"Tools",nav_group_community:"Community",nav_group_account:"Account",nav_catalog:"Sections",nav_catalog_title:"All sections",nav_catalog_subtitle:"Every tool has its own workspace.",nav_catalog_search:"Search a section or feature…",nav_catalog_empty:"No matching sections",search_title:'Search City',search_btn:'Search',history_title:'Search History',history_clear:'Clear',popular_title:'Popular Cities',share_weather:'Share',geo_btn:'My Location',pdf_btn:'Export PDF',qr_btn:'QR Code',loading:'Loading...',feels_like:'Feels like',wind:'Wind',humidity:'Humidity',pressure:'Pressure',hourly_title:'Hourly Forecast',forecast_title:'5-Day Forecast',charts_title:'Weather Charts',chart_temp:'Temperature',chart_humidity:'Humidity',map_title:'Precipitation Map',fav_title:'Favorite Cities',stats_title:'Weather Statistics',stat_max_temp:'Max Temp',stat_min_temp:'Min Temp',stat_avg_temp:'Avg Temp',stat_rain_days:'Rainy Days',history_desc:'Data is stored locally',widget_title:'Weather Widget',widget_desc:'Copy this code to embed the widget.',widget_copy:'Copy Code',auth_login:'Login',auth_register:'Register',login_title:'Login',email:'Email',password:'Password',login_btn:'Sign In',login_register_link:'No account? Register',register_title:'Register',name:'Name',confirm_password:'Confirm Password',register_btn:'Sign Up',register_login_link:'Have an account? Login',profile_title:'My Profile',default_city:'Default City',reg_date:'Registration Date',bio:'Bio',save_profile:'Save Changes',share_profile:'Share Profile',settings_title:'Settings',settings_appearance:'Appearance',dark_theme:'Dark Theme',dark_theme_desc:'Use dark mode',animations:'Animations',animations_desc:'Smooth UI animations',accent_color:'Accent Color',accent_color_desc:'Primary UI color',theme:'Theme',theme_desc:'Preset theme',settings_weather:'Weather',units:'Units',units_desc:'Measurement system',auto_location:'Auto Location',auto_location_desc:'Detect location',weather_notifications:'Weather Notifications',weather_notifications_desc:'Receive alerts',settings_notifications:'Notifications',browser_notifications:'Browser Notifications',browser_notifications_desc:'Show notifications',sound_notifications:'Sound',sound_notifications_desc:'Play sound',settings_data:'Data',save_history:'Search History',save_history_desc:'Save search history',auto_save:'Auto Save',auto_save_desc:'Auto-save settings',save_settings:'Save Settings',reset_settings:'Reset Settings',choose_avatar:'Choose Avatar',upload_photo:'Or upload photo',save_avatar:'Save Avatar',cancel:'Cancel',ai_send:'Send',ai_placeholder:'e.g. Do I need an umbrella tomorrow?',alerts_title:'Alerts',visibility:'Visibility',wind_gust:'Wind Gust',uv_index:'UV Index',now_label:'Now'}
};
function setLang(l){
  lang=l;
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.dataset.i18n; if(T[l]&&T[l][k]) el.textContent=T[l][k];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const k=el.dataset.i18nPlaceholder; if(T[l]&&T[l][k]) el.placeholder=T[l][k];
  });
  if(recognition) recognition.lang = l==='ru'?'ru-RU':'en-US';
}
window.setLang=setLang;

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', init);

function init(){
  loadSettings(); loadUser(); updateUI(); updateCurrentTime(); setInterval(updateCurrentTime,60000);
  loadSearchHistory(); initColors(); initThemes(); initMap(); initCharts(); initHistoryChart();
  initAI(); initVoice(); loadHistoryData(); initAutocomplete();
  initNetworkBadge(); registerSW(); linkManifest();
  initRadar();
  showNotifBanner();
  applyCompactMode(settings.compactMode);
  initPWAInstall();
  wp10Init();
  syncSmartAlertControls();
  const launchShortcut=new URLSearchParams(location.search).get('page');
  if(['map','intelligence','stats'].includes(launchShortcut))setTimeout(()=>showPage(launchShortcut),120);

  document.querySelectorAll('.city-btn').forEach(b=>b.addEventListener('click',()=>{
    $('cityInput').value=b.dataset.city; getWeather(b.dataset.city); addToSearch(b.dataset.city);
  }));

  let st; $('cityInput').addEventListener('input',()=>{clearTimeout(st); st=setTimeout(()=>{saveLast($('cityInput').value);showSaveIndicator();},800);});
  $('searchBtn').addEventListener('click', async () => {
    const c = $('cityInput').value.trim();
    if(!c) return;
    const handled = await handleCoordinateSearch(c);
    if(!handled){ getWeather(c); addToSearch(c); }
  });
  $('cityInput').addEventListener('keypress',e=>{if(e.key==='Enter'){hideAC();$('searchBtn').click();}});
  $('aiInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendAIMessage();}});
  $('aiInput').addEventListener('input',e=>wp13AutoSizeAIInput(e.currentTarget));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeQRModal();closeAvatarModal();hideAC();closeDayDetail();}
  });
  document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');}));

  $('compactMode').addEventListener('change',e=>{ applyCompactMode(e.target.checked); });
  ['optimizationEnabled','autoOptimize','batterySaver','lightEffects','pauseBackground','animations'].forEach(id=>$(id)?.addEventListener('change',updatePerformanceFromControls));
  document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('wp-performance-hidden',wpPerformanceShouldPause());});
  const perfConnection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  perfConnection?.addEventListener?.('change',applyPerformanceSettings);
  $('timeFormatSelect').addEventListener('change',()=>{ if(lastWeatherData) renderCurrent(lastWeatherData); if(lastForecastData){ renderHourly(lastForecastData); renderForecast(lastForecastData); } });
  $('windUnitSelect').addEventListener('change',()=>{ if(lastWeatherData) renderCurrent(lastWeatherData); if(lastForecastData){ renderHourly(lastForecastData); renderForecast(lastForecastData); } });

  restoreCache();
  loadWeather();
  updateWidget();
  compareCities();
  loadHistory();
  renderMultiCityHome();
}
window.init=init;
function applyCompactMode(on){ document.body.classList.toggle('compact', !!on); }
function wpPerformanceDeviceLimited(){
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const memory=Number(navigator.deviceMemory||0),cores=Number(navigator.hardwareConcurrency||0);
  return !!(connection?.saveData || (memory>0&&memory<=4) || (cores>0&&cores<=4));
}
function wpPerformanceShouldPause(){
  return !!(settings.optimizationEnabled && settings.pauseBackground && document.hidden);
}
function applyPerformanceSettings(){
  if(!document.body)return;
  const enabled=settings.optimizationEnabled!==false;
  const autoLimited=enabled && settings.autoOptimize!==false && wpPerformanceDeviceLimited();
  const battery=enabled && (!!settings.batterySaver || autoLimited);
  const lite=enabled && (!!settings.lightEffects || battery);
  const reducedMotion=settings.animations===false || battery;
  document.body.classList.toggle('wp-performance-enabled',enabled);
  document.body.classList.toggle('wp-performance-lite',lite);
  document.body.classList.toggle('wp-performance-battery',battery);
  document.body.classList.toggle('wp-performance-reduced-motion',reducedMotion);
  document.body.classList.toggle('wp-performance-background-pause',enabled && settings.pauseBackground!==false);
  document.body.classList.toggle('wp-performance-hidden',wpPerformanceShouldPause());
  const status=$('optimizationStatus');
  if(status){
    if(!enabled)status.textContent='Оптимизация выключена. Все эффекты работают в обычном режиме.';
    else if(autoLimited)status.textContent='Автооптимизация активна: устройство или сеть используют облегчённый профиль.';
    else if(battery)status.textContent='Экономный профиль активен: снижены анимации и графические эффекты.';
    else if(lite)status.textContent='Лёгкая графика включена: снижены размытие и тени карточек.';
    else status.textContent='Оптимизация включена. Можно дополнительно включить экономию батареи или лёгкую графику.';
  }
}
function updatePerformanceFromControls(){
  settings.optimizationEnabled=$('optimizationEnabled').checked;
  settings.autoOptimize=$('autoOptimize').checked;
  settings.batterySaver=$('batterySaver').checked;
  settings.lightEffects=$('lightEffects').checked;
  settings.pauseBackground=$('pauseBackground').checked;
  settings.animations=$('animations').checked;
  applyPerformanceSettings();
  if(settings.autoSave)saveSettingsSilent();
}

function initNetworkBadge(){
  const upd=()=>{
    const on=navigator.onLine;
    $('netDot').className=on?'online-dot':'online-dot offline-dot';
    $('netText').textContent=on?'online':'offline';
  };
  window.addEventListener('online',upd); window.addEventListener('offline',upd); upd();
}
function linkManifest(){
  let link=document.querySelector('link[rel="manifest"]');
  if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link);}
  link.href='./manifest.webmanifest';
}
function registerSW(){
  if(!('serviceWorker' in navigator))return;
  if(location.protocol!=='https:'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')return;
  let approvedUpdate=false,reloadAttached=false;
  const showUpdate=reg=>{
    if(!reg?.waiting||!navigator.serviceWorker.controller||document.getElementById('wp16SwUpdatePrompt'))return;
    const bar=document.createElement('div');bar.id='wp16SwUpdatePrompt';bar.className='wp16-update-prompt';
    const copy=document.createElement('div');copy.innerHTML='<strong>Доступно обновление Weather Pro</strong><span>Установить его сейчас? Текущая вкладка перезагрузится.</span>';
    const button=document.createElement('button');button.type='button';button.className='wp16-outline-button';button.textContent='Обновить';
    const close=document.createElement('button');close.type='button';close.className='wp16-update-close';close.setAttribute('aria-label','Позже');close.textContent='×';
    button.addEventListener('click',()=>{approvedUpdate=true;button.disabled=true;button.textContent='Обновляем…';reg.waiting?.postMessage({type:'SKIP_WAITING'});});
    close.addEventListener('click',()=>bar.remove());bar.append(copy,button,close);document.body.appendChild(bar);
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(approvedUpdate&&!reloadAttached){reloadAttached=true;location.reload();}});
  navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
    if(reg.waiting)showUpdate(reg);
    reg.addEventListener('updatefound',()=>{const installing=reg.installing;if(!installing)return;installing.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg);});});
    reg.update().catch(()=>{});
    console.info('[WeatherPro/PWA] Service worker зарегистрирован:',reg.scope);
  }).catch(err=>console.warn('[WeatherPro/PWA] Service worker недоступен:',err));
}

/* ============================================================
   SETTINGS
   ============================================================ */

function loadSettings(){
  try{ settings=JSON.parse(localStorage.getItem(KEYS.SETTINGS))||{}; }catch(e){settings={};}
  settings=Object.assign({
    darkTheme:true,animations:true,units:'metric',autoLocation:true,
    weatherNotifications:false,browserNotifications:false,soundNotifications:false,
    saveHistory:true,autoSave:true,accentColor:'#3b82f6',theme:'default',autoTheme:true,
    timeFormat:'24h', compactMode:false, windUnit:'ms',
    optimizationEnabled:true, autoOptimize:true, batterySaver:false, lightEffects:false, pauseBackground:true
  },settings);
  $('darkTheme').checked=settings.darkTheme; $('animations').checked=settings.animations;
  $('unitsSelect').value=settings.units; $('autoLocation').checked=settings.autoLocation;
  $('weatherNotifications').checked=settings.weatherNotifications;
  $('browserNotifications').checked=settings.browserNotifications;
  $('soundNotifications').checked=settings.soundNotifications;
  $('saveHistory').checked=settings.saveHistory; $('autoSave').checked=settings.autoSave;
  $('autoThemeToggle').checked=settings.autoTheme;
  $('timeFormatSelect').value=settings.timeFormat;
  $('compactMode').checked=settings.compactMode;
  $('windUnitSelect').value=settings.windUnit;
  $('optimizationEnabled').checked=settings.optimizationEnabled!==false;
  $('autoOptimize').checked=settings.autoOptimize!==false;
  $('batterySaver').checked=!!settings.batterySaver;
  $('lightEffects').checked=!!settings.lightEffects;
  $('pauseBackground').checked=settings.pauseBackground!==false;
  applyTheme(); applyAccent(settings.accentColor);
  if(!settings.autoTheme) applyTheme2(settings.theme);
  applyPerformanceSettings();
}
function applyTheme(){
  document.body.style.setProperty('--primary',settings.darkTheme?'#0a0e17':'#f0f4f8');
  document.body.style.setProperty('--secondary',settings.darkTheme?'#1a2332':'#e2e8f0');
  document.body.style.setProperty('--text',settings.darkTheme?'#f8fafc':'#0a0e17');
  document.body.style.setProperty('--text-secondary',settings.darkTheme?'#94a3b8':'#475569');
  document.body.style.setProperty('--glass-bg',settings.darkTheme?'rgba(30,41,59,.28)':'rgba(255,255,255,.55)');
  document.body.style.setProperty('--glass-border',settings.darkTheme?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)');
}
function applyAccent(color){
  document.documentElement.style.setProperty('--accent',color);
  document.documentElement.style.setProperty('--accent-light',color);
  document.documentElement.style.setProperty('--gradient',`linear-gradient(135deg,${color},${color}dd)`);
  settings.accentColor=color;
  if(settings.autoSave) saveSettingsSilent();
}
function applyTheme2(name, silent=false){
  const themes={
    default:{g:'linear-gradient(135deg,#0a0e17,#1a2332)',p:'#0a0e17'},
    cosmos:{g:'linear-gradient(135deg,#0b0e1a,#1a1a3e)',p:'#0b0e1a'},
    ocean:{g:'linear-gradient(135deg,#0a1628,#0d2847)',p:'#0a1628'},
    sunset:{g:'linear-gradient(135deg,#2a1410,#4a2418)',p:'#1a0e0a'},
    forest:{g:'linear-gradient(135deg,#0a1a0e,#0d2d1a)',p:'#0a1a0e'},
    snow:{g:'linear-gradient(135deg,#1a2434,#2c3e5a)',p:'#1a2434'},
    rain:{g:'linear-gradient(135deg,#080d1c,#152b4a)',p:'#080d1c'}
  };
  const t=themes[name]||themes.default;
  document.body.style.setProperty('--theme-gradient',t.g);
  if(settings.darkTheme) document.body.style.setProperty('--primary',t.p);
  if(!silent) settings.theme=name;
  document.querySelectorAll('.theme-option').forEach(el=>el.classList.toggle('active',el.dataset.theme===name));
  if(settings.autoSave) saveSettingsSilent();
}
function autoTheme(d){
  if(!settings.autoTheme || !d) return;
  const now = Date.now()/1000;
  const isDay = d.sys.sunrise && d.sys.sunset && now > d.sys.sunrise && now < d.sys.sunset;
  const main = d.weather[0].main;
  let theme = 'default';
  if(isDay){
    if(main === 'Clear') theme = 'ocean';
    else if(main === 'Rain' || main === 'Drizzle') theme = 'rain';
    else if(main === 'Thunderstorm') theme = 'cosmos';
    else if(main === 'Snow') theme = 'snow';
  } else {
    if(main === 'Clear') theme = 'cosmos';
    else if(main === 'Rain' || main === 'Drizzle' || main === 'Thunderstorm') theme = 'rain';
    else theme = 'cosmos';
  }
  applyTheme2(theme, true);
  updateDayNightIndicator(isDay);
}
function updateDayNightIndicator(isDay){
  const b = $('dayNightBadge');
  if(!b) return;
  b.classList.toggle('night', !isDay);
  b.innerHTML = isDay ? `${svg('i-sun')}<span>День</span>` : `${svg('i-moon')}<span>Ночь</span>`;
}
function saveSettingsSilent(){ localStorage.setItem(KEYS.SETTINGS,JSON.stringify(settings)); }
function saveSettings(){
  settings=Object.assign(settings,{
    darkTheme:$('darkTheme').checked, animations:$('animations').checked,
    units:$('unitsSelect').value, autoLocation:$('autoLocation').checked,
    weatherNotifications:$('weatherNotifications').checked,
    browserNotifications:$('browserNotifications').checked,
    soundNotifications:$('soundNotifications').checked,
    saveHistory:$('saveHistory').checked, autoSave:$('autoSave').checked,
    autoTheme:$('autoThemeToggle').checked,
    timeFormat:$('timeFormatSelect').value,
    compactMode:$('compactMode').checked,
    windUnit:$('windUnitSelect').value,
    optimizationEnabled:$('optimizationEnabled').checked,
    autoOptimize:$('autoOptimize').checked,
    batterySaver:$('batterySaver').checked,
    lightEffects:$('lightEffects').checked,
    pauseBackground:$('pauseBackground').checked
  });
  saveSettingsSilent(); applyTheme(); applyCompactMode(settings.compactMode); applyPerformanceSettings();
  if(!settings.autoTheme) applyTheme2(settings.theme);
  getWeather($('locationName').textContent.split(',')[0]);
  syncToCloud();
  showNotification('Настройки сохранены');
}
window.saveSettings=saveSettings;
function resetSettings(){
  if(!confirm('Сбросить настройки?')) return;
  localStorage.removeItem(KEYS.SETTINGS); loadSettings(); applyCompactMode(settings.compactMode); showNotification('Настройки сброшены');
}
window.resetSettings=resetSettings;
function initColors(){
  const colors=['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444'];
  const c=$('colorOptions'); c.innerHTML='';
  colors.forEach(col=>{
    const d=document.createElement('div');
    d.className='color-option'+(col===settings.accentColor?' active':'');
    d.style.background=col; d.dataset.color=col;
    d.onclick=()=>{document.querySelectorAll('.color-option').forEach(el=>el.classList.remove('active'));d.classList.add('active');applyAccent(col);syncToCloud();};
    c.appendChild(d);
  });
}
function initThemes(){
  const themes=[['default','Классика'],['cosmos','Космос'],['ocean','Океан'],['sunset','Закат'],['forest','Лес'],['snow','Снег'],['rain','Дождь']];
  const c=$('themeOptions'); c.innerHTML='';
  themes.forEach(([id,label])=>{
    const b=document.createElement('button');
    b.className='theme-option'+(id===settings.theme?' active':'');
    b.dataset.theme=id; b.textContent=label;
    b.onclick=()=>{settings.autoTheme=false; $('autoThemeToggle').checked=false; applyTheme2(id); saveSettingsSilent(); syncToCloud();};
    c.appendChild(b);
  });
}

/* ============================================================
   USER
   ============================================================ */

function loadUser(){
  let cached=null;
  try{ cached=JSON.parse(localStorage.getItem(KEYS.USER)); }catch(e){}
  // Firebase's observer may restore a session just before DOMContentLoaded.
  // Preserve that confirmed identity instead of replacing it with the guest cache.
  if(fbAuthReady && (fbUser || fbAuth?.currentUser)){
    wp6AdoptFirebaseIdentity(fbUser || fbAuth.currentUser);
    return;
  }
  // localStorage is only a profile cache, never proof of an active Firebase session.
  const safeCity = cached?.id === 'guest' && cached.defaultCity ? cached.defaultCity : 'Москва';
  currentUser={id:'guest',name:'Гость',email:'',avatar:null,avatarIcon:null,defaultCity:safeCity,registrationDate:new Date().toISOString(),bio:''};
}
function saveUser(){
  try{localStorage.setItem(KEYS.USER,JSON.stringify(currentUser));}catch(error){console.warn('[WeatherPro/Profile] Не удалось записать общий кэш:',error);}
  if(currentUser?.id&&currentUser.id!=='guest')wp16WriteProfileCache(currentUser);
}
function updateUI(){
  const av=$('userAvatar');
  renderAvatarElement(av,currentUser.avatar,currentUser.avatarIcon||'i-user',currentUser.name||'Аватар пользователя');
  $('userName').textContent=currentUser.name;
  $('profileName').value=currentUser.name||'';
  const profileEmail=$('profileEmail'); if(profileEmail){ profileEmail.value=(fbUser && fbUser.email) ? fbUser.email : (currentUser.email||''); profileEmail.readOnly=true; profileEmail.setAttribute('aria-readonly','true'); }
  $('profileCity').value=currentUser.defaultCity||'';
  $('profileDate').value=currentUser.registrationDate?new Date(currentUser.registrationDate).toLocaleDateString('ru-RU'):'';
  $('profileBio').value=currentUser.bio||'';
  const pv=$('avatarPreview');
  renderAvatarElement(pv,currentUser.avatar,currentUser.avatarIcon||'i-user',currentUser.name||'Аватар пользователя');
  if(typeof window.wp17UpdateFounderBadge==='function') window.wp17UpdateFounderBadge();
}
function switchAuthForm(f){
  const l=$('loginForm'), r=$('registerForm'), b=document.querySelectorAll('#authSwitcher .page-switch');
  if(f==='login'){ l.style.display='block'; r.style.display='none'; b[0].classList.add('active'); b[1].classList.remove('active'); }
  else { l.style.display='none'; r.style.display='block'; b[0].classList.remove('active'); b[1].classList.add('active'); }
}
window.switchAuthForm=switchAuthForm;
async function logout(){
  if(!confirm('Выйти из аккаунта?')) return;
  try {
    if(fbReady && fbAuth && (fbUser || fbAuth.currentUser)) await fbAuth.signOut();
    else {
      currentUser={id:'guest',name:'Гость',email:'',avatar:null,avatarIcon:null,defaultCity:'Москва',registrationDate:new Date().toISOString(),bio:''};
      saveUser(); updateUI();
    }
    showPage('auth');
    showNotification('Вы вышли');
    $('userMenu').classList.remove('show');
  } catch (error) {
    console.error('[WeatherPro/Auth] Ошибка выхода:', error);
    showNotification('Не удалось выйти: ' + (error.code || error.message), true);
  }
}
window.logout=logout;
async function saveProfile(){
  const n=$('profileName').value.trim(),e=(fbUser&&fbUser.email)?fbUser.email:(currentUser.email||''),c=$('profileCity').value.trim(),b=$('profileBio').value.trim();
  if(!n){showNotification('Введите имя',true);$('profileName')?.focus();return;}
  const emailField=$('profileEmail');if(emailField)emailField.value=e;
  Object.assign(currentUser,{name:n.slice(0,48),email:e,defaultCity:c.slice(0,80),bio:b.slice(0,500),_wp16ProfileDirty:true});
  saveUser();updateUI();
  const synced=fbUser?await syncToCloud():true;
  showNotification(fbUser&&!synced?'Профиль сохранён на устройстве. Облачная синхронизация не выполнена.':'Профиль сохранён');
}
window.saveProfile=saveProfile;
const AV_ICONS=['i-av-1','i-av-2','i-av-3','i-av-4','i-av-5','i-av-6','i-av-7','i-av-8','i-av-9','i-av-10'];
function changeAvatar(){
  const o=$('avatarOptions'); o.innerHTML=''; selectedAvatar=null;
  AV_ICONS.forEach(ic=>{
    const d=document.createElement('div');
    d.className='avatar-option'; d.innerHTML=svg(ic);
    d.onclick=()=>{document.querySelectorAll('.avatar-option').forEach(e=>e.classList.remove('selected'));d.classList.add('selected');selectedAvatar=ic;};
    o.appendChild(d);
  });
  $('customAvatarInput').value='';
  $('avatarModal').classList.add('show'); document.body.style.overflow='hidden';
}
window.changeAvatar=changeAvatar;
function compressImage(file){
  return new Promise((resolve,reject)=>{
    if(!file || !file.type || !file.type.startsWith('image/')){reject(new Error('Выберите файл изображения'));return;}
    if(file.size>20*1024*1024){reject(new Error('Файл слишком большой. Выберите изображение до 20 МБ.'));return;}
    const image=new Image();
    const objectUrl=URL.createObjectURL(file);
    image.onload=()=>{
      try{
        const sourceWidth=image.naturalWidth||image.width,sourceHeight=image.naturalHeight||image.height;
        if(!sourceWidth||!sourceHeight)throw new Error('Изображение имеет некорректные размеры');
        const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
        if(!context)throw new Error('Не удалось обработать изображение');
        // Base64 is stored in Firestore and in the UID-specific local profile cache.
        // Keep it comfortably below Firestore's 1 MiB document limit.
        let scale=Math.min(1,512/Math.max(sourceWidth,sourceHeight)),result='';
        const qualities=[0.82,0.74,0.66,0.58,0.50];
        for(let pass=0;pass<5;pass++){
          const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
          canvas.width=width;canvas.height=height;
          context.clearRect(0,0,width,height);
          context.fillStyle='#081225';context.fillRect(0,0,width,height);
          context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
          context.drawImage(image,0,0,width,height);
          for(const quality of qualities){
            result=canvas.toDataURL('image/jpeg',quality);
            if(result.length<=120000)break;
          }
          if(result.length<=120000)break;
          scale*=0.78;
        }
        URL.revokeObjectURL(objectUrl);
        if(!result||result.length>150000)throw new Error('Не удалось уменьшить фотографию до размера, подходящего для Base64 в Firestore. Выберите другое фото.');
        resolve(result);
      }catch(error){URL.revokeObjectURL(objectUrl);reject(error);}
    };
    image.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error('Не удалось загрузить изображение'));};
    image.src=objectUrl;
  });
}
window.compressImage=compressImage;

async function saveAvatar(){
  const files=$('customAvatarInput')?.files;
  let changed=false;
  if(files&&files[0]){
    try{
      const compressedAvatar=await compressImage(files[0]);
      currentUser.avatar=compressedAvatar;currentUser.avatarIcon=null;changed=true;
    }catch(error){showNotification(error.message||'Не удалось обработать аватар',true);return;}
  }else if(selectedAvatar){currentUser.avatar=null;currentUser.avatarIcon=selectedAvatar;changed=true;}
  else{showNotification('Выберите аватар',true);return;}
  // Persist before network activity so reload/offline does not remove the photo.
  currentUser._wp16ProfileDirty=true;
  saveUser();updateUI();
  const cloudSaved=fbUser?await syncToCloud():true;
  closeAvatarModal();
  if(fbUser&&!cloudSaved)showNotification('Аватар сохранён на устройстве в Base64. Облачная синхронизация не завершилась — проверьте интернет и повторите сохранение.',true);
  else showNotification(files&&files[0]?'Аватар сохранён в Base64':'Аватар изменён');
}
window.saveAvatar=saveAvatar;
function closeAvatarModal(){ $('avatarModal').classList.remove('show'); document.body.style.overflow='auto'; }
window.closeAvatarModal=closeAvatarModal;




/* ============================================================
   HISTORY / FAVORITES
   ============================================================ */

function getHistoryList(){ try{return JSON.parse(localStorage.getItem(KEYS.SEARCH))||[];}catch(e){return[];} }
function addToSearch(city){
  if(!settings.saveHistory || !city) return;
  const n=city.trim(); if(!n) return;
  let h=getHistoryList().filter(x=>x!==n); h.unshift(n); if(h.length>10) h=h.slice(0,10);
  localStorage.setItem(KEYS.SEARCH,JSON.stringify(h)); loadSearchHistory(); syncToCloud();
}
function loadSearchHistory(){
  const h=getHistoryList(), g=$('historyGrid'), c=$('searchHistory');
  if(h.length&&settings.saveHistory){
    c.classList.add('visible'); g.innerHTML='';
    h.forEach(city=>{
      const el=document.createElement('button');
      el.className='history-item'; el.textContent=city;
      el.onclick=()=>{$('cityInput').value=city;getWeather(city);};
      g.appendChild(el);
    });
  } else c.classList.remove('visible');
}
function clearSearchHistory(){ localStorage.removeItem(KEYS.SEARCH); loadSearchHistory(); syncToCloud(); showNotification('История очищена'); }
window.clearSearchHistory=clearSearchHistory;

let acTimer=null, acIndex=-1, acItems=[];
function initAutocomplete(){
  const inp=$('cityInput'), ac=$('autocomplete');
  inp.addEventListener('input',()=>{
    clearTimeout(acTimer);
    const q=inp.value.trim();
    if(q.length<2){hideAC();return;}
    acTimer=setTimeout(()=>fetchAC(q),250);
  });
  inp.addEventListener('focus',()=>{
    const q=inp.value.trim();
    if(q.length>=2 && acItems.length) renderAC();
  });
  inp.addEventListener('keydown',e=>{
    if(!ac.classList.contains('show')) return;
    if(e.key==='ArrowDown'){acIndex=Math.min(acIndex+1,acItems.length-1);e.preventDefault();renderAC();}
    else if(e.key==='ArrowUp'){acIndex=Math.max(acIndex-1,0);e.preventDefault();renderAC();}
    else if(e.key==='Enter'&&acIndex>=0){pickAC(acItems[acIndex]);e.preventDefault();}
    else if(e.key==='Escape') hideAC();
  });
  document.addEventListener('click',e=>{ if(!ac.contains(e.target)&&e.target!==inp) hideAC(); });
}
async function fetchAC(q){
  try{
    const r=await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=6&appid=${OWM_KEY}`);
    if(!r.ok) throw 0;
    const d=await r.json();
    acItems=d||[]; acIndex=-1;
    if(!acItems.length){hideAC();return;}
    renderAC();
  }catch(e){hideAC();}
}
function renderAC(){
  const ac=$('autocomplete'); ac.innerHTML='';
  if(!acItems.length){ ac.classList.remove('show'); return; }
  acItems.forEach((it,i)=>{
    const el=document.createElement('button');
    el.type='button';
    el.className='ac-item'+(i===acIndex?' sel':'');
    const statePart = it.state ? `, ${esc(it.state)}` : '';
    el.innerHTML = `${svg('i-pin')}<span class="ac-name">${esc(it.name)}<span class="ac-state">${statePart}</span></span><span class="ac-country">${esc(it.country||'')}</span>`;
    el.onclick=()=>pickAC(it);
    ac.appendChild(el);
  });
  ac.classList.add('show');
}
function pickAC(it){ $('cityInput').value=it.name; hideAC(); getWeather(it.name); addToSearch(it.name); }
function hideAC(){ $('autocomplete').classList.remove('show'); acIndex=-1; }

function getFavs(){ try{return JSON.parse(localStorage.getItem(KEYS.FAV))||[];}catch(e){return[];} }
function toggleFavorite(){
  const city=$('locationName').textContent.split(',')[0].trim();
  let f=getFavs(); const i=f.indexOf(city);
  if(i===-1){ f.push(city); showNotification(`${city} в избранном`); }
  else { f.splice(i,1); showNotification(`${city} удалён из избранного`); }
  localStorage.setItem(KEYS.FAV,JSON.stringify(f));
  updateFavBtn(); renderFavorites(); renderMultiCityHome(); syncToCloud();
}
window.toggleFavorite=toggleFavorite;
function updateFavBtn(){
  const city=$('locationName').textContent.split(',')[0].trim();
  const btn=$('favoriteBtn'); const active=getFavs().includes(city);
  btn.classList.toggle('active',active);
  btn.innerHTML=svg(active?'i-star-fill':'i-star');
}
function showFavorites(){ showPage('favorites'); renderFavorites(); }
window.showFavorites=showFavorites;
function renderFavorites(){
  const g=$('favoritesGrid'), f=getFavs();
  if(!f.length){ g.innerHTML='<p style="color:var(--text-secondary);text-align:center;padding:20px;grid-column:1/-1">Пока нет избранных городов</p>'; return; }
  g.innerHTML='';
  f.forEach(city=>{
    const card=document.createElement('div'); card.className='fav-city-card';
    card.innerHTML=`
      <div class="fav-city-name">${esc(city)}</div>
      <div class="fav-city-icon">${svg('i-cloud-sun')}</div>
      <div class="fav-city-temp">--</div>
      <button class="fav-remove">${svg('i-x')} Удалить</button>`;
    card.onclick=(e)=>{ if(e.target.closest('.fav-remove'))return; $('cityInput').value=city; getWeather(city); showPage('home'); };
    card.querySelector('.fav-remove').onclick=(e)=>{e.stopPropagation();removeFav(city);};
    g.appendChild(card);
    fetchFav(city,card);
  });
}
async function fetchFav(city,card){
  try{
    const u=settings.units||'metric';
    const r=await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OWM_KEY}&units=${u}&lang=ru`);
    const d=await r.json();
    if(d.cod===200){
      card.querySelector('.fav-city-temp').textContent=Math.round(d.main.temp)+'°';
      card.querySelector('.fav-city-icon').innerHTML=svg(iconFor(d.weather[0].main));
    }
  }catch(e){}
}
function removeFav(city){
  localStorage.setItem(KEYS.FAV,JSON.stringify(getFavs().filter(c=>c!==city)));
  renderFavorites(); updateFavBtn(); renderMultiCityHome(); syncToCloud(); showNotification(`${city} удалён`);
}

/* ============================================================
   ICONS
   ============================================================ */

function iconFor(main){
  return ({
    Clear:'i-sun',Clouds:'i-cloud-sun',Rain:'i-cloud-rain',Snow:'i-cloud-snow',
    Thunderstorm:'i-zap',Drizzle:'i-cloud-drizzle',Mist:'i-fog',Fog:'i-fog',
    Smoke:'i-fog',Haze:'i-fog',Dust:'i-wind',Sand:'i-wind',Ash:'i-alert-tri',
    Squall:'i-wind',Tornado:'i-tornado'
  })[main]||'i-cloud-sun';
}

/* ============================================================
   CACHE / LOAD
   ============================================================ */

function loadCacheAll(){ try{return JSON.parse(localStorage.getItem(KEYS.CACHE))||{};}catch(e){return{};} }
function cachePut(city,data){
  const all=loadCacheAll();
  all[city]={ts:Date.now(),data};
  const keys=Object.keys(all).sort((a,b)=>all[b].ts-all[a].ts).slice(0,20);
  const trimmed={}; keys.forEach(k=>trimmed[k]=all[k]);
  try{ localStorage.setItem(KEYS.CACHE,JSON.stringify(trimmed)); }catch(e){}
}
function cacheGet(city){
  const all=loadCacheAll(); const e=all[city];
  if(!e) return null;
  if(Date.now()-e.ts>FETCH_TTL*2) return null;
  return e.data;
}
function restoreCache(){
  const last=localStorage.getItem(KEYS.LAST)||'Москва';
  const c=cacheGet(last);
  if(!c) return;
  renderCurrent(c.current); renderForecast(c.forecast); renderHourly(c.forecast); renderCharts(c.forecast);
  renderStats(c.forecast); updateFavBtn(); updateWidget();
  lastWeatherData=c.current; lastForecastData=c.forecast;
  if(typeof wp80RememberWeather==='function')wp80RememberWeather(c.current,c.forecast,last);
  if(c.forecast){ renderWeatherIntelligence(c.current,c.forecast); refreshSmartModules(c.current,c.forecast); evaluateSmartWeatherAlerts(c.current,c.forecast); }
  if(typeof wp80Init==='function')wp80Init();
  applyWeatherAtmosphere(c.current);
  autoTheme(c.current);
}
function saveLast(c){ if(c&&c.trim()) localStorage.setItem(KEYS.LAST,c.trim()); }
function loadWeather(){
  let c=currentUser.defaultCity||'Москва';
  const l=localStorage.getItem(KEYS.LAST); if(l) c=l;
  $('cityInput').value=c; getWeather(c);
}
async function getWeather(city){
  if(!city||!city.trim()) return;
  currentCity=city;
  const key=city.toLowerCase();
  if(lastFetchAt[key] && Date.now()-lastFetchAt[key]<FETCH_TTL){
    const c=cacheGet(city);
    if(c){ renderAll(c); return; }
  }
  showLoading(true);
  try{
    const u=settings.units||'metric';
    const r=await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OWM_KEY}&units=${u}&lang=ru`);
    if(!r.ok) throw 0;
    const d=await r.json();
    if(d.cod!==200) throw 0;
    renderCurrent(d); lastWeatherData=d; window.wp15CurrentSource='OpenWeather';
    if(typeof wp80RememberWeather==='function')wp80RememberWeather(d,null,city);
    if(typeof wp80Init==='function')wp80Init();
    autoTheme(d);
    const [aqiR,forecastR]=await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${d.coord.lat}&lon=${d.coord.lon}&appid=${OWM_KEY}`).catch(()=>null),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${d.coord.lat}&lon=${d.coord.lon}&appid=${OWM_KEY}&units=${u}&lang=ru`)
    ]);
    if(aqiR && aqiR.ok) renderAQI(await aqiR.json());
    if(forecastR.ok){
      const f=await forecastR.json();
      if(f.cod==="200"){
        renderForecast(f); renderHourly(f); renderCharts(f); renderStats(f); renderNowcast(f);
        lastForecastData=f;
        if(typeof wp80RememberWeather==='function')wp80RememberWeather(d,f,city);
        renderWeatherIntelligence(d,f);
        evaluateSmartWeatherAlerts(d,f);
        refreshSmartModules(d,f);
        if(document.getElementById('planet-page')?.classList.contains('active')) setTimeout(()=>wp70Refresh(),0);
        cachePut(city,{current:d,forecast:f});
        saveHist(city,f);
        wp80CaptureAccuracy(d,f);
        if(f.list && f.list.length>1) updateTempTrend(d.main.temp, f.list[1].main.temp);
      }
    }
    renderAlerts(d);
    loadYearAgo(d.coord.lat, d.coord.lon);
    loadPollen(d.coord.lat, d.coord.lon);
    fetch(`https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${d.coord.lat}&lon=${d.coord.lon}&appid=${OWM_KEY}`)
      .then(x => x.ok ? x.json() : null).then(j => j && renderAQIForecast(j)).catch(()=>{});
    updateFavBtn(); updateWidget();
    updateMap(d.coord.lat,d.coord.lon);
    showNotification(`Погода: ${d.name}`);
    saveLast(city); addToSearch(city);
    lastFetchAt[key]=Date.now();
    renderMultiCityHome();
  }catch(e){
    console.warn(e);
    const c=cacheGet(city);
    if(c){ renderAll(c); showNotification('Офлайн-данные',false); }
    else { showNotification('Ошибка загрузки',true); loadTestForecast(); }
  } finally { showLoading(false); }
}
window.getWeather=getWeather;
function renderAll(c){
  renderCurrent(c.current);
  if(c.forecast){ renderForecast(c.forecast); renderHourly(c.forecast); renderCharts(c.forecast); renderStats(c.forecast); renderNowcast(c.forecast); }
  lastWeatherData=c.current; lastForecastData=c.forecast;
  if(typeof wp80RememberWeather==='function')wp80RememberWeather(c.current,c.forecast,currentCity);
  if(c.forecast){renderWeatherIntelligence(c.current,c.forecast);refreshSmartModules(c.current,c.forecast);evaluateSmartWeatherAlerts(c.current,c.forecast);}
  if(typeof wp80Init==='function')wp80Init();
  autoTheme(c.current);
  updateFavBtn(); updateWidget();
  updateMap(c.current.coord.lat,c.current.coord.lon);
}

