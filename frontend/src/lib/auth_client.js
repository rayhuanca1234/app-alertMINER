/**
 * auth_client.js
 * Módulo 4: Cliente de Autenticación Frontend (100% Cloudflare + Google OAuth 2.0 Directo)
 * CERO dependencias de Supabase.
 *
 * Incluye:
 * - Captura automática del token OAuth (?token=...) al cargar la página
 * - Almacenamiento en localStorage ('facereels_cf_token') y limpieza de barra de direcciones
 * - Notificación de estado de sesión: onAuthStateChange(callback)
 * - signInWithGoogle() -> Redirige a ${BACKEND_URL}/api/auth/google/login
 * - signOut() -> Elimina facereels_cf_token y notifica SIGNED_OUT
 * - getSession() -> Lee facereels_cf_token y obtiene perfil desde /api/user/profile
 * - fetchWithAuth(endpoint, options) -> Inyecta Authorization: Bearer ${token} y maneja 401
 * - saveSessionToChrome(session) y restoreSessionFromChrome() -> Sincroniza con chrome.storage.local
 */

const TOKEN_STORAGE_KEY = 'facereels_cf_token';
const PROFILE_CACHE_KEY = 'facereels_cf_profile';

export function getBackendUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) {
    return String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.BACKEND_URL) {
    return String(window.BACKEND_URL).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    // En desarrollo local con Vite (puerto 5173 o 4173), apuntar al backend en 3001
    if (port === '5173' || port === '4173') {
      return `${protocol}//${hostname}:3001`;
    }
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

export const BACKEND_URL = getBackendUrl();

const authListeners = new Set();

export function onAuthStateChange(callback) {
  if (typeof callback === 'function') {
    authListeners.add(callback);
  }
  return {
    data: {
      subscription: {
        unsubscribe: () => authListeners.delete(callback)
      }
    }
  };
}

function notifyAuthState(event, session) {
  for (const listener of authListeners) {
    try {
      listener(event, session);
    } catch (e) {
      console.error('[auth_client] Error in auth listener:', e);
    }
  }
}

/**
 * Decodifica el payload base64url del token firmado URLSafeSerializer (<payload_b64>.<sig>)
 */
export function decodeTokenPayload(token) {
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

/**
 * Sincroniza facereels_cf_token con chrome.storage.local si se ejecuta en una Extensión de Chrome
 */
export function saveSessionToChrome(session) {
  try {
    const token = typeof session === 'string' ? session : session?.access_token || localStorage.getItem(TOKEN_STORAGE_KEY);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && token) {
      chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token });
    }
  } catch (e) {
    console.warn('[auth_client] saveSessionToChrome warning:', e);
  }
}

export async function restoreSessionFromChrome() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return await new Promise(resolve => {
        chrome.storage.local.get([TOKEN_STORAGE_KEY], result => {
          const token = result?.[TOKEN_STORAGE_KEY] || null;
          if (token) {
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
          }
          resolve(token);
        });
      });
    }
  } catch (e) {
    console.warn('[auth_client] restoreSessionFromChrome warning:', e);
  }
  return null;
}

/**
 * Captura Automática del Token OAuth al Cargar la Página (?token=...)
 */
export function captureTokenFromUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      saveSessionToChrome(token);

      // Limpiar ?token=... de la barra de direcciones con window.history.replaceState
      params.delete('token');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);

      const decoded = decodeTokenPayload(token);
      const userObj = decoded
        ? {
            id: decoded.user_id,
            user_id: decoded.user_id,
            email: decoded.email,
            name: decoded.name,
            full_name: decoded.name,
            avatar_url: decoded.picture
          }
        : null;

      const session = { access_token: token, user: userObj };
      setTimeout(() => notifyAuthState('SIGNED_IN', session), 0);
      return token;
    }
  } catch (e) {
    console.error('[auth_client] Error capturing token from URL:', e);
  }
  return null;
}

/**
 * Redirige a ${BACKEND_URL}/api/auth/google/login
 */
export function signInWithGoogle() {
  if (typeof window === 'undefined') return;
  window.location.href = `${getBackendUrl()}/api/auth/google/login`;
}

/**
 * Elimina facereels_cf_token de localStorage y actualiza la UI a desconectado
 */
export async function signOut() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(PROFILE_CACHE_KEY);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove([TOKEN_STORAGE_KEY]);
      }
    } catch {}
  }
  notifyAuthState('SIGNED_OUT', null);
}

/**
 * Wrapper sobre fetch que inyecta automáticamente Authorization: Bearer ${token} en los headers.
 * Si no hay sesión o devuelve 401, redirige a signInWithGoogle() (cuando redirectOn401 !== false).
 */
export async function fetchWithAuth(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${getBackendUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401 && options.redirectOn401 !== false) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    notifyAuthState('SIGNED_OUT', null);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      signInWithGoogle();
    }
  }

  return response;
}

/**
 * Lee facereels_cf_token de localStorage y obtiene el perfil desde /api/user/profile (o caché local)
 */
export async function getSession() {
  if (typeof window === 'undefined') return null;

  captureTokenFromUrl();
  let token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    token = await restoreSessionFromChrome();
  }
  if (!token) return null;

  const decoded = decodeTokenPayload(token);
  let user = decoded
    ? {
        id: decoded.user_id,
        user_id: decoded.user_id,
        email: decoded.email,
        name: decoded.name,
        full_name: decoded.name,
        avatar_url: decoded.picture
      }
    : null;

  try {
    const res = await fetchWithAuth('/api/user/profile', { redirectOn401: false });
    if (res.ok) {
      const profile = await res.json();
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      user = {
        ...user,
        ...profile,
        id: profile.id || profile.user_id || user?.id
      };
    } else if (res.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
  } catch {
    // Fallback a caché local si se trabaja sin conexión temporalmente
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        user = { ...user, ...parsed };
      } catch {}
    }
  }

  if (!user) return null;

  return {
    access_token: token,
    user
  };
}

/**
 * Login/Registro con email y contraseña directo contra Cloudflare D1
 */
export async function signInWithEmail(email, password) {
  const res = await fetch(`${getBackendUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error iniciando sesión');
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
  saveSessionToChrome(data.token);
  const session = { access_token: data.token, user: data.user };
  notifyAuthState('SIGNED_IN', session);
  return session;
}

export async function registerWithEmail({ name, email, password, phone }) {
  const res = await fetch(`${getBackendUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error registrando cuenta');
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
  saveSessionToChrome(data.token);
  const session = { access_token: data.token, user: data.user };
  notifyAuthState('SIGNED_IN', session);
  return session;
}

// Exponer funciones globalmente en window.* tal como exige la especificación
if (typeof window !== 'undefined') {
  captureTokenFromUrl();
  window.signInWithGoogle = signInWithGoogle;
  window.signOut = signOut;
  window.getSession = getSession;
  window.fetchWithAuth = fetchWithAuth;
  window.saveSessionToChrome = saveSessionToChrome;
  window.restoreSessionFromChrome = restoreSessionFromChrome;
  window.onAuthStateChange = onAuthStateChange;
}
