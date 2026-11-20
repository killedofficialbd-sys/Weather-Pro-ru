/* Weather Pro V16 module: 10-device-and-performance.js — extracted from the existing app script. */
/* WEATHER PRO 9.0 — interface architecture + connected workspaces */
let wp81AIWorkspace='assistant';
function wp81ScrollTo(id){
  const el=document.getElementById(id);if(!el)return;
  const target=el.closest('.social-section')||el.closest('.search-box')||el;
  target.scrollIntoView({behavior:'smooth',block:'center'});
  target.classList.remove('wp81-focus-pulse');void target.offsetWidth;target.classList.add('wp81-focus-pulse');
  setTimeout(()=>target.classList.remove('wp81-focus-pulse'),1100);
}
function wp81MapLayer(layer){
  const btn=document.querySelector(`#map-page .layer-btn[data-layer="${layer}"]`);
  if(btn){setMapLayer(btn);const map=document.getElementById('weatherMap');map?.scrollIntoView({behavior:'smooth',block:'center'});}
}
let wp13AiViewportRaf=0;
function wp13SetAIScrollLock(locked){
  const enabled=!!locked;
  document.documentElement.classList.toggle('wp13-ai-lock',enabled);
  document.body.classList.toggle('wp13-ai-lock',enabled);
  if(enabled){
    /* The AI workspace is fixed below the sticky app header. Start from scrollY=0. */
    window.scrollTo({top:0,left:0,behavior:'auto'});
  }
}
function wp13UpdateAIViewport(){
  if(wp13AiViewportRaf)cancelAnimationFrame(wp13AiViewportRaf);
  wp13AiViewportRaf=requestAnimationFrame(()=>{
    const page=document.getElementById('ai-page');
    const isMobile=window.matchMedia&&window.matchMedia('(max-width:768px)').matches;
    if(!page||!page.classList.contains('active')||!page.classList.contains('wp81-ai-assistant')){
      page?.style.removeProperty('--wp13-ai-top');
      page?.style.removeProperty('--wp13-ai-height');
      return;
    }
    if(!isMobile){
      wp13SetAIScrollLock(false);
      page.style.removeProperty('--wp13-ai-top');
      page.style.removeProperty('--wp13-ai-height');
      return;
    }
    if(!document.documentElement.classList.contains('wp13-ai-lock'))wp13SetAIScrollLock(true);
    const viewport=window.visualViewport;
    const viewportTop=Math.max(0,Math.round(Number(viewport?.offsetTop)||0));
    const viewportHeight=Math.max(180,Math.round(Number(viewport?.height)||window.innerHeight));
    const visibleBottom=viewportTop+viewportHeight;
    const nav=document.querySelector('.navbar');
    const navRect=nav?.getBoundingClientRect();
    const top=Math.max(viewportTop+6,Math.round(navRect?.bottom||viewportTop)+8);
    const bottomNav=document.getElementById('bottomNav');
    const bottomRect=bottomNav?.getBoundingClientRect();
    let bottom=visibleBottom-8;
    if(bottomNav&&bottomRect&&getComputedStyle(bottomNav).display!=='none'&&bottomRect.top>viewportTop&&bottomRect.top<visibleBottom){
      bottom=Math.min(bottom,Math.round(bottomRect.top)-8);
    }
    const available=Math.max(150,Math.round(bottom-top));
    page.style.setProperty('--wp13-ai-top',top+'px');
    page.style.setProperty('--wp13-ai-height',available+'px');
  });
}
function setAIWorkspace(name){
  if(!['climate','assistant'].includes(name))return;
  wp81AIWorkspace=name;
  const page=document.getElementById('ai-page');
  const climate=document.querySelector('#ai-page .wp80-shell');
  const assistant=document.querySelector('#ai-page .ai-card');
  if(climate)climate.style.display=name==='climate'?'':'none';
  if(assistant)assistant.style.display=name==='assistant'?'':'none';
  if(page)page.classList.toggle('wp81-ai-assistant',name==='assistant');
  document.querySelectorAll('[data-ai-workspace]').forEach(button=>button.classList.toggle('active',button.dataset.aiWorkspace===name));
  const lockAssistant=name==='assistant'&&!!page?.classList.contains('active')&&!!(window.matchMedia&&window.matchMedia('(max-width:768px)').matches);
  if(lockAssistant)window.scrollTo({top:0,left:0,behavior:'auto'});
  wp13SetAIScrollLock(lockAssistant);
  if(name==='climate')wp80Init();
  if(name==='assistant'){
    requestAnimationFrame(()=>{
      wp13UpdateAIViewport();
      requestAnimationFrame(()=>{wp13UpdateAIViewport();scrollAIToLatest('auto');});
    });
  }else{
    page?.style.removeProperty('--wp13-ai-top');
    page?.style.removeProperty('--wp13-ai-height');
  }
}
window.addEventListener('resize',wp13UpdateAIViewport,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(wp13UpdateAIViewport,160),{passive:true});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',wp13UpdateAIViewport,{passive:true});
  window.visualViewport.addEventListener('scroll',wp13UpdateAIViewport,{passive:true});
}
window.setAIWorkspace=setAIWorkspace;
function wp81UpdateHubSummaries(){
  const hasWeather=!!(lastWeatherData?.coord&&lastWeatherData?.name);
  const city=lastWeatherData?.name||currentCity||'Город не выбран';
  const mapCity=document.getElementById('wp81MapCity');if(mapCity)mapCity.textContent=hasWeather?`Активная локация: ${city}`:'Загрузите погоду на вкладке «Главная», чтобы выбрать город';
  const person=document.getElementById('wp81PeopleStatus');
  if(person){const signed=!!(fbUser||fbAuth?.currentUser);person.innerHTML=`<i class="fa-solid ${signed?'fa-circle-check':'fa-user-group'}"></i><span>${signed?'Аккаунт подключён — социальные функции доступны':'Гостевой режим — для заявок и сообщений войдите в аккаунт'}</span>`;}
  const name=document.getElementById('wp81ProfileName'),state=document.getElementById('wp81ProfileState'),profileCity=document.getElementById('wp81ProfileCity'),session=document.getElementById('wp81ProfileSessionText'),sessionBtn=document.getElementById('wp81ProfileSessionButton');
  const user=fbUser||fbAuth?.currentUser||null,signed=!!user;
  if(name)name.textContent=currentUser?.name||user?.displayName||'Гость';
  if(state)state.textContent=signed?'Firebase аккаунт подключён':'Гостевой режим';
  if(profileCity)profileCity.textContent=`Город: ${currentUser?.defaultCity||city}`;
  if(session)session.textContent=signed?`Выполнен вход${user.email?` · ${user.email}`:''}`:'Войдите, чтобы синхронизировать профиль и пользоваться социальными функциями';
  if(sessionBtn)sessionBtn.textContent=signed?'Выйти':'Войти';
}
function wp81ProfileSessionAction(){
  const signed=!!(fbUser||fbAuth?.currentUser);
  if(signed&&typeof logout==='function')logout();else showPage('auth');
}
window.wp81ProfileSessionAction=wp81ProfileSessionAction;
function wp81UpdateProfileAfterPaint(){wp81UpdateHubSummaries();}
function wp81TabAlias(page){
  if(['map','globe','planet','route','emergency'].includes(page))return 'map';
  if(['home','planner','activities','smart-alerts','favorites','compare','history','stats','charts','widget','life'].includes(page))return 'home';
  if(['ai','intelligence'].includes(page))return 'ai';
  if(['people','community','chat'].includes(page))return 'people';
  if(['profile','settings','studio','engine','auth','about'].includes(page))return 'profile';
  return page;
}
const wp81OriginalShowPage=window.showPage;
if(typeof wp81OriginalShowPage==='function'&&!window.wp81ShowPageWrapped){
  window.showPage=function(id){
    const result=wp81OriginalShowPage(id);
    const root=wp81TabAlias(id);
    /* Every screen is an independent destination: never highlight a sibling page. */
    document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
    if(typeof syncNavGroupState==='function')syncNavGroupState(id);
    if(root==='ai'&&id==='ai')setAIWorkspace(wp81AIWorkspace||'climate');
    else if(typeof wp13SetAIScrollLock==='function')wp13SetAIScrollLock(false);
    if(root==='profile')requestAnimationFrame(wp81UpdateProfileAfterPaint);
    if(root==='people')requestAnimationFrame(wp81UpdateHubSummaries);
    if(root==='map')requestAnimationFrame(wp81UpdateHubSummaries);
    return result;
  };
  window.wp81ShowPageWrapped=true;
}
/* The catalog is a real sixth mobile destination; secondary screens highlight it instead of unrelated tabs. */
window.updateBottomNav=function(pageId){
  const direct={
    home:'home',map:'map',globe:'map',planet:'map',
    ai:'ai',intelligence:'ai',people:'people',community:'people',
    profile:'profile',settings:'profile',auth:'profile',chat:'people'
  };
  const activeId=direct[pageId]||'catalog';
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(b=>{
    const active=b.dataset.page===activeId;
    b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
};
window.addEventListener('weatherpro:weather-updated',wp81UpdateHubSummaries);
const wp81OriginalGetWeather=window.getWeather;
if(typeof wp81OriginalGetWeather==='function'&&!window.wp81GetWeatherWrapped){window.getWeather=async function(...args){const result=await wp81OriginalGetWeather.apply(this,args);wp81UpdateHubSummaries();return result;};window.wp81GetWeatherWrapped=true;}
const wp81OriginalUpdateUI=window.updateUI;
if(typeof wp81OriginalUpdateUI==='function'&&!window.wp81UpdateUIWrapped){window.updateUI=function(...args){const result=wp81OriginalUpdateUI.apply(this,args);wp81UpdateHubSummaries();return result;};window.wp81UpdateUIWrapped=true;}
/* Weather loading currently has no custom event; observe its stable state after the initial UI pass. */
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wp81UpdateHubSummaries,{once:true});else setTimeout(wp81UpdateHubSummaries,0);


