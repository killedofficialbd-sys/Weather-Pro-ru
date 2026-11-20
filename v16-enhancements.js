/* Weather Pro V16.2 — unified map workspace, live chat state and real UV data. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const safeNotify = (message, isError = false) => {
    if (typeof window.showNotification === 'function') window.showNotification(message, isError);
    else console.info('[WeatherPro/V16.2]', message);
  };

  // ---------------------------------------------------------------------------
  // Weather Core 2.0: real Open-Meteo UV index only. No time-of-day estimates.
  // ---------------------------------------------------------------------------
  const UV_CACHE_PREFIX = 'wp16_uv_real_';
  let uvRequestToken = 0;

  function uvCategory(value) {
    if (value < 3) return ['Низкий', '#10b981'];
    if (value < 6) return ['Умеренный', '#f59e0b'];
    if (value < 8) return ['Высокий', '#f97316'];
    if (value < 11) return ['Очень высокий', '#ef4444'];
    return ['Экстремальный', '#8b5cf6'];
  }

  function uvCacheKey(lat, lon) {
    return UV_CACHE_PREFIX + Number(lat).toFixed(2) + '_' + Number(lon).toFixed(2);
  }

  function renderUV(value, source, savedAt) {
    const label = $('uvLabel');
    const text = $('uvText');
    const arc = $('uvArc');
    const marker = $('uvMarker');
    if (!Number.isFinite(value) || value < 0) {
      if (label) label.textContent = 'Нет данных';
      if (text) text.textContent = '—';
      if (arc) arc.setAttribute('stroke-dashoffset', '141.4');
      if (marker) {
        marker.setAttribute('cx', '15');
        marker.setAttribute('cy', '70');
        marker.setAttribute('stroke', '#94a3b8');
      }
      const card = label?.closest('.gauge-card');
      if (card) {
        card.title = 'УФ-индекс не получен от погодного источника.';
        card.setAttribute('aria-label', 'УФ-индекс: нет фактических данных');
      }
      return;
    }

    const bounded = Math.max(0, Math.min(20, value));
    const [category, color] = uvCategory(bounded);
    if (label) label.textContent = category;
    if (text) text.textContent = Number(bounded.toFixed(1)).toString();
    if (arc) arc.setAttribute('stroke-dashoffset', String(141.4 - (Math.min(11, bounded) / 11) * 141.4));
    if (marker) {
      const angle = (Math.min(11, bounded) / 11) * 180;
      const rad = (180 - angle) * Math.PI / 180;
      marker.setAttribute('cx', String(60 + 45 * Math.cos(rad)));
      marker.setAttribute('cy', String(70 - 45 * Math.sin(rad)));
      marker.setAttribute('stroke', color);
    }
    const card = label?.closest('.gauge-card');
    if (card) {
      const timestamp = savedAt ? new Date(savedAt).toLocaleString('ru-RU') : 'время источника не указано';
      card.title = `${source || 'Open-Meteo'} · получено: ${timestamp}`;
      card.setAttribute('aria-label', `УФ-индекс ${bounded.toFixed(1)} · ${category} · ${source || 'Open-Meteo'}`);
    }
  }

  async function loadUV(weather) {
    const token = ++uvRequestToken;
    const coord = weather?.coord || {};
    const lat = Number(coord.lat);
    const lon = Number(coord.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      renderUV(null);
      return;
    }

    const key = uvCacheKey(lat, lon);
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (!cached || !Number.isFinite(Number(cached.value)) || !Number.isFinite(Number(cached.fetchedAt))) cached = null;
    } catch (_) { cached = null; }

    const cacheAge = cached ? Date.now() - cached.fetchedAt : Infinity;
    if (cached && cacheAge < 8 * 60 * 60 * 1000) {
      renderUV(Number(cached.value), cacheAge < 15 * 60 * 1000 ? 'Open-Meteo · кэш' : 'Open-Meteo · сохранённые данные', cached.fetchedAt);
      if (cacheAge < 10 * 60 * 1000) return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=uv_index&timezone=auto`;
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Open-Meteo UV HTTP ${response.status}`);
      const payload = await response.json();
      const raw = Number(payload?.current?.uv_index);
      if (!Number.isFinite(raw) || raw < 0) throw new Error('Open-Meteo не вернул фактический UV index');
      if (token !== uvRequestToken) return;
      const entry = { value: raw, fetchedAt: Date.now(), sourceTime: payload?.current?.time || null };
      try { localStorage.setItem(key, JSON.stringify(entry)); } catch (_) { /* optional local cache */ }
      renderUV(raw, 'Open-Meteo', entry.fetchedAt);
    } catch (error) {
      if (token !== uvRequestToken) return;
      if (cached && cacheAge < 24 * 60 * 60 * 1000) {
        renderUV(Number(cached.value), 'Open-Meteo · устаревший кэш', cached.fetchedAt);
      } else {
        renderUV(null);
        console.info('[WeatherPro/V16.2/UV] Фактический УФ-индекс недоступен:', error.message || error);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  window.wp16LoadUV = loadUV;

  // ---------------------------------------------------------------------------
  // Unified Map Engine 2.0: shared controls for existing 2D, radar and 3D views.
  // ---------------------------------------------------------------------------
  const MAP_LABELS = {
    precipitation_new: 'Осадки', radar: 'Исторический радар', wind_new: 'Ветер',
    temp_new: 'Температура', clouds_new: 'Облачность', pressure_new: 'Давление',
    none: 'Погодный слой выключен', globe: '3D-глобус', satellite: '3D-спутник'
  };

  function setMapWorkspaceStatus(message, activeLabel) {
    const status = $('wp16MapWorkspaceStatus');
    if (status) status.textContent = message;
    const active = $('wp16MapActiveMode');
    if (active && activeLabel) active.textContent = activeLabel;
  }

  function setMapSelectedButton(mode) {
    document.querySelectorAll('.wp16-map-mode').forEach(button => {
      const selected = button.dataset.wp16Map === mode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  async function selectMapMode(mode, invokedButton) {
    const allowed = Object.prototype.hasOwnProperty.call(MAP_LABELS, mode);
    if (!allowed) return;
    setMapSelectedButton(mode);
    if (invokedButton && invokedButton.matches('.wp16-map-mode')) invokedButton.classList.add('active');

    if (mode === 'globe') {
      if (typeof window.showPage === 'function') window.showPage('globe');
      setMapWorkspaceStatus('3D-глобус открыт. Погодные тайловые слои доступны в разделе карты.', MAP_LABELS[mode]);
      return;
    }
    if (mode === 'satellite') {
      if (typeof window.showPage === 'function') window.showPage('map');
      if (typeof window.wp13Open3DMap === 'function') window.wp13Open3DMap();
      setMapWorkspaceStatus('3D-спутниковая карта открыта в рабочей области карты.', MAP_LABELS[mode]);
      return;
    }

    if (typeof window.showPage === 'function' && !$('map-page')?.classList.contains('active')) window.showPage('map');
    try {
      if (mode === 'radar' && typeof window.initRadar === 'function') await window.initRadar();
      if (typeof window.setLayerByName === 'function') window.setLayerByName(mode);
      document.querySelectorAll('.layer-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.layer === mode);
      });
      const source = mode === 'radar' ? 'RainViewer · исторические кадры' : 'OpenWeather · погодный тайловый слой';
      setMapWorkspaceStatus(`Источник: ${source}. Можно переключать слой без выхода из картографической панели.`, MAP_LABELS[mode]);
      setTimeout(() => { if (typeof mapInst !== 'undefined' && mapInst) mapInst.invalidateSize?.(); }, 120);
    } catch (error) {
      setMapWorkspaceStatus(`${MAP_LABELS[mode]} временно недоступен. Базовая карта остаётся доступной.`, MAP_LABELS[mode]);
      console.warn('[WeatherPro/V16.2/Map]', error);
    }
  }

  window.wp16MapSelect = selectMapMode;
  window.WeatherProV16 = window.WeatherProV16 || {};
  window.WeatherProV16.map = {
    select: selectMapMode,
    getActiveLayer: () => (typeof mapLayerName !== 'undefined' ? mapLayerName : 'unknown'),
    getSource: () => window.wp15CurrentSource || 'unknown'
  };

  // Keep the location label in the map hub in sync when the active city changes.
  const cityLabel = $('locationName');
  if (cityLabel && typeof MutationObserver === 'function') {
    const updateCity = () => {
      const target = $('wp81MapCity');
      if (target && cityLabel.textContent.trim()) target.textContent = cityLabel.textContent.trim();
    };
    new MutationObserver(updateCity).observe(cityLabel, { childList: true, characterData: true, subtree: true });
    updateCity();
  }

  // ---------------------------------------------------------------------------
  // Social System 2.0: private chat state, delivery/read receipts and typing.
  // ---------------------------------------------------------------------------
  let chatStateUnsubscribe = null;
  let chatTypingHandler = null;
  let chatTypingClearTimer = null;
  let lastTypingWriteAt = 0;
  let chatStateOwner = '';
  let chatStateId = '';
  let peerTypingUntil = 0;

  function getChatContext() {
    try {
      const uid = typeof fbUser !== 'undefined' && fbUser?.uid ? fbUser.uid : '';
      const id = typeof activeChatId !== 'undefined' ? activeChatId : '';
      const peer = typeof activeChatOtherUid !== 'undefined' ? activeChatOtherUid : '';
      return { uid, id, peer };
    } catch (_) { return { uid: '', id: '', peer: '' }; }
  }

  function getChatStateRef(chatId, uid) {
    if (typeof fbDb === 'undefined' || !fbDb || !chatId || !uid) return null;
    return fbDb.collection('chats').doc(chatId).collection('state').doc(uid);
  }

  function timestampMillis(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return Number(value) || 0;
  }

  function updateChatSubtitle() {
    const subtitle = $('chatSubtitle');
    if (!subtitle) return;
    subtitle.textContent = peerTypingUntil > Date.now() ? 'Печатает…' : 'Личная переписка';
  }

  async function setOwnChatState(fields) {
    const { uid, id } = getChatContext();
    if (!uid || !id || typeof firebase === 'undefined') return;
    const ref = getChatStateRef(id, uid);
    if (!ref) return;
    try { await ref.set(fields, { merge: true }); }
    catch (error) { console.info('[WeatherPro/V16.2/ChatState] Не удалось обновить статус:', error.code || error.message); }
  }

  function clearTypingState() {
    if (chatTypingClearTimer) clearTimeout(chatTypingClearTimer);
    chatTypingClearTimer = null;
    const { uid, id } = getChatContext();
    if (!uid || !id || chatStateOwner !== uid || chatStateId !== id) return;
    const ts = firebase.firestore.Timestamp.fromMillis(Date.now() - 1000);
    setOwnChatState({ typingUntil: ts, lastActiveAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  function onChatTyping() {
    const input = $('chatMessageInput');
    const { uid, id } = getChatContext();
    if (!input || !input.value.trim() || !uid || !id) { clearTypingState(); return; }
    const now = Date.now();
    if (now - lastTypingWriteAt >= 1800) {
      lastTypingWriteAt = now;
      const until = firebase.firestore.Timestamp.fromMillis(now + 4500);
      setOwnChatState({ typingUntil: until, lastActiveAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    if (chatTypingClearTimer) clearTimeout(chatTypingClearTimer);
    chatTypingClearTimer = setTimeout(clearTypingState, 4800);
  }

  function stopChatState() {
    if (chatStateOwner && chatStateId) {
      const context = getChatContext();
      if (context.uid === chatStateOwner && context.id === chatStateId && typeof firebase !== 'undefined') {
        setOwnChatState({ typingUntil: firebase.firestore.Timestamp.fromMillis(Date.now() - 1000) });
      }
    }
    if (chatStateUnsubscribe) { chatStateUnsubscribe(); chatStateUnsubscribe = null; }
    const input = $('chatMessageInput');
    if (input && chatTypingHandler) {
      input.removeEventListener('input', chatTypingHandler);
      input.removeEventListener('blur', clearTypingState);
    }
    chatTypingHandler = null;
    if (chatTypingClearTimer) clearTimeout(chatTypingClearTimer);
    chatTypingClearTimer = null;
    peerTypingUntil = 0;
    chatStateOwner = '';
    chatStateId = '';
  }

  function markReceived(chatId, docs) {
    const { uid, id } = getChatContext();
    if (!uid || !chatId || id !== chatId || !Array.isArray(docs) || !docs.length) return;
    const incoming = docs.map(doc => ({ data: doc.data(), id: doc.id }))
      .filter(item => item.data?.senderId && item.data.senderId !== uid && item.data.createdAt)
      .sort((a, b) => timestampMillis(a.data.createdAt) - timestampMillis(b.data.createdAt));
    if (!incoming.length) return;
    const latest = incoming[incoming.length - 1].data.createdAt;
    const visible = !document.hidden && $('chat-page')?.classList.contains('active');
    const state = { lastDeliveredAt: latest, lastActiveAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (visible) state.lastReadAt = latest;
    setOwnChatState(state);
  }
  window.wp16ChatMarkReceived = markReceived;

  function attachChatState(chatId, peerUid) {
    stopChatState();
    const { uid, id } = getChatContext();
    if (!uid || !chatId || chatId !== id || !peerUid) return;
    chatStateOwner = uid;
    chatStateId = chatId;
    const ownRef = getChatStateRef(chatId, uid);
    const peerRef = getChatStateRef(chatId, peerUid);
    if (!ownRef || !peerRef) return;

    setOwnChatState({ lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(), typingUntil: firebase.firestore.Timestamp.fromMillis(Date.now() - 1000) });
    chatStateUnsubscribe = peerRef.onSnapshot(snapshot => {
      if (getChatContext().id !== chatId) return;
      const data = snapshot.exists ? snapshot.data() : {};
      activeChatOtherReadAt = data.lastReadAt || null;
      activeChatOtherDeliveredAt = data.lastDeliveredAt || null;
      peerTypingUntil = timestampMillis(data.typingUntil);
      updateChatSubtitle();
      if (typeof window.renderChatMessages === 'function') window.renderChatMessages();
    }, error => console.info('[WeatherPro/V16.2/ChatState] Статусы собеседника недоступны:', error.code || error.message));

    const input = $('chatMessageInput');
    if (input) {
      chatTypingHandler = onChatTyping;
      input.addEventListener('input', chatTypingHandler, { passive: true });
      input.addEventListener('blur', clearTypingState);
    }
  }

  const originalOpenChat = window.openChat;
  if (typeof originalOpenChat === 'function' && !window.wp16ChatStateWrapped) {
    window.openChat = async function (...args) {
      stopChatState();
      const result = await originalOpenChat.apply(this, args);
      const { id, peer } = getChatContext();
      if (id && peer && $('chat-page')?.classList.contains('active')) attachChatState(id, peer);
      return result;
    };
    window.wp16ChatStateWrapped = true;
  }

  const originalShowPage = window.showPage;
  if (typeof originalShowPage === 'function' && !window.wp16ChatPageWrapped) {
    window.showPage = function (pageId) {
      if (pageId !== 'chat') {
        stopChatState();
        try { activeChatOtherReadAt = null; activeChatOtherDeliveredAt = null; } catch (_) {}
      }
      return originalShowPage.apply(this, arguments);
    };
    window.wp16ChatPageWrapped = true;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const { id } = getChatContext();
    if (id && $('chat-page')?.classList.contains('active')) {
      const docs = (typeof activeChatMessagesCache !== 'undefined' ? activeChatMessagesCache : []).map(item => ({ data: () => item }));
      markReceived(id, docs);
    }
  });

  // ---------------------------------------------------------------------------
  // Keep source and freshness in a public, read-only runtime status object.
  // ---------------------------------------------------------------------------
  function refreshWeatherMeta() {
    try {
      const data = typeof lastWeatherData !== 'undefined' ? lastWeatherData : null;
      const city = typeof currentCity !== 'undefined' ? currentCity : '';
      const time = typeof lastFetchAt !== 'undefined' ? lastFetchAt[String(city || data?.name || '').toLowerCase()] : null;
      window.WeatherProV16.weather = {
        city: city || data?.name || null,
        source: window.wp15CurrentSource || 'OpenWeather',
        updatedAt: Number(time) || null,
        isFresh: Number.isFinite(Number(time)) ? Date.now() - Number(time) <= 60 * 60 * 1000 : false
      };
    } catch (_) { /* diagnostics are optional */ }
  }
  refreshWeatherMeta();
  document.addEventListener('visibilitychange', refreshWeatherMeta);
  window.addEventListener('online', refreshWeatherMeta);
  window.addEventListener('offline', refreshWeatherMeta);
  setInterval(refreshWeatherMeta, 30000);

  // Unified map controls should not shadow or replace the legacy layer buttons.
  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.wp16-map-mode');
    buttons.forEach(button => button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false'));
  }, { once: true });
})();
