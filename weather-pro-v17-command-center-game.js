/* Weather Pro V17.1.1 — standalone browser Command Center + playable Storm Runner. */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const FOUNDER_EMAIL = 'killedofficialbd@gmail.com';

  function currentAuthUser(){
    try {
      if(typeof fbAuth==='undefined' || !fbAuth) return null;
      // Wait for Firebase's first auth-state callback. Never trust a cached profile/fbUser.
      if(typeof fbAuthReady!=='undefined' && !fbAuthReady) return null;
      return fbAuth.currentUser || null;
    } catch(_) { return null; }
  }
  function isFounder(){ const u=currentAuthUser(); return !!u && String(u.email||'').trim().toLowerCase()===FOUNDER_EMAIL; }

  // Founder marker is presentation-only and is based on the active Firebase Auth identity,
  // never on editable profile text or a cached localStorage value.
  window.wp17UpdateFounderBadge = function(){
    const badge=$('wp17FounderBadge');
    const visible=isFounder();
    if(badge){ badge.hidden=!visible; badge.setAttribute('aria-hidden',String(!visible)); }
  };
  window.wp17UpdateFounderBadge();
  try {
    if(typeof fbAuth!=='undefined' && fbAuth?.onAuthStateChanged)
      fbAuth.onAuthStateChanged(()=>window.wp17UpdateFounderBadge());
  } catch(error) { console.warn('[WeatherPro/Foundation] Не удалось подписаться на состояние входа:',error); }

  function setText(id,value){const el=$(id);if(el)el.textContent=String(value??'—');}
  function status(label,ok,detail){return {label,ok,detail};}
  function buildChecks(){
    const user=currentAuthUser();
    let storageOk=false;
    try{const key='wp17_storage_probe';localStorage.setItem(key,'1');localStorage.removeItem(key);storageOk=true;}catch(_){storageOk=false;}
    const weather=typeof lastWeatherData!=='undefined'&&!!lastWeatherData;
    const checks=[
      status('JavaScript runtime',true,'Интерфейс и игровые модули загружены'),
      status('Firebase SDK',typeof fbReady!=='undefined'&&!!fbReady,typeof fbReady!=='undefined'&&fbReady?'Клиент инициализирован':'SDK не инициализирован'),
      status('Аккаунт',!!user, user ? (isFounder()?'Вход выполнен · Основатель':'Вход выполнен') : 'Гостевой режим'),
      status('Firestore',typeof fbDb!=='undefined'&&!!fbDb,typeof fbDb!=='undefined'&&fbDb?'Клиент Firestore готов':'Клиент Firestore недоступен'),
      status('Сеть',navigator.onLine===true,navigator.onLine?'Браузер сообщает: онлайн':'Нет сетевого соединения'),
      status('PWA / Service Worker','serviceWorker' in navigator,('serviceWorker' in navigator)?(navigator.serviceWorker.controller?'Service Worker управляет страницей':'Поддержка есть; контроллер может появиться после перезагрузки'):'Не поддерживается'),
      status('Локальное хранилище',storageOk,storageOk?'LocalStorage доступен':'Запись в LocalStorage заблокирована'),
      status('Погодные данные',weather,weather?`Последний загруженный город: ${lastWeatherData.name||currentCity||'выбранный город'}`:'Данные появятся после загрузки прогноза')
    ];
    return checks;
  }
  function renderCommandCenter(){
    const checks=buildChecks();
    const healthy=checks.filter(x=>x.ok).length;
    const score=Math.round(healthy/checks.length*100);
    setText('wp17SystemScore',`${score}%`);
    setText('wp17SystemScoreMeta',`${healthy} из ${checks.length} проверок доступны`);
    setText('wp17SystemState',score>=75?'Система в рабочем состоянии':score>=50?'Есть ограничения':'Требуется внимание');
    setText('wp17SystemCheckedAt',new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
    setText('wp17CurrentVersion','V17.1 · Static Web');
    const auth=checks.find(x=>x.label==='Аккаунт');
    setText('wp17AccountState',auth.ok?(isFounder()?'Основатель':'Подключён'):'Гость');
    setText('wp17NetworkState',navigator.onLine?'Онлайн':'Офлайн');
    setText('wp17WeatherState',checks.find(x=>x.label==='Погодные данные').ok?'Данные загружены':'Ожидает загрузки');
    const list=$('wp17SystemChecks');
    if(list)list.innerHTML=checks.map(c=>`<div class="wp17-scan-row"><span>${c.label}</span><strong style="color:${c.ok?'#34d399':'#fbbf24'}">${c.ok?'ДОСТУПНО':'ОГРАНИЧЕНО'} · ${c.detail.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</strong></div>`).join('');
    const led=$('wp17SystemLed');if(led){led.classList.toggle('warn',score<75);}
    window.wp17LastSystemReport={product:'Weather Pro',version:'V17.1',createdAt:new Date().toISOString(),score,checks:checks.map(c=>({name:c.label,available:c.ok,detail:c.detail})),runtime:{online:navigator.onLine,standalone:!!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches),serviceWorkerSupported:'serviceWorker' in navigator,serviceWorkerControlled:!!navigator.serviceWorker?.controller,language:navigator.language,viewport:{width:innerWidth,height:innerHeight}},weather:{loaded:!!(typeof lastWeatherData!=='undefined'&&lastWeatherData),city:(typeof lastWeatherData!=='undefined'&&lastWeatherData?.name)||null}};
    return window.wp17LastSystemReport;
  }
  window.wp17RefreshCommandCenter=renderCommandCenter;
  window.wp17ExportSystemReport=function(){
    const report=renderCommandCenter();
    try{const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='weather-pro-system-report-v17.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);if(typeof showNotification==='function')showNotification('Отчёт Command Center сохранён');}
    catch(error){console.error('[WeatherPro/V17] Report export failed',error);if(typeof showNotification==='function')showNotification('Не удалось экспортировать отчёт',true);}
  };
  window.wp17CommandCenterOpened=function(){renderCommandCenter();};
  window.addEventListener('online',()=>{if($('command-center-page')?.classList.contains('active'))renderCommandCenter();});
  window.addEventListener('offline',()=>{if($('command-center-page')?.classList.contains('active'))renderCommandCenter();});

  /* Storm Runner: self-contained 2D canvas game; no external engine, backend or Node.js. */
  const canvas=$('wp17StormCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=960,H=430;
  let raf=0,lastFrame=0,active=false,state='idle',elapsed=0,score=0,best=0,spawnHazard=0,spawnOrb=0,playerX=W/2,objects=[],keys={left:false,right:false},stars=[];
  try{best=Number(localStorage.getItem('wp17_storm_runner_best')||0)||0;}catch(_){best=0;}
  for(let i=0;i<70;i++)stars.push({x:Math.random()*W,y:Math.random()*H,r:.5+Math.random()*1.5,a:.15+Math.random()*.5});
  const playerY=H-70;
  function updateStats(){setText('wp17GameScore',score);setText('wp17GameBest',best);setText('wp17GameTime',`${Math.floor(elapsed)}с`);}
  function showOverlay(title,copy,button){const overlay=$('wp17GameOverlay');if(!overlay)return;setText('wp17GameOverlayTitle',title);setText('wp17GameOverlayCopy',copy);setText('wp17GameOverlayButton',button);overlay.hidden=false;}
  function hideOverlay(){const overlay=$('wp17GameOverlay');if(overlay)overlay.hidden=true;}
  function drawBackground(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0b1d37');g.addColorStop(.55,'#0a1930');g.addColorStop(1,'#071326');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();stars.forEach(s=>{ctx.globalAlpha=s.a;ctx.fillStyle='#b9dcff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});ctx.restore();
    ctx.strokeStyle='rgba(96,165,250,.075)';ctx.lineWidth=1;for(let x=0;x<=W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<=H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.strokeStyle='rgba(56,189,248,.18)';ctx.setLineDash([4,10]);ctx.beginPath();ctx.moveTo(20,playerY+35);ctx.lineTo(W-20,playerY+35);ctx.stroke();ctx.setLineDash([]);
  }
  function drawPlayer(){
    ctx.save();ctx.translate(playerX,playerY);
    ctx.shadowColor='rgba(56,189,248,.8)';ctx.shadowBlur=24;
    ctx.fillStyle='#7dd3fc';ctx.beginPath();ctx.moveTo(0,-25);ctx.lineTo(24,12);ctx.lineTo(9,8);ctx.lineTo(0,17);ctx.lineTo(-9,8);ctx.lineTo(-24,12);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#e0f2fe';ctx.beginPath();ctx.ellipse(0,-4,5,10,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(125,211,252,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-15,15);ctx.lineTo(-21,29);ctx.moveTo(15,15);ctx.lineTo(21,29);ctx.stroke();
    ctx.restore();
  }
  function drawHazard(o){ctx.save();ctx.translate(o.x,o.y);ctx.shadowColor='rgba(251,191,36,.8)';ctx.shadowBlur=17;ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.moveTo(4,-21);ctx.lineTo(-13,4);ctx.lineTo(-2,4);ctx.lineTo(-8,24);ctx.lineTo(15,-7);ctx.lineTo(3,-7);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff2bf';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();}
  function drawOrb(o){ctx.save();ctx.translate(o.x,o.y);ctx.shadowColor='rgba(56,189,248,.9)';ctx.shadowBlur=20;ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#dff7ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.stroke();ctx.restore();}
  function render(){drawBackground();objects.forEach(o=>o.type==='hazard'?drawHazard(o):drawOrb(o));drawPlayer();if(state==='paused'){ctx.fillStyle='rgba(5,12,25,.45)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#eaf5ff';ctx.font='800 28px system-ui';ctx.textAlign='center';ctx.fillText('ПАУЗА',W/2,H/2);} }
  function endGame(){state='over';if(score>best){best=score;try{localStorage.setItem('wp17_storm_runner_best',String(best));}catch(_){}}updateStats();showOverlay('Игра окончена',`Счёт: ${score}. Личный рекорд: ${best}. Попробуй продержаться дольше и собрать больше энергетических сфер.`,'Играть снова');}
  function resetGame(){elapsed=0;score=0;spawnHazard=.7;spawnOrb=1.2;playerX=W/2;objects=[];keys.left=keys.right=false;state='running';hideOverlay();updateStats();}
  function startLoop(){if(!active||raf)return;lastFrame=0;raf=requestAnimationFrame(frame);}
  function frame(ts){raf=0;if(!active)return;const dt=lastFrame?Math.min((ts-lastFrame)/1000,.04):0;lastFrame=ts;if(state==='running')step(dt);render();if(active)raf=requestAnimationFrame(frame);}
  function step(dt){
    elapsed+=dt;const move=(keys.right?1:0)-(keys.left?1:0);playerX=Math.max(30,Math.min(W-30,playerX+move*380*dt));
    spawnHazard-=dt;spawnOrb-=dt;
    if(spawnHazard<=0){objects.push({type:'hazard',x:45+Math.random()*(W-90),y:-25,speed:175+Math.min(elapsed*2.2,100)+Math.random()*50});spawnHazard=Math.max(.42,1.05-Math.min(elapsed*.008,.4))+Math.random()*.3;}
    if(spawnOrb<=0){objects.push({type:'orb',x:40+Math.random()*(W-80),y:-20,speed:145+Math.min(elapsed*1.3,70)});spawnOrb=1.35+Math.random()*.85;}
    for(let i=objects.length-1;i>=0;i--){const o=objects[i];o.y+=o.speed*dt;if(o.type==='hazard'&&Math.abs(o.x-playerX)<25&&Math.abs(o.y-playerY)<27){endGame();return;}if(o.type==='orb'&&Math.hypot(o.x-playerX,o.y-playerY)<30){score+=10;objects.splice(i,1);continue;}if(o.y>H+35){objects.splice(i,1);if(o.type==='hazard')score+=1;}}
    updateStats();
  }
  window.wp17GameStart=function(){resetGame();if(active)startLoop();};
  window.wp17GamePause=function(){if(state==='running'){state='paused';setText('wp17GamePauseButton','Продолжить');}else if(state==='paused'){state='running';setText('wp17GamePauseButton','Пауза');}if(active)startLoop();};
  window.wp17GameReset=function(){resetGame();if(active)startLoop();};
  window.wp17GamePageOpened=function(){active=true;if(state==='idle')showOverlay('Storm Runner','Управляй дроном: уворачивайся от молний и собирай голубые энергетические сферы. На компьютере используй ← → или A / D, на телефоне — кнопки управления.','Начать игру');else if(state==='over'){}startLoop();updateStats();};
  window.wp17GamePageClosed=function(){active=false;if(raf){cancelAnimationFrame(raf);raf=0;}keys.left=keys.right=false;};
  const startBtn=$('wp17GameOverlayButton');if(startBtn)startBtn.addEventListener('click',()=>window.wp17GameStart());
  const pauseBtn=$('wp17GamePauseButton');if(pauseBtn)pauseBtn.addEventListener('click',()=>window.wp17GamePause());
  const resetBtn=$('wp17GameResetButton');if(resetBtn)resetBtn.addEventListener('click',()=>window.wp17GameReset());
  function bindPad(id,key){const b=$(id);if(!b)return;const down=e=>{e.preventDefault();keys[key]=true;};const up=e=>{e.preventDefault();keys[key]=false;};b.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(type=>b.addEventListener(type,up));}
  bindPad('wp17GameLeft','left');bindPad('wp17GameRight','right');
  window.addEventListener('keydown',e=>{if(!active||state!=='running')return;if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')keys.left=true;if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')keys.right=true;}});
  window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')keys.left=false;if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')keys.right=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.left=keys.right=false;}});
  render();updateStats();
})();
