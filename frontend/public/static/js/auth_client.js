/**
 * static/js/auth_client.js
 * Módulo 4: Cliente de Autenticación Frontend (100% Cloudflare + Google OAuth 2.0 Directo)
 * CERO dependencias de Supabase.
 *
 * Incluye:
 * - Captura automática del token OAuth (?token=...) al cargar la página
 * - Almacenamiento en localStorage.setItem('facereels_cf_token', token) y limpieza de URL con window.history.replaceState
 * - Funciones exportadas y globales (window.*):
 *   signInWithGoogle(), signOut(), getSession(), fetchWithAuth(endpoint, options),
 *   saveSessionToChrome(session) y restoreSessionFromChrome()
 */
(function (global) {
  const TOKEN_STORAGE_KEY = 'facereels_cf_token';
  const PROFILE_CACHE_KEY = 'facereels_cf_profile';
  const authListeners = new Set();

  function getBackendUrl() {
    if (global.BACKEND_URL) return String(global.BACKEND_URL).replace(/\/$/, '');
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      if (port === '5173' || port === '4173') {
        return `${protocol}//${hostname}:3001`;
      }
      return window.location.origin;
    }
    return 'http://localhost:3001';
  }

  function onAuthStateChange(callback) {
    if (typeof callback === 'function') authListeners.add(callback);
    return {
      unsubscribe: () => authListeners.delete(callback)
    };
  }

  function notifyAuthState(event, session) {
    authListeners.forEach(cb => {
      try { cb(event, session); } catch (e) { console.error(e); }
    });
  }

  function decodeTokenPayload(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    try {
      const payloadB64 = token.split('.')[0];
      const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const jsonStr = decodeURIComponent(
        Array.prototype.map
          .call(window.atob(padded), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  function saveSessionToChrome(session) {
    try {
      const token = typeof session === 'string' ? session : session?.access_token || localStorage.getItem(TOKEN_STORAGE_KEY);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && token) {
        chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token });
      }
    } catch (e) {}
  }

  async function restoreSessionFromChrome() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return await new Promise(resolve => {
          chrome.storage.local.get([TOKEN_STORAGE_KEY], result => {
            const token = result?.[TOKEN_STORAGE_KEY] || null;
            if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
            resolve(token);
          });
        });
      }
    } catch (e) {}
    return null;
  }

  function captureTokenOnLoad() {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        saveSessionToChrome(token);
        params.delete('token');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);

        const decoded = decodeTokenPayload(token);
        const session = {
          access_token: token,
          user: decoded
            ? { id: decoded.user_id, email: decoded.email, name: decoded.name, avatar_url: decoded.picture }
            : null
        };
        notifyAuthState('SIGNED_IN', session);
        return session;
      }
    } catch (e) {
      console.error('[auth_client] Error capturing OAuth token:', e);
    }
    return null;
  }

  function signInWithGoogle() {
    window.location.href = `${getBackendUrl()}/api/auth/google/login`;
  }

  async function signOut() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(PROFILE_CACHE_KEY);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove([TOKEN_STORAGE_KEY]);
      }
    } catch (e) {}
    notifyAuthState('SIGNED_OUT', null);
  }

  async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${getBackendUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = Object.assign(
      {},
      options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
      options.headers || {}
    );
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, Object.assign({}, options, { headers }));
    if (res.status === 401 && options.redirectOn401 !== false) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      notifyAuthState('SIGNED_OUT', null);
      signInWithGoogle();
    }
    return res;
  }

  async function getSession() {
    captureTokenOnLoad();
    let token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) token = await restoreSessionFromChrome();
    if (!token) return null;

    const decoded = decodeTokenPayload(token);
    let user = decoded
      ? { id: decoded.user_id, email: decoded.email, name: decoded.name, avatar_url: decoded.picture }
      : null;

    try {
      const res = await fetchWithAuth('/api/user/profile', { redirectOn401: false });
      if (res.ok) {
        const profile = await res.json();
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
        user = Object.assign({}, user, profile);
      }
    } catch (e) {}

    return { access_token: token, user };
  }

  // Inicializar al cargar
  if (typeof window !== 'undefined') {
    captureTokenOnLoad();
    global.signInWithGoogle = signInWithGoogle;
    global.signOut = signOut;
    global.getSession = getSession;
    global.fetchWithAuth = fetchWithAuth;
    global.saveSessionToChrome = saveSessionToChrome;
    global.restoreSessionFromChrome = restoreSessionFromChrome;
    global.onAuthStateChange = onAuthStateChange;
  }
})(typeof window !== 'undefined' ? window : globalThis);
