/* Weather Pro V17.1.1 — owner-only Admin Console (static web, no Node.js). */
(function(){
  'use strict';
  const OWNER_EMAIL='killedofficialbd@gmail.com';
  const PAGE_SIZE=40;
  const $=id=>document.getElementById(id);
  let profileRows=[];
  let cursor=null;
  let hasMore=false;
  let loading=false;
  let loadedOnce=false;
  let suspensions=new Map();
  let adminRulesReady=false;
  let lastIpRows=[];

  function authUser(){
    // Only Firebase Auth currentUser is proof of identity; never grant access from
    // a cached fbUser/profile while the first auth-state callback is still pending.
    try{
      if(typeof fbAuth!=='undefined'&&fbAuth){
        if(typeof fbAuthReady!=='undefined'&&!fbAuthReady)return null;
        return fbAuth.currentUser||null;
      }
    }catch(_){}
    return null;
  }
  function isOwner(){const u=authUser();return !!u&&String(u.email||'').trim().toLowerCase()===OWNER_EMAIL;}
  function db(){try{return typeof fbDb!=='undefined'?fbDb:null;}catch(_){return null;}}
  function notify(message,isError=false){if(typeof window.showNotification==='function')window.showNotification(message,isError);else console[isError?'error':'info'](message);}
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function setNotice(message,type=''){const el=$('wp17AdminStatus');if(!el)return;el.textContent=message;el.classList.toggle('is-error',type==='error');el.classList.toggle('is-good',type==='good');}
  function setIpNotice(message,type=''){const el=$('wp17AdminIpStatus');if(!el)return;el.textContent=message;el.classList.toggle('is-error',type==='error');el.classList.toggle('is-good',type==='good');}
  function requireOwner(){if(isOwner())return true;notify('Админ-панель доступна только владельцу Weather Pro.',true);return false;}
  function updateOwnerVisibility(){
    const owner=isOwner();
    document.querySelectorAll('[data-wp17-founder-only]').forEach(el=>{el.hidden=!owner;el.style.display=owner?'':'none';});
    const badge=$('wp17FounderBadge');if(badge){badge.hidden=!owner;badge.setAttribute('aria-hidden',String(!owner));}
    const state=$('wp17AdminAuthState');if(state)state.textContent=owner?'ВЛАДЕЛЕЦ ПОДТВЕРЖДЁН':'Доступ закрыт';
    if(!owner&&$('admin-page')?.classList.contains('active')){
      try{const go=window.showPage;if(typeof go==='function')go('profile');}catch(_){}
    }
  }
  function syncKpis(){
    if($('wp17AdminUserCount'))$('wp17AdminUserCount').textContent=String(profileRows.length);
    if($('wp17AdminSuspendedCount'))$('wp17AdminSuspendedCount').textContent=adminRulesReady?String(suspensions.size):'—';
    if($('wp17AdminRole'))$('wp17AdminRole').textContent=isOwner()?'OWNER':'—';
    if($('wp17AdminListMeta'))$('wp17AdminListMeta').textContent=`Загружено профилей: ${profileRows.length}${hasMore?' · есть ещё':''}`;
  }
  function renderUsers(){
    const body=$('wp17AdminUsersTable');if(!body)return;
    const term=String($('wp17AdminSearch')?.value||'').trim().toLowerCase();
    const list=profileRows.filter(p=>[p.displayName,p.email,p.uid,p.searchableName,p.searchableEmail].some(x=>String(x||'').toLowerCase().includes(term)));
    if(!list.length){body.innerHTML='<tr><td colspan="5" class="wp17-admin-empty">Пользователи не найдены среди загруженных профилей.</td></tr>';}
    else body.innerHTML=list.map(p=>{
      const suspended=suspensions.has(p.uid);
      const who=esc(p.displayName||'Без имени');
      const disabled=p.uid===authUser()?.uid||!adminRulesReady;
      const title=p.uid===authUser()?.uid?'Нельзя изменить собственный аккаунт':(!adminRulesReady?'Сначала опубликуй новые Firestore Rules из rules.txt':'');
      return `<tr><td><div class="wp17-admin-user-name">${who}</div></td><td>${esc(p.email||'—')}</td><td><span class="wp17-admin-uid" title="${esc(p.uid)}">${esc(p.uid)}</span></td><td><span class="wp17-admin-status-pill ${suspended?'suspended':''}">${suspended?'Приостановлен':'Активен'}</span></td><td><button type="button" class="wp17-admin-action ${suspended?'restore':''}" data-wp17-admin-action="${suspended?'restore':'suspend'}" data-uid="${esc(p.uid)}" ${disabled?'disabled':''} title="${esc(title)}">${suspended?'Восстановить':'Приостановить'}</button></td></tr>`;
    }).join('');
    const more=$('wp17AdminLoadMore');if(more)more.hidden=!hasMore||!!term;
    syncKpis();
  }
  async function loadSuspensions(){
    const snap=await db().collection('wpAdminSuspensions').get();
    const next=new Map();snap.forEach(doc=>next.set(doc.id,doc.data()||{}));suspensions=next;
  }
  async function loadProfiles(reset=false){
    if(!requireOwner()||loading)return;
    const firestore=db();if(!firestore){setNotice('Firebase Firestore ещё не инициализирован. Проверь подключение аккаунта.','error');return;}
    loading=true;const refresh=$('wp17AdminRefresh'),more=$('wp17AdminLoadMore');if(refresh)refresh.disabled=true;if(more)more.disabled=true;
    setNotice('Загружаю публичные профили и статусы доступа…');
    try{
      if(reset){profileRows=[];cursor=null;hasMore=false;}
      const queryBase=firestore.collection('publicProfiles').orderBy('displayName').limit(PAGE_SIZE);
      const query=cursor?queryBase.startAfter(cursor):queryBase;
      const profilesSnap=await query.get();
      if(!isOwner())throw new Error('Владелец вышел из аккаунта во время запроса.');
      try{await loadSuspensions();adminRulesReady=true;}
      catch(adminError){adminRulesReady=false;suspensions=new Map();console.warn('[WeatherPro/Admin] Owner collections are not available. Publish the updated Firestore Rules.',adminError);}
      profilesSnap.forEach(doc=>{const data=doc.data()||{};profileRows.push({uid:String(data.uid||doc.id),displayName:data.displayName||'',email:data.email||'',searchableName:data.searchableName||'',searchableEmail:data.searchableEmail||''});});
      cursor=profilesSnap.docs.length?profilesSnap.docs[profilesSnap.docs.length-1]:cursor;
      hasMore=profilesSnap.docs.length===PAGE_SIZE;
      renderUsers();loadedOnce=true;
      if(adminRulesReady)setNotice(`Готово. Загружено ${profileRows.length} публичных профилей; owner-only правила активны.`, 'good');
      else setNotice(`Загружено ${profileRows.length} публичных профилей, но модерация пока отключена. Опубликуй актуальный rules.txt в Firebase Console → Firestore → Rules.`, 'error');
      await loadAudit();
    }catch(error){
      console.error('[WeatherPro/Admin] Load failed:',error);
      const code=error?.code||'unknown';
      setNotice(`Не удалось загрузить административные данные (${code}). Проверь, что новые правила Firestore из rules.txt опубликованы в Firebase Console, и что выполнен вход владельца.`, 'error');
      notify('Ошибка загрузки админ-панели: '+code,true);
    }finally{loading=false;if(refresh)refresh.disabled=false;if(more)more.disabled=false;}
  }
  async function loadAudit(){
    if(!requireOwner()||!db())return;
    const root=$('wp17AdminAuditList');if(!root)return;
    try{
      const snap=await db().collection('wpAdminAudit').orderBy('createdAt','desc').limit(30).get();
      if(!snap.size){root.innerHTML='<div class="wp17-admin-empty">Журнал пока пуст.</div>';return;}
      root.innerHTML='';
      snap.forEach(doc=>{
        const d=doc.data()||{};const row=document.createElement('div');row.className='wp17-admin-audit-row';
        const detail=document.createElement('div');
        const strong=document.createElement('strong');strong.textContent=d.action==='suspend'?'Доступ к Firestore приостановлен':'Доступ к Firestore восстановлен';
        const small=document.createElement('small');small.textContent=`Цель: ${d.targetEmail||d.targetUid||'неизвестно'} · UID: ${d.targetUid||'—'} · Причина: ${d.reason||'—'}`;
        detail.append(strong,small);
        const time=document.createElement('time');const date=d.createdAt?.toDate?d.createdAt.toDate():null;time.textContent=date?date.toLocaleString('ru-RU'):'время не указано';
        row.append(detail,time);root.append(row);
      });
    }catch(error){console.warn('[WeatherPro/Admin] Audit unavailable:',error);root.innerHTML='<div class="wp17-admin-empty">Журнал недоступен. Проверь публикацию правил Firestore.</div>';}
  }
  async function changeAccess(uid,action){
    if(!requireOwner()||!db())return;
    if(!adminRulesReady){notify('Сначала опубликуй обновлённые Firestore Rules из rules.txt.',true);return;}
    if(!uid||uid===authUser()?.uid){notify('Нельзя менять доступ собственного аккаунта.',true);return;}
    const target=profileRows.find(p=>p.uid===uid);if(!target){notify('Профиль не найден в текущем списке.',true);return;}
    const reason=window.prompt(action==='suspend'?'Причина приостановки доступа к Firestore:':'Причина восстановления доступа (необязательно):','');
    if(reason===null)return;
    if(action==='suspend'&&!reason.trim()){notify('Укажи причину приостановки.','error');return;}
    if(reason.length>300){notify('Причина должна быть не длиннее 300 символов.',true);return;}
    const me=authUser();const batch=db().batch();
    const statusRef=db().collection('wpAdminSuspensions').doc(uid);
    const auditRef=db().collection('wpAdminAudit').doc();
    const now=firebase.firestore.FieldValue.serverTimestamp();
    if(action==='suspend'){
      batch.set(statusRef,{uid,reason:reason.trim(),status:'suspended',createdBy:me.uid,createdAt:now,updatedAt:now});
    }else batch.delete(statusRef);
    batch.set(auditRef,{actorUid:me.uid,actorEmail:me.email||OWNER_EMAIL,action,targetUid:uid,targetEmail:target.email||'',reason:reason.trim(),createdAt:now});
    try{
      await batch.commit();
      notify(action==='suspend'?'Доступ к Firestore приостановлен.':'Доступ к Firestore восстановлен.');
      await loadProfiles(true);
    }catch(error){
      console.error('[WeatherPro/Admin] Access change failed:',error);
      notify('Не удалось изменить доступ: '+(error?.code||error?.message||'ошибка правил Firestore'),true);
      setNotice('Изменение отклонено Firestore. Проверь актуальные правила и права владельца.','error');
    }
  }
  // Minimal CSV parser; IP data stays in memory and is never uploaded.
  function parseCsv(text){
    const firstLine=String(text).split(/\r?\n/,1)[0]||'';
    const delimiters=[',',';','\t'];
    const delimiter=delimiters.sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}
      else if(ch==='"')quoted=true;
      else if(ch===delimiter){row.push(cell);cell='';}
      else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
      else if(ch!=='\r')cell+=ch;
    }
    if(cell.length||row.length){row.push(cell);rows.push(row);}
    return rows.filter(r=>r.some(v=>String(v).trim()!==''));
  }
  function renderIpRows(rows){
    const body=$('wp17AdminIpTable');if(!body)return;
    if(!rows.length){body.innerHTML='<tr><td colspan="5" class="wp17-admin-empty">В CSV не найдены строки с IP-адресами.</td></tr>';return;}
    body.innerHTML=rows.slice(0,300).map(r=>`<tr><td>${esc(r.time||'—')}</td><td><span class="wp17-admin-uid">${esc(r.ip)}</span></td><td>${esc(r.user||'не указан в access-логе')}</td><td>${esc(r.path||'—')}</td><td>${esc(r.status||'—')}</td></tr>`).join('');
  }
  function headerKey(value){return String(value||'').toLowerCase().replace(/^\uFEFF/,'').replace(/[^a-z0-9]/g,'');}
  function csvField(headers,row,names){for(const name of names){const key=headerKey(name);const i=headers.findIndex(h=>headerKey(h)===key);if(i>=0)return String(row[i]??'').trim();}return '';}
  async function handleIpFile(file){
    if(!requireOwner()||!file)return;
    if(file.size>10*1024*1024){setIpNotice('Файл больше 10 МБ. Выбери меньшую выгрузку.','error');return;}
    try{
      const rows=parseCsv(await file.text());if(rows.length<2)throw new Error('В файле нет строк данных.');
      const headers=rows[0].map(x=>String(x).trim().replace(/^\uFEFF/,'').toLowerCase());
      const ipNames=['ip','client_ip','clientip','remote_addr','remote_address','remoteaddress','source_ip','sourceip','ip_address','ipaddress','cf_connecting_ip'];
      if(!ipNames.some(n=>headers.some(h=>headerKey(h)===headerKey(n))))throw new Error('Не найден столбец ip / remote_addr / ClientIP.');
      const parsed=rows.slice(1).map(row=>({
        time:csvField(headers,row,['timestamp','time','date','datetime','request_time','client_request_time','datetime_utc']),
        ip:csvField(headers,row,ipNames),
        user:csvField(headers,row,['email','user_email','uid','user_id','firebase_uid','client_uid','account_email']),
        path:csvField(headers,row,['path','url','request','request_path','uri','client_request_uri','client_request_path']),
        status:csvField(headers,row,['status','status_code','http_status','edge_response_status','origin_response_status'])
      })).filter(r=>r.ip);
      lastIpRows=parsed;renderIpRows(parsed);
      setIpNotice(`Загружено ${parsed.length} строк с IP. Обработано локально; в Firebase файл не отправлялся.`, 'good');
    }catch(error){lastIpRows=[];renderIpRows([]);setIpNotice('Не удалось прочитать CSV: '+error.message,'error');}
  }
  function renderCsvStatusClear(){lastIpRows=[];renderIpRows([]);setIpNotice('IP-данные не загружены.');}

  const originalShowPage=window.showPage;
  if(typeof originalShowPage==='function'&&!window.wp17AdminShowPageWrapped){
    window.showPage=function(id){
      if(id==='admin'&&!requireOwner())return false;
      const result=originalShowPage.apply(this,arguments);
      if(id==='admin'){
        updateOwnerVisibility();
        if(!loadedOnce)loadProfiles(true);else{renderUsers();loadAudit();}
      }
      return result;
    };
    window.wp17AdminShowPageWrapped=true;
  }
  window.wp17AdminRefresh=()=>loadProfiles(true);

  $('wp17AdminRefresh')?.addEventListener('click',()=>loadProfiles(true));
  $('wp17AdminLoadMore')?.addEventListener('click',()=>loadProfiles(false));
  $('wp17AdminAuditRefresh')?.addEventListener('click',()=>loadAudit());
  $('wp17AdminSearch')?.addEventListener('input',renderUsers);
  $('wp17AdminUsersTable')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-wp17-admin-action]');if(!button)return;
    changeAccess(button.dataset.uid,button.dataset.wp17AdminAction);
  });
  $('wp17AdminIpFile')?.addEventListener('change',event=>{const f=event.target.files?.[0];handleIpFile(f);event.target.value='';});

  updateOwnerVisibility();
  try{if(typeof fbAuth!=='undefined'&&fbAuth?.onAuthStateChanged){fbAuth.onAuthStateChanged(()=>{const wasOwner=$('admin-page')?.classList.contains('active');updateOwnerVisibility();if(isOwner()&&wasOwner)loadProfiles(true);});}}catch(error){console.warn('[WeatherPro/Admin] Auth observer unavailable:',error);}
  window.addEventListener('storage',()=>updateOwnerVisibility());
})();
