/* Weather Pro V16 module: 01-auth-and-profile.js — extracted from the existing app script. */


/* ============================================================
   CONFIG
   ============================================================ */

const OWM_KEY = '7ee647c81d8746d1db6d76d4156539e8';
const CHAT_API = 'https://text.pollinations.ai/';
const FETCH_TTL = 5*60*1000;
const ALLOWED_MODELS = [
  {id:'openai',name:'OpenAI',icon:'i-brain'},
  {id:'mistral',name:'Mistral',icon:'i-zap'},
  {id:'llama',name:'LLaMA',icon:'i-robot'},
  {id:'deepseek',name:'DeepSeek',icon:'i-database'},
  {id:'gemini',name:'Gemini',icon:'i-gem'}
];
const KEYS = {USER:'wp_user',SETTINGS:'wp_settings',LAST:'wp_last',SEARCH:'wp_search',FAV:'wp_fav',CACHE:'wp_cache',HIST:'wp_hist',NOTIF:'wp_notif_dismissed'};

/* === Firebase config — замени на свой из console.firebase.google.com === */
const firebaseConfig = {
  apiKey: "AIzaSyBoF8t0tokHsrBWxDC24DF2pOU7JEYRN2A",
  authDomain: "weatherpro-ad9aa.firebaseapp.com",
  projectId: "weatherpro-ad9aa",
  storageBucket: "weatherpro-ad9aa.firebasestorage.app",
  messagingSenderId: "304307183563",
  appId: "1:304307183563:web:5abbbfa06e90e0219d204e",
  measurementId: "G-4PBFCVDRPX"
};

let fbApp=null, fbAuth=null, fbDb=null, fbUser=null, fbReady=false;
let fbAuthReady = false;
let fbSyncInProgress = false;
let fbAuthGeneration = 0;


// Route to the personal profile after an explicit Google sign-in, including mobile redirects.
// Restoring an existing session on an ordinary app launch does not force a navigation.
const WP_AUTH_PROFILE_INTENT = 'wp_auth_profile_after_google';


function wpGoogleCompleteSignIn(user, source='Google'){
  if(!user) throw new Error('Google не вернул данные пользователя.');
  const activeUser = fbAuth?.currentUser;
  if(activeUser && activeUser.uid !== user.uid){
    throw new Error('Firebase подтвердил другой аккаунт. Закройте окно входа и повторите попытку.');
  }

  fbUser = user;
  fbAuthReady = true;
  if(typeof wp6AdoptFirebaseIdentity === 'function') wp6AdoptFirebaseIdentity(user);
  wp6AdoptFirebaseIdentity(user);
  currentUser.email=user.email||currentUser.email||'';
  saveUser();
  updateUI();
  try{localStorage.removeItem(WP_AUTH_PROFILE_INTENT);}catch(_){ }
  // This is deliberately synchronous with the successful Firebase result.
  // Firestore is hydrated separately and is never allowed to keep the user on Guest.
  showPage('profile');
  if(typeof wp81UpdateHubSummaries === 'function'){
    wp81UpdateHubSummaries();
    if(typeof requestAnimationFrame === 'function') requestAnimationFrame(()=>wp81UpdateHubSummaries());
  }
  showNotification('Вход через Google выполнен. Открыт ваш профиль.');
  return true;
}
function wpAuthRouteToProfile(user, force=false){
  if(!user) return false;
  const activeAuthUser = fbAuth?.currentUser;
  if(activeAuthUser && activeAuthUser.uid !== user.uid) return false;

  let pendingIntent = false;
  try{
    const raw = localStorage.getItem(WP_AUTH_PROFILE_INTENT);
    if(raw){
      const startedAt = Number(raw);
      pendingIntent = Number.isFinite(startedAt) && startedAt > 0 && (Date.now() - startedAt) < 10*60*1000;
      if(!pendingIntent) localStorage.removeItem(WP_AUTH_PROFILE_INTENT);
    }
  }catch(_){ }

  const authPageActive = !!document.getElementById('auth-page')?.classList.contains('active');
  if(!force && !pendingIntent && !authPageActive) return false;
  try{ localStorage.removeItem(WP_AUTH_PROFILE_INTENT); }catch(_){ }

  fbUser = user;
  fbAuthReady = true;
  if(typeof wp6AdoptFirebaseIdentity === 'function') wp6AdoptFirebaseIdentity(user);
  if(typeof updateUI === 'function' && document.readyState !== 'loading') updateUI();
  if(typeof showPage === 'function') showPage('profile');
  if(typeof wp81UpdateHubSummaries === 'function'){
    wp81UpdateHubSummaries();
    if(typeof requestAnimationFrame === 'function') requestAnimationFrame(()=>wp81UpdateHubSummaries());
  }
  return true;
}

try {
  if (!window.firebase || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('ВСТАВЬ')) {
    console.error('[WeatherPro/Firebase] SDK или конфигурация Firebase не найдены.');
  } else {
    // Поддерживаем повторную инициализацию при горячей перезагрузке/повторном запуске.
    fbApp = firebase.apps && firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbReady = true;

    // Keep Google sessions across reloads and browser restarts. Firebase's default
    // is usually LOCAL, but making it explicit avoids accidental session-only state.
    if (firebase.auth.Auth?.Persistence?.LOCAL && typeof fbAuth.setPersistence === 'function') {
      fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error => {
        console.warn('[WeatherPro/Auth] Не удалось включить постоянную сессию:', error.code || error.message);
      });
    }

    fbAuth.onAuthStateChanged(async user => {
      const generation = ++fbAuthGeneration;
      if(typeof stopSocialListeners==='function') stopSocialListeners();
      fbUser = user || null;
      fbAuthReady = true;
      console.info('[WeatherPro/Auth] Состояние авторизации:', user
        ? { uid: user.uid, email: user.email, provider: user.providerData?.[0]?.providerId }
        : 'гость');

      if (!user) {
        currentUser = {
          id: 'guest', name: 'Гость', email: '', avatar: null, avatarIcon: null,
          defaultCity: 'Москва', registrationDate: new Date().toISOString(), bio: ''
        };
        saveUser();
        updateUI();
        if(typeof wp81UpdateHubSummaries==='function') wp81UpdateHubSummaries();
        return;
      }

      // Restore this UID's own cached profile immediately; never reuse another account's data.
      wp6AdoptFirebaseIdentity(user);
      // Сбрасываем данные предыдущего аккаунта и поднимаем штатные настройки по умолчанию.
      settings = {
        darkTheme:true, animations:true, units:'metric', autoLocation:true,
        weatherNotifications:false, browserNotifications:false, soundNotifications:false,
        saveHistory:true, autoSave:true, accentColor:'#3b82f6', theme:'default', autoTheme:true,
        timeFormat:'24h', compactMode:false, windUnit:'ms'
      };
      localStorage.removeItem(KEYS.FAV);
      localStorage.removeItem(KEYS.SEARCH);
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
      saveUser();
      loadSettings();
      updateUI();
      // Complete an explicit Google handoff as soon as Firebase confirms the user.
      // Cloud profile loading below is not a prerequisite for navigation.
      wpAuthRouteToProfile(user, false);
      if(typeof wp81UpdateHubSummaries==='function') wp81UpdateHubSummaries();

      try {
        await loadFromCloud();
        if (generation !== fbAuthGeneration || !fbUser || fbUser.uid !== user.uid) return;
        console.info('[WeatherPro/Firebase] Профиль аккаунта загружен и синхронизирован.');
        if(typeof wp81UpdateHubSummaries==='function') wp81UpdateHubSummaries();
        if(document.getElementById('people-page')?.classList.contains('active')) loadSocialHub();
      } catch (error) {
        console.error('[WeatherPro/Firebase] Ошибка инициализации профиля:', error);
        showNotification('Не удалось загрузить профиль из Firestore: ' + (error.code || error.message), true);
      }
    });

    // Completes a signInWithRedirect flow on mobile browsers.
    if (typeof fbAuth.getRedirectResult === 'function') {
      fbAuth.getRedirectResult().then(result => {
        if (result?.user) {
          console.info('[WeatherPro/Auth] Google redirect sign-in completed.');
          wpGoogleCompleteSignIn(result.user, 'redirect');
        }
      }).catch(error => {
        console.error('[WeatherPro/Auth] Google redirect result failed:', error);
        const messages = {
          'auth/unauthorized-domain': 'Добавьте текущий адрес сайта в Firebase → Authentication → Settings → Authorized domains.',
          'auth/operation-not-allowed': 'Включите Google provider в Firebase Authentication.',
          'auth/invalid-api-key': 'Проверьте apiKey в firebaseConfig.'
        };
        showNotification(messages[error.code] || ('Ошибка возврата Google-входа: ' + (error.code || error.message)), true);
      });
    }
  }
} catch (e) {
  fbReady = false;
  console.error('[WeatherPro/Firebase] Ошибка инициализации:', e);
}

/* ============================================================
   STATE
   ============================================================ */

let currentUser=null, settings={}, selectedAvatar=null, currentCity='Москва', lang='ru';
let tempChart=null, humidityChart=null, historyChart=null, mapInst=null, mapLayerObj=null, mapLayerName='precipitation_new';
let lastTemp=null, lastDesc=null, lastWeatherData=null, lastForecastData=null;
let historyData={}, lastFetchAt={}, recognition=null, listening=false, qrInst=null;
let currentRadarMode=false;
let radarFrames=[], radarHost='', radarCurrentIdx=0, radarLayer=null;
let radarAnimTimer=null, radarPlaying=false;
let compareChartInst=null, dayDetailChartInst=null;
let _pwaPrompt=null;

const $ = id=>document.getElementById(id);
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Public founder mark: based on the authenticated email stored in publicProfiles.
// Existing Firestore rules require that this email matches the user's Firebase Auth token.
window.wp17FounderBadgeMarkup = function(email){
  return String(email||'').trim().toLowerCase()==='killedofficialbd@gmail.com'
    ? '<span class="wp17-founder-inline-badge" title="Основатель Weather Pro" aria-label="Основатель Weather Pro"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>Основатель</span></span>'
    : '';
};
const svg = (id,cls='')=>`<svg class="icon ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const wp5FaIcon = (name, extra='')=>`<i class="fa-solid ${name} ${extra}" aria-hidden="true"></i>`;

function avatarImageMarkup(value, alt='Аватар пользователя'){
  const src=String(value??'').trim();
  const safe=/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,/i.test(src)||/^https:\/\//i.test(src);
  return safe?`<img class="avatar-photo" src="${esc(src)}" alt="${esc(alt)}" draggable="false" loading="lazy">`:'';
}
function renderAvatarElement(node, photo, iconName='i-user', alt='Аватар пользователя'){
  if(!node)return;
  node.style.backgroundImage='none';
  const markup=photo?avatarImageMarkup(photo,alt):'';
  node.classList.toggle('has-avatar-photo',!!markup);
  if(markup){node.innerHTML=markup;return;}
  node.innerHTML=svg(iconName||'i-user');
}


/* ============================================================
   FIREBASE FUNCTIONS
   ============================================================ */

function loginWithGoogle(){
  if(!fbReady || !fbAuth){
    showNotification('Firebase не подключён. Проверьте firebaseConfig и SDK.', true);
    console.error('[WeatherPro/Auth] Google-вход невозможен: Firebase Auth не инициализирован.');
    return;
  }

  const ua = String(navigator.userAgent || '');
  const isEmbeddedWebView = /;\s*wv\)|\bFBAN\b|\bFBAV\b|Instagram|\bTelegram\b|\bLine\//i.test(ua);
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({prompt:'select_account'});

  const buttons = Array.from(document.querySelectorAll('.wp-auth-google'));
  buttons.forEach(button => { button.disabled = true; button.dataset.wpGoogleBusy = '1'; });
  const restoreButtons = () => buttons.forEach(button => {
    button.disabled = false;
    delete button.dataset.wpGoogleBusy;
  });
  const clearIntent = () => { try{localStorage.removeItem(WP_AUTH_PROFILE_INTENT);}catch(_){ } };
  const explainError = error => {
    const code = String(error?.code || '');
    const messages = {
      'auth/unauthorized-domain':'Адрес сайта не разрешён Firebase. Добавьте домен сайта в Firebase Console → Authentication → Settings → Authorized domains.',
      'auth/operation-not-allowed':'В Firebase не включён Google-провайдер. Откройте Authentication → Sign-in method → Google и включите его.',
      'auth/popup-blocked':'Браузер заблокировал окно Google. Разрешите всплывающие окна или откройте сайт в Chrome.',
      'auth/popup-closed-by-user':'Окно Google закрыто до завершения входа. Попробуйте ещё раз.',
      'auth/cancelled-popup-request':'Запрос Google-входа уже выполняется. Подождите секунду и попробуйте снова.',
      'auth/network-request-failed':'Не удалось связаться с Google/Firebase. Проверьте интернет и повторите попытку.',
      'auth/web-storage-unsupported':'Браузер блокирует хранилище авторизации. Откройте сайт в обычном режиме Chrome.',
      'auth/account-exists-with-different-credential':'Эта Google-почта уже зарегистрирована другим способом. Войдите существующим способом (email/пароль), затем свяжите Google в настройках аккаунта.',
      'auth/credential-already-in-use':'Этот Google-аккаунт уже привязан к другому профилю Weather Pro.',
      'auth/invalid-api-key':'Firebase API key некорректен. Проверьте firebaseConfig.',
      'auth/user-disabled':'Этот аккаунт отключён в Firebase.',
      'auth/too-many-requests':'Слишком много попыток входа. Подождите немного и повторите.'
    };
    if(isEmbeddedWebView && (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/web-storage-unsupported')){
      return 'Google блокирует вход во встроенном браузере. Откройте эту же ссылку в Google Chrome и повторите вход.';
    }
    return messages[code] || ('Google не смог выполнить вход: ' + (code || error?.message || 'неизвестная ошибка'));
  };
  const handleError = error => {
    clearIntent();
    restoreButtons();
    console.error('[WeatherPro/Auth] Google sign-in failed:', {
      code:error?.code || null,
      message:error?.message || String(error),
      email:error?.customData?.email || null,
      authDomain:firebaseConfig.authDomain,
      host:location.host
    });
    showNotification(explainError(error), true);
  };

  // Store the intended destination before opening the provider. It survives a redirect.
  try{localStorage.setItem(WP_AUTH_PROFILE_INTENT, String(Date.now()));}catch(_){ }

  // IMPORTANT: do not await setPersistence here. Popup APIs need the original click's
  // user activation; Firebase LOCAL persistence is configured once during app startup.
  let popupRequest;
  try{
    popupRequest = fbAuth.signInWithPopup(provider);
  }catch(error){
    handleError(error);
    return;
  }

  Promise.resolve(popupRequest).then(result => {
    if(!result?.user) throw new Error('Google не вернул авторизованного пользователя.');
    console.info('[WeatherPro/Auth] Google popup sign-in completed.', {
      uid:result.user.uid,
      email:result.user.email,
      provider:result.user.providerData?.map(item=>item.providerId)
    });
    wpGoogleCompleteSignIn(result.user, 'popup');
    restoreButtons();
  }).catch(error => {
    const fallbackCodes = [
      'auth/popup-blocked',
      'auth/operation-not-supported-in-this-environment'
    ];
    // Redirect is only a fallback. Popup is attempted first so Chrome/Android receives
    // the actual user gesture instead of a delayed call after setPersistence().
    if(fallbackCodes.includes(error?.code) && !isEmbeddedWebView && typeof fbAuth.signInWithRedirect === 'function'){
      console.warn('[WeatherPro/Auth] Popup unavailable; falling back to Google redirect:', error.code);
      showNotification('Окно Google недоступно. Переключаемся на безопасный вход…');
      fbAuth.signInWithRedirect(provider).catch(handleError);
      return;
    }
    handleError(error);
  });
}
window.loginWithGoogle = loginWithGoogle;


function wpAuthErrorMessage(error, action){
  const code=String(error?.code||'');
  const messages={
    'auth/email-already-in-use':'Эта почта уже зарегистрирована. Перейдите во вкладку «Вход» и войдите с этой почтой. Если аккаунт создавался через Google, используйте кнопку Google.',
    'auth/account-exists-with-different-credential':'Эта почта уже зарегистрирована через другой способ входа. Используйте тот способ, которым создавали аккаунт (Google или email/пароль).',
    'auth/credential-already-in-use':'Эти данные уже привязаны к другому аккаунту.',
    'auth/invalid-email':'Проверьте правильность адреса электронной почты.',
    'auth/weak-password':'Пароль слишком простой. Используйте не менее 6 символов.',
    'auth/operation-not-allowed':'В Firebase не включён вход по email/паролю. Откройте Firebase Console → Authentication → Sign-in method и включите Email/Password.',
    'auth/user-not-found':'Аккаунт с такой почтой не найден. Проверьте email или зарегистрируйтесь.',
    'auth/wrong-password':'Неверная почта или пароль. Проверьте данные и попробуйте снова.',
    'auth/invalid-credential':'Неверная почта или пароль. Проверьте данные и попробуйте снова.',
    'auth/too-many-requests':'Слишком много попыток. Подождите немного и попробуйте снова.',
    'auth/network-request-failed':'Не удалось связаться с Firebase. Проверьте интернет-соединение.',
    'auth/user-disabled':'Этот аккаунт отключён. Обратитесь к администратору проекта.',
    'auth/requires-recent-login':'Для этого действия войдите в аккаунт повторно.'
  };
  return messages[code] || ((action==='register'?'Не удалось создать аккаунт: ':'Не удалось войти: ')+(code||error?.message||'неизвестная ошибка'));
}

async function wpAuthPrepare(){
  if(!fbReady||!fbAuth) throw new Error('Firebase Auth не инициализирован. Проверьте конфигурацию и подключение SDK.');
  const localPersistence=firebase.auth.Auth?.Persistence?.LOCAL;
  if(localPersistence&&typeof fbAuth.setPersistence==='function') await fbAuth.setPersistence(localPersistence);
}

async function wpAuthActivateUser(user, successText){
  if(!user) throw new Error('Firebase не вернул пользователя после входа.');
  // Firebase Auth UID is the account identity; local guest cache is never treated as signed in.
  fbUser=user;
  fbAuthReady=true;
  wp6AdoptFirebaseIdentity(user);
  let cloudLoaded=true, cloudError=null;
  try{await loadFromCloud();}
  catch(error){
    cloudLoaded=false;cloudError=error;
    console.error('[WeatherPro/Auth] Вход выполнен, но облачный профиль недоступен:',error);
  }
  if(fbAuth.currentUser && fbAuth.currentUser.uid!==user.uid) return;
  fbUser=fbAuth.currentUser||user;
  // Reassert the authenticated identity even when Firestore is temporarily unavailable.
  wp6AdoptFirebaseIdentity(user);
  currentUser.email=user.email||currentUser.email||'';
  saveUser();
  updateUI();
  if(typeof wp81UpdateHubSummaries==='function') wp81UpdateHubSummaries();
  showPage('profile');
  if(typeof wp81UpdateHubSummaries==='function') wp81UpdateHubSummaries();
  if(cloudLoaded) showNotification(successText||'Вход выполнен. Ваш профиль загружен.');
  else showNotification('Вход выполнен, аккаунт активен. Не удалось загрузить облачные данные: '+(cloudError?.code||'проверьте Firestore Rules и соединение.'),true);
}

async function loginWithEmail(event){
  if(event?.preventDefault) event.preventDefault();
  const email=String($('wpLoginEmail')?.value||'').trim().toLowerCase();
  const password=String($('wpLoginPassword')?.value||'');
  const button=$('wpEmailLoginSubmit');
  if(!email||!/^\S+@\S+\.\S+$/.test(email)){showNotification('Введите корректный email.',true);$('wpLoginEmail')?.focus();return;}
  if(!password){showNotification('Введите пароль.',true);$('wpLoginPassword')?.focus();return;}
  if(button){button.disabled=true;button.dataset.originalText=button.innerHTML;button.innerHTML='<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Входим…';}
  try{
    await wpAuthPrepare();
    const credential=await fbAuth.signInWithEmailAndPassword(email,password);
    await wpAuthActivateUser(credential.user,'Вход выполнен. Загружен ваш аккаунт.');
    const form=$('wpEmailLoginForm');form?.reset();
  }catch(error){
    console.error('[WeatherPro/Auth] Email sign-in failed:',error);
    showNotification(wpAuthErrorMessage(error,'login'),true);
  }finally{
    if(button){button.disabled=false;button.innerHTML=button.dataset.originalText||'<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Войти по email';}
  }
}
window.loginWithEmail=loginWithEmail;

async function registerWithEmail(event){
  if(event?.preventDefault) event.preventDefault();
  const name=String($('wpRegisterName')?.value||'').trim().slice(0,48);
  const email=String($('wpRegisterEmail')?.value||'').trim().toLowerCase();
  const password=String($('wpRegisterPassword')?.value||'');
  const confirmPassword=String($('wpRegisterPasswordConfirm')?.value||'');
  const button=$('wpEmailRegisterSubmit');
  if(name.length<2){showNotification('Укажите имя (не менее 2 символов).',true);$('wpRegisterName')?.focus();return;}
  if(!email||!/^\S+@\S+\.\S+$/.test(email)){showNotification('Введите корректный email.',true);$('wpRegisterEmail')?.focus();return;}
  if(password.length<6){showNotification('Пароль должен содержать не менее 6 символов.',true);$('wpRegisterPassword')?.focus();return;}
  if(password!==confirmPassword){showNotification('Пароли не совпадают. Проверьте оба поля.',true);$('wpRegisterPasswordConfirm')?.focus();return;}
  if(button){button.disabled=true;button.dataset.originalText=button.innerHTML;button.innerHTML='<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Создаём аккаунт…';}
  try{
    await wpAuthPrepare();
    const credential=await fbAuth.createUserWithEmailAndPassword(email,password);
    const newUser=credential.user;
    try{await newUser.updateProfile({displayName:name});}catch(profileError){console.warn('[WeatherPro/Auth] Не удалось записать displayName в Auth; имя сохранится в профиле.',profileError);}
    // Immediately replace the guest identity with the newly created Firebase UID.
    fbUser=fbAuth.currentUser||newUser;
    wp6AdoptFirebaseIdentity(fbUser);
    currentUser.name=name;
    currentUser.email=fbUser.email||email;
    saveUser();
    updateUI();
    await wpAuthActivateUser(fbUser,'Аккаунт создан. Вы вошли в Weather Pro.');
    $('wpEmailRegisterForm')?.reset();
  }catch(error){
    console.error('[WeatherPro/Auth] Email registration failed:',error);
    showNotification(wpAuthErrorMessage(error,'register'),true);
    if(error?.code==='auth/email-already-in-use'||error?.code==='auth/account-exists-with-different-credential'){
      switchAuthForm('login');
      const loginEmail=$('wpLoginEmail');if(loginEmail)loginEmail.value=email;
    }
  }finally{
    if(button){button.disabled=false;button.innerHTML=button.dataset.originalText||'<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Создать аккаунт';}
  }
}
window.registerWithEmail=registerWithEmail;

async function resetEmailPassword(event){
  if(event?.preventDefault) event.preventDefault();
  const email=String($('wpLoginEmail')?.value||'').trim().toLowerCase();
  if(!email||!/^\S+@\S+\.\S+$/.test(email)){showNotification('Сначала укажите email в поле входа.',true);$('wpLoginEmail')?.focus();return;}
  try{
    await wpAuthPrepare();
    await fbAuth.sendPasswordResetEmail(email);
    showNotification('Письмо для сброса пароля отправлено, проверьте почту.');
  }catch(error){
    console.error('[WeatherPro/Auth] Password reset failed:',error);
    showNotification(wpAuthErrorMessage(error,'login'),true);
  }
}
window.resetEmailPassword=resetEmailPassword;

// Wait for Firebase's initial auth-state restoration before deciding that a user
// is a guest. This avoids false "please sign in" errors during a slow mobile start.
async function wp6WaitForAuth(timeoutMs = 8000){
  if(!fbReady || !fbAuth) return null;
  if(fbAuthReady) return fbUser || fbAuth.currentUser || null;

  return await new Promise(resolve => {
    let finished = false;
    let unsubscribe = null;
    let timer = null;
    const finish = user => {
      if(finished) return;
      finished = true;
      if(timer) clearTimeout(timer);
      try { if(typeof unsubscribe === 'function') unsubscribe(); } catch(_) {}
      const resolved = user || fbAuth.currentUser || fbUser || null;
      if(resolved) fbUser = resolved;
      resolve(resolved);
    };

    timer = setTimeout(() => finish(fbAuth.currentUser || fbUser || null), timeoutMs);
    try {
      unsubscribe = fbAuth.onAuthStateChanged(user => {
        fbAuthReady = true;
        fbUser = user || null;
        finish(user || null);
      }, error => {
        console.warn('[WeatherPro/Auth] Не удалось восстановить сессию:', error.code || error.message);
        finish(null);
      });
    } catch(error) {
      console.warn('[WeatherPro/Auth] Ошибка ожидания сессии:', error.code || error.message);
      finish(fbAuth.currentUser || null);
    }
  });
}

function wp16ProfileCacheKey(uid){return 'wp_profile_v16_'+String(uid||'guest').replace(/[^a-zA-Z0-9_-]/g,'_');}
function wp16ReadProfileCache(uid){
  try{const value=JSON.parse(localStorage.getItem(wp16ProfileCacheKey(uid))||'null');return value&&value.id===uid?value:null;}catch(_){return null;}
}
function wp16WriteProfileCache(profile){
  if(!profile||!profile.id||profile.id==='guest')return false;
  try{localStorage.setItem(wp16ProfileCacheKey(profile.id),JSON.stringify({...profile,_wp16SavedAt:Date.now()}));return true;}
  catch(error){console.warn('[WeatherPro/Profile] Локальный профиль не помещается в localStorage:',error);return false;}
}
function wp6AdoptFirebaseIdentity(user){
  if(!user) return;
  const same=currentUser&&currentUser.id===user.uid?currentUser:null;
  const cached=wp16ReadProfileCache(user.uid);
  let legacy=null;try{legacy=JSON.parse(localStorage.getItem(KEYS.USER)||'null');}catch(_){}
  const migrated=!same&&!cached&&legacy?.id===user.uid?legacy:null;
  const base=same||cached||migrated||{};
  currentUser={
    id:user.uid,
    name:(base.name&&base.name!=='Гость'?base.name:'')||user.displayName||(user.email?user.email.split('@')[0]:'Пользователь'),
    email:user.email||base.email||'',
    avatar:Object.prototype.hasOwnProperty.call(base,'avatar')?base.avatar:(user.photoURL||null),
    avatarIcon:base.avatarIcon||null,
    defaultCity:base.defaultCity||'Москва',
    registrationDate:base.registrationDate||new Date().toISOString(),
    bio:base.bio||'',
    _wp16ProfileDirty:!!(base._wp16ProfileDirty||migrated)
  };
  saveUser();
  if(document.readyState !== 'loading') updateUI();
  if(typeof wp81UpdateHubSummaries==='function' && document.readyState !== 'loading') wp81UpdateHubSummaries();
}


function normalizeSearchValue(value){
  return String(value || '').trim().toLocaleLowerCase('ru').normalize('NFKC');
}

async function syncToCloud(){
  if(!fbReady || !fbUser || !fbDb || !currentUser || currentUser.id !== fbUser.uid) {
    console.warn('[WeatherPro/Firestore] syncToCloud пропущен: нет активного совпадающего аккаунта.');
    return false;
  }
  if (fbSyncInProgress) {
    console.info('[WeatherPro/Firestore] Синхронизация уже выполняется; повторный вызов пропущен.');
    return false;
  }

  fbSyncInProgress = true;
  const uid = fbUser.uid;
  try{
    const displayName = String(currentUser.name || fbUser.displayName || '').trim();
    // Email для поиска берётся из Firebase Auth, а не из редактируемого поля формы.
    const email = String(fbUser.email || '').trim();
    const searchableName = normalizeSearchValue(displayName);
    const searchableEmail = normalizeSearchValue(email);
    const avatarBase64 = String(currentUser.avatar||'');
    if(avatarBase64 && !/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(avatarBase64)){
      throw new Error('Аватар должен быть изображением в формате Base64.');
    }
    if(avatarBase64.length>150000){
      throw new Error('Аватар слишком большой для Firestore. Сожмите изображение и попробуйте ещё раз.');
    }

    const userDoc = {
      profile: {
        displayName,
        email,
        avatar: currentUser.avatar || null,
        avatarIcon: currentUser.avatarIcon || null,
        bio: currentUser.bio || '',
        defaultCity: currentUser.defaultCity || 'Москва'
      },
      settings: settings || {},
      favorites: getFavs(),
      searchHistory: getHistoryList(),
      searchableName,
      searchableEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Приватный документ: настройки и история доступны только владельцу.
    await fbDb.collection('users').doc(uid).set(userDoc, { merge: true });
    console.info('[WeatherPro/Firestore] users/' + uid + ' записан.');

    // Отдельный документ с минимальным набором публичных полей для поиска.
    // Email публикуется намеренно, поскольку пользовательский сценарий включает поиск по email.
    await fbDb.collection('publicProfiles').doc(uid).set({
      uid,
      displayName,
      searchableName,
      email,
      searchableEmail,
      avatar: currentUser.avatar || null,
      avatarIcon: currentUser.avatarIcon || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.info('[WeatherPro/Firestore] publicProfiles/' + uid + ' записан.');
    if(currentUser?.id===uid){currentUser._wp16ProfileDirty=false;saveUser();}
    return true;
  } catch(e){
    console.error('[WeatherPro/Firestore] Ошибка записи users/publicProfiles:', {
      code: e.code || 'unknown', message: e.message || String(e), uid
    });
    showNotification('Ошибка сохранения Firebase: ' + (e.code || e.message), true);
    return false;
  } finally {
    fbSyncInProgress = false;
  }
}
window.syncToCloud = syncToCloud;

async function loadFromCloud(){
  if(!fbReady || !fbUser || !fbDb) return;
  const uid = fbUser.uid;
  try{
    const snap = await fbDb.collection('users').doc(uid).get();
    if (fbUser?.uid !== uid) return; // аккаунт успел смениться
    if(snap.exists){
      const d = snap.data() || {};
      const p = d.profile || {};
      currentUser.email = fbUser.email || '';
      if(!currentUser._wp16ProfileDirty){
        currentUser.name = p.displayName || currentUser.name || fbUser.displayName || 'Пользователь';
        // Custom Base64 avatar stays local when a prior sync failed; a successful sync
        // clears the dirty marker, allowing newer cloud profile data to hydrate later.
        if(p.avatar){currentUser.avatar=p.avatar;currentUser.avatarIcon=null;}
        else if(p.avatarIcon){currentUser.avatar=null;currentUser.avatarIcon=p.avatarIcon;}
        else if(!currentUser.avatar){currentUser.avatar=fbUser.photoURL||null;}
        if(!currentUser.avatarIcon&&p.avatarIcon)currentUser.avatarIcon=p.avatarIcon;
        currentUser.bio = p.bio || '';
        currentUser.defaultCity = p.defaultCity || 'Москва';
      }
      if (d.settings && typeof d.settings === 'object') Object.assign(settings, d.settings);
      if(Array.isArray(d.favorites)) localStorage.setItem(KEYS.FAV, JSON.stringify(d.favorites));
      if(Array.isArray(d.searchHistory)) localStorage.setItem(KEYS.SEARCH, JSON.stringify(d.searchHistory));
      if(d.createdAt && d.createdAt.toDate) currentUser.registrationDate = d.createdAt.toDate().toISOString();
    } else {
      console.info('[WeatherPro/Firestore] users/' + uid + ' отсутствует — создаём профиль.');
    }

    saveUser();
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    loadSettings(); // обновляет также элементы управления в разделе «Настройки»
    syncSmartAlertControls();
    updateUI();
    applyTheme();
    applyCompactMode(settings.compactMode);
    loadSearchHistory();
    renderFavorites();
    renderMultiCityHome();

    // Важно: публикуем publicProfiles и при существующем users-документе.
    // Это чинит аккаунты, у которых приватный документ есть, а публичного ещё нет.
    await syncToCloud();
  } catch(e){
    console.error('[WeatherPro/Firestore] Ошибка чтения users/' + uid + ':', {
      code: e.code || 'unknown', message: e.message || String(e)
    });
    throw e;
  }
}

async function searchUsers(){
  const box = $('peopleResults');
  const raw = ($('peopleSearchInput')?.value || '').trim();
  const q = normalizeSearchValue(raw.replace(/^@/, ''));

  if(!fbReady || !fbDb){
    box.innerHTML = '<div class="person-empty">Firebase не инициализирован. Проверьте конфигурацию и консоль браузера.</div>';
    console.error('[WeatherPro/Search] Firebase не готов.');
    return;
  }
  const authUser = await wp6WaitForAuth();
  if(!authUser){
    box.innerHTML = '<div class="person-empty">Firebase не видит активную сессию. Войдите по email или через Google в этом же браузере.</div>';
    console.warn('[WeatherPro/Search] Поиск вызван без подтверждённой Firebase-сессии.');
    return;
  }
  fbUser = authUser;
  wp6AdoptFirebaseIdentity(authUser);
  if(!q){
    box.innerHTML = '<div class="person-empty">Введите начало имени или email.</div>';
    return;
  }

  box.innerHTML = '<div class="person-empty">Ищем…</div>';
  try{
    const col = fbDb.collection('publicProfiles');
    const fields = ['searchableName', 'searchableEmail'];
    const snapshots = await Promise.all(fields.map(field =>
      col.orderBy(field).startAt(q).endAt(q + '\uf8ff').limit(30).get()
    ));

    const matches = new Map();
    snapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
      if(doc.id === fbUser.uid) return;
      const data = doc.data() || {};
      const name = String(data.displayName || '').trim();
      const email = String(data.email || '').trim();
      if(!name && !email) return;
      matches.set(doc.id, {
        displayName: name || 'Без имени',
        email,
        avatar: data.avatar || null,
        avatarIcon: data.avatarIcon || null
      });
    }));

    if(!matches.size){
      box.innerHTML = '<div class="person-empty">Никого не найдено. Поиск выполняется по началу имени или email; у других пользователей должен быть опубликован документ publicProfiles.</div>';
      console.info('[WeatherPro/Search] Совпадений нет для префикса:', q);
      return;
    }

    const [friendSnap,outSnap,inSnap] = await Promise.all([
      fbDb.collection('friendships').where('members','array-contains',fbUser.uid).get(),
      fbDb.collection('friendRequests').where('from','==',fbUser.uid).get(),
      fbDb.collection('friendRequests').where('to','==',fbUser.uid).get()
    ]);
    if(!fbUser)return;
    const friendIds=new Set();
    friendSnap.docs.forEach(d=>(d.data().members||[]).forEach(id=>{if(id!==fbUser.uid)friendIds.add(id);}));
    const outgoing=new Map();
    outSnap.docs.forEach(d=>{const v=d.data();if(!outgoing.has(v.to)||v.status==='pending')outgoing.set(v.to,v);});
    const incoming=new Map();
    inSnap.docs.forEach(d=>{const v=d.data();if(!incoming.has(v.from)||v.status==='pending')incoming.set(v.from,v);});
    box.innerHTML = '';
    matches.forEach((p, uid) => {
      const card = document.createElement('div');
      card.className = 'person-card';
      const initial = (p.displayName || '?').trim().charAt(0).toUpperCase();
      const photoMarkup=avatarImageMarkup(p.avatar,p.displayName || 'Аватар пользователя');
      const avatarHTML = photoMarkup
        ? `<div class="person-avatar">${photoMarkup}</div>`
        : p.avatarIcon
          ? `<div class="person-avatar">${svg(p.avatarIcon)}</div>`
          : `<div class="person-avatar">${esc(initial)}</div>`;
      let actionText='Добавить в друзья', action='add', disabled=false;
      if(friendIds.has(uid)){actionText='Уже в друзьях';disabled=true;}
      else if(outgoing.get(uid)?.status==='pending'){actionText='Заявка отправлена';disabled=true;}
      else if(incoming.get(uid)?.status==='pending'){actionText='Принять заявку';action='accept';}
      else if(['declined','accepted'].includes(outgoing.get(uid)?.status)){actionText='Отправить снова';}
      card.innerHTML = `${avatarHTML}
        <div class="person-name">${esc(p.displayName)}${window.wp17FounderBadgeMarkup(p.email)}</div>
        <div class="person-email">${esc(p.email)}</div>
        <div class="social-actions" style="margin-top:10px"><button type="button" ${disabled?'disabled':''}>${actionText}</button></div>`;
      card.querySelector('button').addEventListener('click',()=>{
        if(action==='accept')respondFriendRequest(requestIdFor(uid,fbUser.uid),true);
        else if(action==='add')sendFriendRequest(uid,p.displayName);
        else if(actionText==='Отправить снова')sendFriendRequest(uid,p.displayName);
      });
      box.appendChild(card);
    });
    console.info('[WeatherPro/Search] Найдено профилей:', matches.size);
  } catch(e){
    console.error('[WeatherPro/Search] Ошибка поиска:', {
      code: e.code || 'unknown', message: e.message || String(e)
    });
    const code = String(e.code || 'unknown');
    let hint = 'Проверьте Firestore Rules для publicProfiles и наличие searchableName/searchableEmail в документах.';
    if (code === 'permission-denied') hint = 'Доступ запрещён правилами Firestore. Разрешите чтение publicProfiles только авторизованным пользователям.';
    if (code === 'failed-precondition') hint = 'Firestore сообщил о недостающем индексе. Откройте ссылку из ошибки в консоли и создайте индекс.';
    if (code === 'unavailable') hint = 'Firestore временно недоступен. Проверьте сеть и статус Firebase.';
    box.innerHTML = `<div class="person-empty">Ошибка поиска (${esc(code)}): ${esc(e.message || String(e))}<br><br>${esc(hint)}</div>`;
  }
}
window.searchUsers = searchUsers;

