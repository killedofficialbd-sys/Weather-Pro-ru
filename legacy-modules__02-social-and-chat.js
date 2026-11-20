/* Weather Pro V16 module: 02-social-and-chat.js — extracted from the existing app script. */
/* ============================================================
   WEATHER PRO SOCIAL: FRIENDS + PRIVATE CHATS
   Canonical friendship/chat identity: sorted UID pair joined by "__".
   ============================================================ */
let activeChatId = null, activeChatUnsubscribe = null, activeChatsUnsubscribe = null, activeChatReadUnsubscribe = null;
let activeChatOtherReadAt = null;
let activeChatOtherDeliveredAt = null;
let activeRequestsUnsubscribes = [], activeFriendshipsUnsubscribe = null;
let activeChatOtherUid = null, activeChatOtherEmail = null, activeChatMessagesCache = [];
let socialFriendIds = new Set(), socialRequestDocs = new Map();
const socialEsc = value => esc(String(value == null ? '' : value));
function socialAvatar(person){
  const name=(person?.displayName || person?.name || '?').trim();
  const photoMarkup=avatarImageMarkup(person?.avatar,name);
  if(photoMarkup) return `<div class="person-avatar">${photoMarkup}</div>`;
  return `<div class="person-avatar">${socialEsc(name.charAt(0).toUpperCase())}</div>`;
}
function socialNotice(message, error=false){ if(typeof showNotification==='function') showNotification(message,error); }
function requireSocialAuth(){
  const activeUser=fbUser||fbAuth?.currentUser||null;
  if(!fbReady||!activeUser||!fbDb){
    socialNotice(fbAuthReady?'Для общения войдите через Google':'Восстанавливаем вход Google. Повторите действие через секунду.',true);
    return false;
  }
  fbUser=activeUser;
  wp6AdoptFirebaseIdentity(activeUser);
  return true;
}
function chatIdFor(a,b){ return [String(a),String(b)].sort().join('__'); }
function requestIdFor(from,to){ return String(to)+'_'+String(from); }
function stopSocialListeners(){
  if(activeChatUnsubscribe){activeChatUnsubscribe();activeChatUnsubscribe=null;}
  if(activeChatReadUnsubscribe){activeChatReadUnsubscribe();activeChatReadUnsubscribe=null;}
  if(activeChatsUnsubscribe){activeChatsUnsubscribe();activeChatsUnsubscribe=null;}
  activeRequestsUnsubscribes.forEach(unsub=>{try{unsub();}catch(_){}});activeRequestsUnsubscribes=[];
  if(activeFriendshipsUnsubscribe){activeFriendshipsUnsubscribe();activeFriendshipsUnsubscribe=null;}
  if(typeof wpPushSetChatPresence==='function' && activeChatId) wpPushSetChatPresence(activeChatId,false);
  activeChatId=null;activeChatOtherUid=null;activeChatOtherEmail=null;activeChatMessagesCache=[];activeChatOtherReadAt=null;activeChatOtherDeliveredAt=null;
  socialFriendIds=new Set();socialRequestDocs=new Map();
  const msg=$('chatMessages');if(msg)msg.innerHTML='<div class="person-empty">Выберите друга, чтобы начать общение</div>';
  const list=$('chatList');if(list)list.innerHTML='<div class="person-empty">Диалоги появятся после первого сообщения</div>';
  const friends=$('friendsList');if(friends)friends.innerHTML='<div class="person-empty">Пока нет друзей — найдите пользователей выше</div>';
  const req=$('friendRequests');if(req)req.innerHTML='<div class="person-empty">Здесь появятся заявки</div>';
}
async function sendFriendRequest(uid, name){
  if(!requireSocialAuth() || !uid || uid===fbUser.uid) return;
  try{
    const outgoingId=requestIdFor(fbUser.uid,uid);
    const [friendSnap,outSnap,inSnap]=await Promise.all([
      fbDb.collection('friendships').where('members','array-contains',fbUser.uid).get(),
      fbDb.collection('friendRequests').where('from','==',fbUser.uid).get(),
      fbDb.collection('friendRequests').where('to','==',fbUser.uid).get()
    ]);
    if(friendSnap.docs.some(d=>(d.data().members||[]).includes(uid))){socialNotice('Уже в друзьях');return;}
    const outgoingPending=outSnap.docs.find(d=>d.data().to===uid&&d.data().status==='pending');
    const incomingPending=inSnap.docs.find(d=>d.data().from===uid&&d.data().status==='pending');
    const outgoingDoc=outSnap.docs.find(d=>d.id===outgoingId);
    if(outgoingPending){socialNotice('Заявка уже отправлена');return;}
    if(incomingPending){socialNotice('Этот пользователь уже отправил вам заявку — примите её во входящих');return;}
    const ref=fbDb.collection('friendRequests').doc(outgoingId);
    const payload={from:fbUser.uid,to:uid,fromName:String(currentUser?.name||fbUser.displayName||'Пользователь').slice(0,80),fromAvatar:currentUser?.avatar||null,toName:String(name||'').slice(0,80),status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(['declined','accepted'].includes(outgoingDoc?.data().status) && outgoingDoc.id===outgoingId){
      await ref.update({status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp(),respondedAt:firebase.firestore.FieldValue.delete()});
    }else{
      await ref.set(payload);
    }
    socialNotice('Заявка в друзья отправлена');
    if(typeof searchUsers==='function')searchUsers();
  }catch(e){
    console.error('[WeatherPro/Social] request',e);
    socialNotice('Не удалось отправить заявку: '+(e.code||e.message),true);
  }
}
async function respondFriendRequest(requestId, accept){
  if(!requireSocialAuth()) return;
  try{
    const ref=fbDb.collection('friendRequests').doc(requestId),snap=await ref.get();
    if(!snap.exists || snap.data().to!==fbUser.uid || snap.data().status!=='pending'){socialNotice('Заявка уже недоступна',true);return;}
    const r=snap.data(),friendshipId=chatIdFor(r.from,r.to),friendshipRef=fbDb.collection('friendships').doc(friendshipId);
    const existing=await fbDb.collection('friendships').where('members','array-contains',fbUser.uid).get();
    const alreadyCanonical=existing.docs.some(d=>d.id===friendshipId && (d.data().members||[]).includes(r.from));
    const batch=fbDb.batch();
    if(accept && !alreadyCanonical){
      const members=[r.from,r.to].sort();
      batch.set(friendshipRef,{members,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    }
    batch.update(ref,{status:accept?'accepted':'declined',respondedAt:firebase.firestore.FieldValue.serverTimestamp()});
    await batch.commit();
    socialNotice(accept?'Теперь вы друзья!':'Заявка отклонена');
    if(accept && typeof searchUsers==='function')searchUsers();
  }catch(e){console.error('[WeatherPro/Social] response',e);socialNotice('Ошибка обработки заявки: '+(e.code||e.message),true);}
}
async function cancelFriendRequest(requestId){
  if(!requireSocialAuth())return;
  try{
    const ref=fbDb.collection('friendRequests').doc(requestId),snap=await ref.get();
    if(!snap.exists||snap.data().from!==fbUser.uid||snap.data().status!=='pending'){socialNotice('Исходящая заявка уже недоступна',true);return;}
    await ref.delete();socialNotice('Исходящая заявка отменена');
  }catch(e){socialNotice('Не удалось отменить заявку: '+(e.code||e.message),true);}
}
async function removeFriend(friendUid){
  if(!requireSocialAuth()||!friendUid||friendUid===fbUser.uid)return;
  if(!confirm('Удалить пользователя из друзей?'))return;
  try{
    const snap=await fbDb.collection('friendships').where('members','array-contains',fbUser.uid).get();
    const matches=snap.docs.filter(d=>(d.data().members||[]).includes(friendUid));
    const batch=fbDb.batch();matches.forEach(d=>batch.delete(d.ref));
    if(!matches.length)throw new Error('Дружба уже отсутствует');
    await batch.commit();
    socialNotice('Пользователь удалён из друзей');
    if(activeChatOtherUid===friendUid){if(typeof wpPushSetChatPresence==='function'&&activeChatId)wpPushSetChatPresence(activeChatId,false);if(activeChatUnsubscribe)activeChatUnsubscribe();if(activeChatReadUnsubscribe)activeChatReadUnsubscribe();activeChatUnsubscribe=null;activeChatReadUnsubscribe=null;activeChatId=null;activeChatOtherUid=null;activeChatOtherEmail=null;activeChatMessagesCache=[];activeChatOtherReadAt=null;activeChatOtherDeliveredAt=null;showPage('people');}
  }catch(e){socialNotice('Не удалось удалить из друзей: '+(e.code||e.message),true);}
}
function renderFriendRequests(uid){
  const requests=$('friendRequests');if(!requests)return;
  const docs=[...socialRequestDocs.values()];
  const dedupe=(rows,keyOf)=>[...new Map(rows.map(d=>[keyOf(d),d])).values()];
  const incoming=dedupe(docs.filter(d=>d.to===uid&&d.status==='pending'),d=>d.from);
  const outgoing=dedupe(docs.filter(d=>d.from===uid&&d.status==='pending'),d=>d.to);
  const count=$('friendRequestCount');if(count)count.textContent=String(incoming.length);
  requests.innerHTML='';
  if(!incoming.length&&!outgoing.length){requests.innerHTML='<div class="person-empty">Новых заявок пока нет</div>';return;}
  incoming.forEach(d=>{
    const el=document.createElement('div');el.className='social-person';
    el.innerHTML=`${socialAvatar({displayName:d.fromName,avatar:d.fromAvatar})}<div class="social-person-info"><strong>${socialEsc(d.fromName||'Пользователь')}</strong><small>Хочет добавить вас в друзья</small></div><div class="social-actions"><button type="button" data-action="accept">Принять</button><button type="button" class="muted" data-action="decline">Отклонить</button></div>`;
    el.querySelector('[data-action="accept"]').addEventListener('click',()=>respondFriendRequest(d.id,true));
    el.querySelector('[data-action="decline"]').addEventListener('click',()=>respondFriendRequest(d.id,false));
    requests.appendChild(el);
  });
  outgoing.forEach(d=>{
    const el=document.createElement('div');el.className='social-person';
    el.innerHTML=`<div class="social-person-info"><strong>Исходящая заявка</strong><small>${socialEsc(d.toName||'Пользователь')}</small></div><div class="social-actions"><button class="muted" type="button">Отменить</button></div>`;
    el.querySelector('button').addEventListener('click',()=>cancelFriendRequest(d.id));requests.appendChild(el);
  });
}
async function renderFriends(uid, docs){
  const box=$('friendsList');if(!box)return;
  // Legacy duplicate friendship documents are collapsed by the other UID.
  const unique=new Map();
  docs.forEach(doc=>{
    const members=doc.data().members||[],other=members.find(x=>x!==uid);
    if(other && other!==uid && !unique.has(other))unique.set(other,doc);
  });
  socialFriendIds=new Set(unique.keys());
  if(activeChatOtherUid && !socialFriendIds.has(activeChatOtherUid)){
    if(activeChatUnsubscribe){activeChatUnsubscribe();activeChatUnsubscribe=null;}
    activeChatId=null;activeChatOtherUid=null;activeChatMessagesCache=[];
    if($('chat-page')?.classList.contains('active'))showPage('people');
  }
  box.innerHTML='';
  if(!unique.size){box.innerHTML='<div class="person-empty">Пока нет друзей — найдите пользователей выше</div>';startChatListListener(uid);return;}
  const entries=[...unique.keys()];
  const profiles=await Promise.all(entries.map(id=>fbDb.collection('publicProfiles').doc(id).get().catch(()=>null)));
  if(!fbUser||fbUser.uid!==uid)return;
  entries.forEach((other,i)=>{
    const p=profiles[i]?.data()||{},name=p.displayName||'Пользователь',el=document.createElement('div');el.className='social-person';
    el.innerHTML=`${socialAvatar({displayName:name,avatar:p.avatar})}<div class="social-person-info"><strong>${socialEsc(name)}${window.wp17FounderBadgeMarkup?.(p.email)||''}</strong><small>${socialEsc(p.email||'Друг Weather Pro')}</small></div><div class="social-actions"><button type="button" data-action="chat">Написать</button><button class="muted" type="button" data-action="remove">Удалить</button></div>`;
    el.querySelector('[data-action="chat"]').addEventListener('click',()=>openChat(other,name));
    el.querySelector('[data-action="remove"]').addEventListener('click',()=>removeFriend(other));
    box.appendChild(el);
  });
  startChatListListener(uid);
}
function loadSocialHub(){
  if(!requireSocialAuth())return;
  const uid=fbUser.uid;
  if(activeRequestsUnsubscribes.length||activeFriendshipsUnsubscribe||activeChatsUnsubscribe)return;
  const requestsRef=fbDb.collection('friendRequests');
  ['to','from'].forEach(field=>{
    const unsub=requestsRef.where(field,'==',uid).onSnapshot(snap=>{
      if(!fbUser||fbUser.uid!==uid)return;
      snap.docs.forEach(d=>socialRequestDocs.set(d.id,{id:d.id,...d.data()}));
      // Remove stale cached docs for this direction before re-populating.
      const liveIds=new Set(snap.docs.map(d=>d.id));
      [...socialRequestDocs.entries()].forEach(([id,d])=>{if(d[field]===uid&&!liveIds.has(id))socialRequestDocs.delete(id);});
      renderFriendRequests(uid);
    },e=>{console.error('[WeatherPro/Requests]',e);const box=$('friendRequests');if(box)box.textContent='Не удалось загрузить заявки: '+(e.code||e.message);});
    activeRequestsUnsubscribes.push(unsub);
  });
  activeFriendshipsUnsubscribe=fbDb.collection('friendships').where('members','array-contains',uid).onSnapshot(snap=>{
    if(!fbUser||fbUser.uid!==uid)return;
    renderFriends(uid,snap.docs).catch(e=>console.error('[WeatherPro/Friends] render',e));
  },e=>{console.error('[WeatherPro/Friends]',e);const box=$('friendsList');if(box)box.textContent='Не удалось загрузить друзей: '+(e.code||e.message);});
}
function startChatListListener(uid){
  if(activeChatsUnsubscribe){activeChatsUnsubscribe();activeChatsUnsubscribe=null;}
  const box=$('chatList');if(!box)return;
  activeChatsUnsubscribe=fbDb.collection('chats').where('members','array-contains',uid).onSnapshot(async snap=>{
    if(!fbUser||fbUser.uid!==uid)return;
    const docs=snap.docs.filter(doc=>{
      const other=(doc.data().members||[]).find(x=>x!==uid);
      return !!other && socialFriendIds.has(other);
    }).slice().sort((a,b)=>{
      const av=a.data().updatedAt?.toMillis?.()||0,bv=b.data().updatedAt?.toMillis?.()||0;return bv-av;
    });
    box.innerHTML='';
    if(!docs.length){box.innerHTML='<div class="person-empty">Диалоги появятся после первого сообщения</div>';return;}
    for(const doc of docs){
      const data=doc.data(),other=(data.members||[]).find(x=>x!==uid);if(!other)continue;
      let profile={};try{const p=await fbDb.collection('publicProfiles').doc(other).get();profile=p.data()||{};}catch(_){}
      if(!fbUser||fbUser.uid!==uid)return;
      let unread=0;try{if(typeof wpPushGetChatUnread==='function')unread=await wpPushGetChatUnread(doc.id,other);}catch(e){console.warn('[WeatherPro/Unread]',e);}
      if(!fbUser||fbUser.uid!==uid)return;
      const el=document.createElement('div');el.className='social-person'+(unread?' wp-chat-unread':'');el.dataset.chatId=doc.id;
      const last=String(data.lastMessage||'').slice(0,100);
      const updated=data.updatedAt?.toDate?data.updatedAt.toDate():null;
      const time=updated?updated.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'';
      el.innerHTML=`${socialAvatar({displayName:profile.displayName||'Друг',avatar:profile.avatar})}<div class="social-person-info"><strong>${socialEsc(profile.displayName||'Друг')}${window.wp17FounderBadgeMarkup?.(profile.email)||''}</strong><small class="chat-list-meta">${socialEsc(last||'Откройте диалог')}${time?' · '+time:''}</small></div>${unread?`<span class="wp-chat-count">${unread>99?'99+':unread}</span>`:''}<div class="social-actions"><button type="button">Открыть</button></div>`;
      el.querySelector('button').addEventListener('click',()=>openChat(other,profile.displayName||'Друг'));
      box.appendChild(el);
    }
  },e=>{console.error('[WeatherPro/ChatList]',e);box.textContent='Не удалось загрузить диалоги: '+(e.code||e.message);});
}
async function openChat(otherUid, otherName){
  if(!requireSocialAuth()||!otherUid||otherUid===fbUser.uid)return;
  const uid=fbUser.uid,id=chatIdFor(uid,otherUid),ref=fbDb.collection('chats').doc(id);
  try{
    // A canonical friendship is required before either opening or creating a chat.
    const friendshipSnap=await fbDb.collection('friendships').where('members','array-contains',uid).get();
    if(!fbUser||fbUser.uid!==uid)return;
    if(!friendshipSnap.docs.some(d=>d.id===id&&(d.data().members||[]).includes(otherUid))){
      socialNotice('Личный чат доступен только действующим друзьям.',true);return;
    }
    // Read only the public profile email/name to display the verified founder mark.
    let otherProfile={};
    try{const publicSnap=await fbDb.collection('publicProfiles').doc(otherUid).get();otherProfile=publicSnap.data()||{};}catch(_){}
    if(!fbUser||fbUser.uid!==uid)return;
    // set(merge) intentionally avoids reading a possibly absent chat document.
    // Security Rules separately authorize create vs update and require friendship.
    await ref.set({members:[uid,otherUid].sort()},{merge:true});
    if(activeChatUnsubscribe){activeChatUnsubscribe();activeChatUnsubscribe=null;}
    if(activeChatReadUnsubscribe){activeChatReadUnsubscribe();activeChatReadUnsubscribe=null;}
    activeChatId=id;activeChatOtherUid=otherUid;activeChatOtherEmail=String(otherProfile.email||'');activeChatMessagesCache=[];activeChatOtherReadAt=null;activeChatOtherDeliveredAt=null;
    const chatTitle=$('chatTitle');if(chatTitle)chatTitle.innerHTML=`${socialEsc(otherName||otherProfile.displayName||'Чат')}${window.wp17FounderBadgeMarkup?.(activeChatOtherEmail)||''}`;
    $('chatSubtitle').textContent='Личная переписка';
    $('chatMessages').innerHTML='<div class="person-empty">Загружаем сообщения…</div>';
    if($('chatSearchInput'))$('chatSearchInput').value='';
    showPage('chat');
    if(typeof wpPushSetChatPresence==='function')wpPushSetChatPresence(id,true);
    // Browser-only mode does not publish another user's read cursor because the
    // existing Firestore Rules keep private user documents owner-only.
    activeChatReadUnsubscribe=null;
    activeChatOtherReadAt=null;activeChatOtherDeliveredAt=null;
    activeChatUnsubscribe=ref.collection('messages').orderBy('createdAt','asc').limitToLast(200).onSnapshot(snapshot=>{
      if(!fbUser||fbUser.uid!==uid||activeChatId!==id)return;
      activeChatMessagesCache=snapshot.docs.map(d=>({id:d.id,...d.data()}));
      renderChatMessages();
      if(typeof window.wp16ChatMarkReceived==='function')window.wp16ChatMarkReceived(id,snapshot.docs);
      if(typeof wpPushMarkChatRead==='function' && !document.hidden && $('chat-page')?.classList.contains('active'))wpPushMarkChatRead(id);
    },e=>{console.error('[WeatherPro/Chat] listen',e);$('chatMessages').textContent='Нет доступа к переписке: '+(e.code||e.message);});
  }catch(e){
    console.error('[WeatherPro/Chat] open',e);
    socialNotice('Не удалось открыть чат: '+(e.code||e.message),true);
  }
}
function renderChatMessages(){
  const box=$('chatMessages');if(!box)return;
  const query=($('chatSearchInput')?.value||'').trim().toLocaleLowerCase();
  const rows=activeChatMessagesCache.filter(m=>!query||String(m.text||'').toLocaleLowerCase().includes(query));
  box.innerHTML='';
  if(!rows.length){box.innerHTML='<div class="person-empty">'+(query?'Совпадений не найдено':'Начните разговор')+'</div>';return;}
  rows.forEach(m=>{
    const mine=m.senderId===fbUser?.uid,el=document.createElement('div');el.className='chat-bubble'+(mine?' mine':'');
    const body=document.createElement('div');body.textContent=String(m.text||'');el.appendChild(body);
    const meta=document.createElement('small');const date=m.createdAt?.toDate?m.createdAt.toDate():null;
    const wasRead=mine&&activeChatOtherReadAt&&m.createdAt?.toMillis&&m.createdAt.toMillis()<=activeChatOtherReadAt.toMillis();
    const wasDelivered=mine&&activeChatOtherDeliveredAt&&m.createdAt?.toMillis&&m.createdAt.toMillis()<=activeChatOtherDeliveredAt.toMillis();
    const senderEmail=mine?(fbUser?.email||''):activeChatOtherEmail;
    const senderMark=window.wp17FounderBadgeMarkup?.(senderEmail)||'';
    const senderName=socialEsc(mine?'Вы':String(m.senderName||'Друг'));
    const sentAt=socialEsc(date?date.toLocaleString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'');
    const delivery=mine?(wasRead?' · Прочитано':wasDelivered?' · Доставлено':' · Отправлено'):'';
    meta.innerHTML=`${senderName}${senderMark} · ${sentAt}${delivery}`;el.appendChild(meta);
    if(mine){const del=document.createElement('button');del.className='chat-delete';del.type='button';del.textContent='Удалить';del.addEventListener('click',()=>deleteChatMessage(m.id));el.appendChild(del);}
    box.appendChild(el);
  });
  if(!query)box.scrollTop=box.scrollHeight;
}
function filterChatMessages(){renderChatMessages();}
async function deleteChatMessage(messageId){
  if(!requireSocialAuth()||!activeChatId||!messageId)return;
  if(!confirm('Удалить это сообщение?'))return;
  try{
    const chatId=activeChatId,uid=fbUser.uid,chatRef=fbDb.collection('chats').doc(chatId);
    const msgRef=chatRef.collection('messages').doc(messageId),msg=await msgRef.get();
    if(!fbUser||fbUser.uid!==uid)return;
    if(!msg.exists||msg.data().senderId!==uid){socialNotice('Можно удалить только собственное сообщение',true);return;}
    await msgRef.delete();
    const latest=await chatRef.collection('messages').orderBy('createdAt','desc').limit(1).get();
    if(!fbUser||fbUser.uid!==uid||activeChatId!==chatId)return;
    const preview=latest.empty?'':String(latest.docs[0].data().text||'').slice(0,180);
    await chatRef.update({lastMessage:preview,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  }catch(e){socialNotice('Не удалось удалить сообщение: '+(e.code||e.message),true);}
}
async function sendChatMessage(event){
  event?.preventDefault();if(!requireSocialAuth()||!activeChatId)return;
  const input=$('chatMessageInput'),message=(input?.value||'').trim();
  if(!message)return;if(message.length>2000){socialNotice('Сообщение слишком длинное',true);return;}
  const uid=fbUser.uid,chatId=activeChatId;input.value='';
  try{
    const ref=fbDb.collection('chats').doc(chatId),batch=fbDb.batch(),msgRef=ref.collection('messages').doc();
    batch.set(msgRef,{senderId:uid,senderName:String(currentUser?.name||fbUser.displayName||'Пользователь').slice(0,80),text:message,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    batch.update(ref,{lastMessage:message.slice(0,180),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    await batch.commit();
  }catch(e){if(input&&fbUser?.uid===uid)input.value=message;console.error('[WeatherPro/Chat] send',e);socialNotice('Не удалось отправить сообщение: '+(e.code||e.message),true);}
}
window.sendFriendRequest=sendFriendRequest;window.respondFriendRequest=respondFriendRequest;window.loadSocialHub=loadSocialHub;window.openChat=openChat;window.sendChatMessage=sendChatMessage;window.cancelFriendRequest=cancelFriendRequest;window.removeFriend=removeFriend;window.filterChatMessages=filterChatMessages;
