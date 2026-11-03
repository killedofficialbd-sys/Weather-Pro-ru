/* Weather Pro 11.2 — browser notifications + Firestore unread chat tracking.
 * No Cloud Functions, VAPID keys or paid Firebase plan are required.
 * Notifications are generated while the app is open/in a background tab.
 * A completely closed site cannot receive new events without a push backend.
 */
(() => {
  'use strict';

  let currentUid = null;
  let notifUnreadUnsub = null;
  let notifHistoryUnsub = null;
  let chatsUnsub = null;
  let incomingRequestsUnsub = null;
  let acceptedRequestsUnsub = null;
  let notificationDocs = [];
  let serverUnreadCount = 0;
  const chatUnreadById = new Map();
  const chatUnreadRequestTokens = new Map();
  const chatMessageUnsubs = new Map();
  const chatSeenMessageIds = new Map();
  let presenceHeartbeat = null;
  let currentPresenceChat = null;
  let browserNotificationsEnabled = false;

  const $id = id => document.getElementById(id);
  const db = () => (typeof fbDb !== 'undefined' ? fbDb : null);
  const authUser = () => (typeof fbUser !== 'undefined' && fbUser ? fbUser : (typeof fbAuth !== 'undefined' ? fbAuth?.currentUser : null));
  const fire = () => (typeof firebase !== 'undefined' ? firebase : null);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const localStorageKey = uid => `weatherpro_local_notifications_${uid}`;
  const preferenceKey = uid => `weatherpro_browser_notifications_${uid}`;
  const chatReadsKey = uid => `weatherpro_chat_reads_${uid}`;

  function readLocalNotifications(uid = currentUid) {
    if (!uid) return [];
    try {
      const value = JSON.parse(localStorage.getItem(localStorageKey(uid)) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }
  function writeLocalNotifications(items, uid = currentUid) {
    if (!uid) return;
    try { localStorage.setItem(localStorageKey(uid), JSON.stringify(items.slice(0, 200))); }
    catch (error) { console.warn('[WeatherPro/Notifications] local history save failed', error); }
  }
  function readLocalChatReads(uid = currentUid) {
    if (!uid) return {};
    try {
      const value = JSON.parse(localStorage.getItem(chatReadsKey(uid)) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function writeLocalChatRead(chatId, milliseconds = Date.now(), uid = currentUid) {
    if (!uid || !chatId) return;
    const reads = readLocalChatReads(uid);
    reads[chatId] = Math.max(Number(reads[chatId]) || 0, Number(milliseconds) || Date.now());
    try { localStorage.setItem(chatReadsKey(uid), JSON.stringify(reads)); }
    catch (error) { console.warn('[WeatherPro/Notifications] local read cursor save failed', error); }
  }
  function setBadge(id, count) {
    const element = $id(id);
    if (!element) return;
    const value = Math.max(0, Number(count) || 0);
    element.textContent = value > 99 ? '99+' : String(value);
    element.hidden = value === 0;
  }
  function localUnreadCount() { return readLocalNotifications().filter(item => !item.read).length; }
  function refreshNotificationBadge() { setBadge('wpNotificationBadge', serverUnreadCount + localUnreadCount()); }
  function refreshMessageBadge() {
    let total = 0;
    for (const count of chatUnreadById.values()) total += count;
    setBadge('wpMessageActionBadge', total);
  }
  function notifyToast(message, error = false) {
    if (typeof showNotification === 'function') showNotification(message, error);
  }
  function timestampMillis(value) {
    if (value?.toMillis) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return 0;
  }
  function isChatBeingRead(chatId) {
    return typeof activeChatId !== 'undefined'
      && activeChatId === chatId
      && document.visibilityState === 'visible'
      && !!$id('chat-page')?.classList.contains('active');
  }
  function cleanListeners() {
    [notifUnreadUnsub, notifHistoryUnsub, chatsUnsub, incomingRequestsUnsub, acceptedRequestsUnsub]
      .forEach(unsubscribe => { try { unsubscribe?.(); } catch (_) {} });
    notifUnreadUnsub = notifHistoryUnsub = chatsUnsub = incomingRequestsUnsub = acceptedRequestsUnsub = null;
    for (const unsubscribe of chatMessageUnsubs.values()) { try { unsubscribe(); } catch (_) {} }
    chatMessageUnsubs.clear();
    chatSeenMessageIds.clear();
    chatUnreadRequestTokens.clear();
    if (presenceHeartbeat) clearInterval(presenceHeartbeat);
    presenceHeartbeat = null;
    currentPresenceChat = null;
  }

  async function getChatUnread(chatId, otherUid) {
    const user = authUser();
    if (!db() || !user || !chatId || !otherUid) return 0;
    const chatRef = db().collection('chats').doc(chatId);
    const [userSnap, messagesSnap] = await Promise.all([
      db().collection('users').doc(user.uid).get(),
      // Single-field query avoids any composite-index deployment. Filter the cursor locally.
      chatRef.collection('messages').where('senderId', '==', otherUid).get()
    ]);
    const readMap = userSnap.exists ? (userSnap.data().chatReads || {}) : {};
    const localReadMap = readLocalChatReads(user.uid);
    const lastRead = Math.max(timestampMillis(readMap[chatId]), Number(localReadMap[chatId]) || 0);
    return messagesSnap.docs.reduce((total, doc) => {
      return timestampMillis(doc.data().createdAt) > lastRead ? total + 1 : total;
    }, 0);
  }
  window.wpPushGetChatUnread = getChatUnread;

  function showBrowserNotification(title, body, data = {}) {
    if (!browserNotificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const options = {
      body: String(body || '').slice(0, 180),
      icon: './weather-icon-192.png',
      badge: './weather-icon-192.png',
      tag: data.notificationId || `weather-pro-${Date.now()}`,
      renotify: false,
      data: { ...data, url: './' }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(registration => registration.showNotification(String(title || 'Weather Pro'), options))
        .catch(error => console.warn('[WeatherPro/Notifications] showNotification failed', error));
    } else {
      try { new Notification(String(title || 'Weather Pro'), options); }
      catch (error) { console.warn('[WeatherPro/Notifications] Notification failed', error); }
    }
  }

  function addLocalNotification(data) {
    if (!currentUid) return;
    const items = readLocalNotifications();
    if (items.some(item => item.id === data.id)) return;
    items.unshift({
      id: data.id,
      title: String(data.title || 'Weather Pro').slice(0, 100),
      body: String(data.body || '').slice(0, 300),
      type: data.type || 'system',
      chatId: data.chatId || null,
      actionUrl: data.actionUrl || null,
      createdAtMs: Date.now(),
      read: false
    });
    writeLocalNotifications(items);
    refreshNotificationBadge();
    renderNotifications();
    const openChat = data.chatId && isChatBeingRead(data.chatId);
    if (!openChat) {
      notifyToast(data.title ? `${data.title}: ${data.body || ''}` : (data.body || 'Новое уведомление'));
      showBrowserNotification(data.title, data.body, {
        chatId: data.chatId || null,
        actionUrl: data.actionUrl || null,
        notificationId: data.id
      });
    }
  }

  function watchChatMessages(chatId, otherUid) {
    if (chatMessageUnsubs.has(chatId) || !db()) return;
    let initialized = false;
    const seen = new Set();
    const unsubscribe = db().collection('chats').doc(chatId).collection('messages')
      .orderBy('createdAt', 'desc').limit(25)
      .onSnapshot(snapshot => {
        if (!initialized) {
          // Treat the first snapshot as the baseline only. Existing recent messages must
          // not create fresh notifications every time the user reloads the app.
          snapshot.docs.forEach(doc => seen.add(doc.id));
          initialized = true;
          chatSeenMessageIds.set(chatId, seen);
          return;
        }
        snapshot.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const doc = change.doc;
          if (seen.has(doc.id)) return;
          seen.add(doc.id);
          const message = doc.data() || {};
          if (!message.senderId || message.senderId === currentUid || message.senderId !== otherUid) return;
          if (isChatBeingRead(chatId)) {
            window.wpPushMarkChatRead(chatId);
            return;
          }
          addLocalNotification({
            id: `local_message_${chatId}_${doc.id}`,
            title: String(message.senderName || 'Новое сообщение').slice(0, 80),
            body: String(message.text || 'Вам отправили сообщение').slice(0, 180),
            type: 'message', chatId, actionUrl: '/chat'
          });
        });
        chatSeenMessageIds.set(chatId, seen);
      }, error => console.warn('[WeatherPro/Notifications] chat message listener', chatId, error));
    chatMessageUnsubs.set(chatId, unsubscribe);
  }

  function watchFriendEvents(uid) {
    if (!db()) return;
    let incomingInitialized = false;
    incomingRequestsUnsub = db().collection('friendRequests').where('to', '==', uid).onSnapshot(snapshot => {
      if (!incomingInitialized) { incomingInitialized = true; return; }
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const item = change.doc.data() || {};
        if (item.status !== 'pending' || item.from === uid) return;
        addLocalNotification({
          id: `local_friend_request_${change.doc.id}`,
          title: 'Новая заявка в друзья',
          body: `${item.fromName || 'Пользователь'} хочет добавить вас в друзья`,
          type: 'friend_request', actionUrl: '/people'
        });
      });
    }, error => console.warn('[WeatherPro/Notifications] incoming friend requests', error));

    acceptedRequestsUnsub = db().collection('friendRequests').where('from', '==', uid).onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type !== 'modified') return;
        const item = change.doc.data() || {};
        if (item.status !== 'accepted') return;
        addLocalNotification({
          id: `local_friend_accepted_${change.doc.id}`,
          title: 'Заявка принята',
          body: `${item.toName || 'Пользователь'} принял(а) вашу заявку в друзья`,
          type: 'friend_accepted', actionUrl: '/people'
        });
      });
    }, error => console.warn('[WeatherPro/Notifications] accepted friend requests', error));
  }

  function startUserListeners(uid) {
    cleanListeners();
    currentUid = uid;
    notificationDocs = [];
    chatUnreadById.clear();
    serverUnreadCount = 0;
    browserNotificationsEnabled = localStorage.getItem(preferenceKey(uid)) === '1';
    refreshMessageBadge();
    refreshNotificationBadge();

    // Browser-only edition: notification history is stored per account in localStorage.
    // There is deliberately no read from users/{uid}/notifications: this collection is
    // not written by a backend in the no-deploy edition, and Firestore Rules do not expose it.
    notificationDocs = [];
    serverUnreadCount = 0;

    chatsUnsub = db().collection('chats').where('members', 'array-contains', uid).onSnapshot(snapshot => {
      const valid = new Set();
      snapshot.docs.forEach(doc => {
        const members = doc.data().members || [];
        const otherUid = members.find(memberUid => memberUid !== uid);
        if (!otherUid) return;
        valid.add(doc.id);
        watchChatMessages(doc.id, otherUid);
        const requestToken = (chatUnreadRequestTokens.get(doc.id) || 0) + 1;
        chatUnreadRequestTokens.set(doc.id, requestToken);
        getChatUnread(doc.id, otherUid).then(count => {
          if (currentUid !== uid || chatUnreadRequestTokens.get(doc.id) !== requestToken) return;
          chatUnreadById.set(doc.id, count);
          refreshMessageBadge();
        }).catch(error => console.warn('[WeatherPro/Notifications] unread chat count', doc.id, error));
      });
      for (const id of [...chatUnreadById.keys()]) if (!valid.has(id)) chatUnreadById.delete(id);
      for (const [id, unsubscribe] of [...chatMessageUnsubs.entries()]) {
        if (!valid.has(id)) { try { unsubscribe(); } catch (_) {} chatMessageUnsubs.delete(id); chatSeenMessageIds.delete(id); }
      }
      refreshMessageBadge();
    }, error => console.warn('[WeatherPro/Notifications] chats listener', error));

    watchFriendEvents(uid);
    updatePushStatus();
    renderNotifications();
  }

  window.wpPushMarkChatRead = async function(chatId) {
    const user = authUser();
    if (!user || !db() || !chatId) return;
    try {
      // Store the user's read cursor in their existing private profile document.
      // Existing owner-only Firestore rules already permit this update; no Rules deployment is needed.
      const userRef = db().collection('users').doc(user.uid);
      // Update only this chat's cursor; other chat read-cursors remain untouched.
      let readAt = Date.now();
      // Prefer the timestamp of the newest message actually loaded in this chat. This avoids
      // relying only on the phone clock, which may be ahead of or behind Firestore server time.
      if (typeof activeChatMessagesCache !== 'undefined' && Array.isArray(activeChatMessagesCache)) {
        const visibleIncomingTimes = activeChatMessagesCache
          .filter(message => message && message.senderId && message.senderId !== user.uid)
          .map(message => timestampMillis(message.createdAt))
          .filter(value => value > 0);
        if (visibleIncomingTimes.length) readAt = Math.max(...visibleIncomingTimes);
      }
      // Always persist locally first so the badge resets even if the current Firestore
      // Rules do not yet allow the optional cross-device read cursor update.
      writeLocalChatRead(chatId, readAt, user.uid);
      chatUnreadRequestTokens.set(chatId, (chatUnreadRequestTokens.get(chatId) || 0) + 1);
      chatUnreadById.set(chatId, 0);
      try {
        await userRef.update({ [`chatReads.${chatId}`]: fire().firestore.FieldValue.serverTimestamp() });
      } catch (syncError) {
        console.warn('[WeatherPro/Notifications] cross-device read cursor sync unavailable; local cursor retained', syncError);
      }
      const localItems = readLocalNotifications();
      localItems.forEach(item => { if (item.chatId === chatId) item.read = true; });
      writeLocalNotifications(localItems);
      refreshMessageBadge();
      refreshNotificationBadge();
      const row = document.querySelector(`[data-chat-id="${CSS.escape(chatId)}"]`);
      if (row) { row.classList.remove('wp-chat-unread'); row.querySelector('.wp-chat-count')?.remove(); }
      renderNotifications();
    } catch (error) { console.warn('[WeatherPro/Notifications] mark chat read', error); }
  };

  window.wpPushSetChatPresence = function(chatId, active) {
    // Local-only presence is enough in browser-only mode: it suppresses alerts
    // while this device is actively reading this exact chat. No server write needed.
    if (!chatId) return;
    currentPresenceChat = active ? chatId : (currentPresenceChat === chatId ? null : currentPresenceChat);
    if (presenceHeartbeat) clearInterval(presenceHeartbeat);
    presenceHeartbeat = null;
  };

  function renderNotifications() {
    const list = $id('wpNotificationList');
    const local = readLocalNotifications().map(item => ({ ...item, source: 'local' }));
    const all = [...local, ...notificationDocs].sort((a, b) => {
      const at = timestampMillis(a.createdAt) || Number(a.createdAtMs) || 0;
      const bt = timestampMillis(b.createdAt) || Number(b.createdAtMs) || 0;
      return bt - at;
    });
    refreshNotificationBadge();
    if (!list) return;
    if (!all.length) { list.innerHTML = '<div class="person-empty">Новых уведомлений пока нет</div>'; return; }
    list.innerHTML = '';
    all.forEach(item => {
      const row = document.createElement('article');
      row.className = 'wp-notification-item' + (item.read ? '' : ' unread');
      const icon = item.type === 'message' ? 'fa-message' : item.type === 'friend_request' ? 'fa-user-plus' : item.type === 'friend_accepted' ? 'fa-user-check' : item.type === 'weather' ? 'fa-cloud-bolt' : 'fa-bell';
      const when = timestampMillis(item.createdAt) || Number(item.createdAtMs) || 0;
      const date = when ? new Date(when) : null;
      row.innerHTML = `<span class="wp-notification-icon"><i class="fa-solid ${icon}"></i></span><div class="wp-notification-copy"><strong>${escapeHtml(item.title || 'Weather Pro')}</strong><p>${escapeHtml(item.body || '')}</p><time>${date ? date.toLocaleString('ru-RU') : 'Только что'}</time></div><div class="wp-notification-actions">${item.read ? '' : '<span class="wp-notification-dot" title="Не прочитано"></span>'}<button type="button" aria-label="Удалить уведомление" title="Удалить"><i class="fa-solid fa-trash"></i></button></div>`;
      row.addEventListener('click', () => openNotification(item));
      row.querySelector('button').addEventListener('click', event => { event.stopPropagation(); deleteNotification(item); });
      list.appendChild(row);
    });
  }

  async function markNotificationRead(item) {
    const items = readLocalNotifications();
    const target = items.find(entry => entry.id === item.id);
    if (target) target.read = true;
    writeLocalNotifications(items);
    refreshNotificationBadge();
    renderNotifications();
  }
  async function deleteNotification(item) {
    const items = readLocalNotifications().filter(entry => entry.id !== item.id);
    writeLocalNotifications(items);
    refreshNotificationBadge();
    renderNotifications();
  }
  async function openNotification(item) {
    await markNotificationRead(item);
    if (item.chatId) { await openChatFromId(item.chatId); return; }
    if (item.actionUrl && item.actionUrl.startsWith('/') && typeof showPage === 'function') {
      const page = item.actionUrl.replace(/^\/+|\/$/g, '').replace('-page', '');
      if ($id(page + '-page')) showPage(page);
    }
  }
  async function openChatFromId(chatId) {
    const user = authUser();
    if (!user) return;
    try {
      const snap = await db().collection('chats').doc(chatId).get();
      if (!snap.exists) return;
      const other = (snap.data().members || []).find(uid => uid !== user.uid);
      if (!other) return;
      const profile = await db().collection('publicProfiles').doc(other).get();
      const name = profile.data()?.displayName || 'Друг';
      if (typeof openChat === 'function') await openChat(other, name);
    } catch (error) { console.warn('[WeatherPro/Notifications] open chat', error); }
  }

  window.wpOpenNotificationCenter = function() {
    if (!authUser()) { notifyToast('Войдите в аккаунт, чтобы открыть уведомления', true); return; }
    if (typeof showPage === 'function') showPage('notifications');
    renderNotifications();
  };
  window.wpMarkAllNotificationsRead = async function() {
    if (!authUser()) { notifyToast('Войдите в аккаунт, чтобы управлять уведомлениями', true); return; }
    try {
      const items = readLocalNotifications();
      items.forEach(item => { item.read = true; });
      writeLocalNotifications(items);
      refreshNotificationBadge();
      renderNotifications();
      notifyToast('Все уведомления прочитаны');
    } catch (error) {
      console.error('[WeatherPro/Notifications] mark all local notifications read', error);
      notifyToast('Не удалось обновить локальную историю уведомлений', true);
    }
  };

  async function updatePushStatus() {
    const status = $id('wpPushStatus');
    const button = $id('wpPushToggle');
    if (!status || !button) return;
    const user = authUser();
    if (!user) {
      status.textContent = 'Войдите в аккаунт, чтобы включить уведомления';
      button.textContent = 'Включить уведомления';
      button.disabled = true;
      return;
    }
    button.disabled = false;
    if (!('Notification' in window)) {
      status.textContent = 'Браузер не поддерживает системные уведомления. Счётчики внутри сайта продолжат работать.';
      button.textContent = 'Недоступно';
      button.disabled = true;
      return;
    }
    browserNotificationsEnabled = localStorage.getItem(preferenceKey(user.uid)) === '1';
    if (Notification.permission === 'denied') {
      status.textContent = 'Разрешение заблокировано. Разрешите уведомления в настройках сайта браузера.';
      button.textContent = 'Как разрешить?';
      return;
    }
    if (browserNotificationsEnabled && Notification.permission === 'granted') {
      status.textContent = 'Уведомления включены, пока Weather Pro открыт или работает в фоне';
      button.textContent = 'Отключить уведомления';
    } else {
      status.textContent = 'Без сервера уведомления приходят, пока сайт открыт или работает в фоне';
      button.textContent = 'Включить уведомления';
    }
  }

  window.wpTogglePush = async function() {
    const user = authUser();
    if (!user) { notifyToast('Сначала войдите в аккаунт', true); return; }
    const button = $id('wpPushToggle');
    if (button) button.disabled = true;
    try {
      if (!('Notification' in window)) throw new Error('Этот браузер не поддерживает системные уведомления');
      if (Notification.permission === 'denied') throw new Error('Откройте настройки браузера Android → Настройки сайта → Уведомления → Разрешить для Weather Pro.');
      const enabled = localStorage.getItem(preferenceKey(user.uid)) === '1' && Notification.permission === 'granted';
      if (enabled) {
        localStorage.removeItem(preferenceKey(user.uid));
        browserNotificationsEnabled = false;
        notifyToast('Системные уведомления отключены');
      } else {
        const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках браузера Android');
        if ('serviceWorker' in navigator) await navigator.serviceWorker.register('./sw.js', { scope: './' });
        localStorage.setItem(preferenceKey(user.uid), '1');
        browserNotificationsEnabled = true;
        notifyToast('Уведомления включены для открытого Weather Pro');
      }
    } catch (error) { notifyToast(error.message || 'Не удалось включить уведомления', true); }
    finally { if (button) button.disabled = false; updatePushStatus(); }
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      const message = event.data || {};
      if (message.type !== 'WEATHER_PRO_NOTIFICATION_CLICK') return;
      const data = message.data || {};
      if (data.notificationId) {
        const local = readLocalNotifications().find(item => item.id === data.notificationId);
        if (local) markNotificationRead({ ...local, source: 'local' });
      }
      if (data.chatId) openChatFromId(data.chatId);
      else if (data.actionUrl) {
        const page = data.actionUrl.replace(/^\/+|\/$/g, '').replace('-page', '');
        if ($id(page + '-page') && typeof showPage === 'function') showPage(page);
      }
    });
  }

  function processLaunchLink() {
    const url = new URL(location.href);
    const chatId = url.searchParams.get('wpChat');
    const notificationId = url.searchParams.get('wpNotification');
    const actionUrl = url.searchParams.get('wpAction');
    if (!chatId && !notificationId && !actionUrl) return;
    url.searchParams.delete('wpChat');
    url.searchParams.delete('wpNotification');
    url.searchParams.delete('wpAction');
    history.replaceState({}, '', url.pathname + url.search + url.hash);
    if (notificationId) {
      const local = readLocalNotifications().find(item => item.id === notificationId);
      if (local) markNotificationRead({ ...local, source: 'local' });
    }
    if (chatId) openChatFromId(chatId);
    else if (actionUrl) {
      const page = actionUrl.replace(/^\/+|\/$/g, '').replace('-page', '');
      if ($id(page + '-page') && typeof showPage === 'function') showPage(page);
    }
  }

  if (typeof fbAuth !== 'undefined' && fbAuth?.onAuthStateChanged) {
    fbAuth.onAuthStateChanged(user => {
      if (!user) {
        cleanListeners();
        currentUid = null;
        notificationDocs = [];
        serverUnreadCount = 0;
        chatUnreadById.clear();
        browserNotificationsEnabled = false;
        refreshMessageBadge();
        refreshNotificationBadge();
        updatePushStatus();
        renderNotifications();
        return;
      }
      if (currentUid !== user.uid) startUserListeners(user.uid);
      processLaunchLink();
    });
  }

  document.addEventListener('visibilitychange', () => {
    const chatId = typeof activeChatId !== 'undefined' ? activeChatId : null;
    if (!chatId || !authUser()) return;
    if (document.visibilityState === 'visible') {
      window.wpPushSetChatPresence(chatId, true);
      window.wpPushMarkChatRead(chatId);
    } else {
      window.wpPushSetChatPresence(chatId, false);
    }
  });
  window.addEventListener('pagehide', () => {
    const chatId = typeof activeChatId !== 'undefined' ? activeChatId : currentPresenceChat;
    if (chatId) window.wpPushSetChatPresence(chatId, false);
  });
  updatePushStatus();
})();
