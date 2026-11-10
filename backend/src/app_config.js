/**
 * app_config.js
 * Módulo 1: Variables de Entorno (.env) y Auto-Detección de Entorno
 * Detecta automáticamente Producción (K_SERVICE, GAE_INSTANCE, NODE_ENV / FLASK_ENV == 'production')
 * vs Local, y construye dinámicamente SERVER_URL, FRONTEND_URL y GOOGLE_REDIRECT_URI.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const ENV_FILE_PATH = path.resolve(__dirname, '../.env');

function reloadEnv() {
  if (fs.existsSync(ENV_FILE_PATH)) {
    dotenv.config({ path: ENV_FILE_PATH, override: true, quiet: true });
  } else {
    dotenv.config({ override: true, quiet: true });
  }
}

reloadEnv();

function isProductionEnv() {
  return Boolean(
    process.env.K_SERVICE ||
    process.env.GAE_INSTANCE ||
    process.env.FLASK_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  );
}

function getAppConfig(requestHost = null, requestProto = null) {
  reloadEnv();

  const isProd = isProductionEnv();
  const port = process.env.PORT || 3001;

  // Construcción dinámica de SERVER_URL
  let serverUrl = process.env.SERVER_URL;
  if (!serverUrl) {
    if (requestHost) {
      const proto = requestProto || (isProd ? 'https' : 'http');
      serverUrl = `${proto}://${requestHost}`;
    } else if (isProd && process.env.PUBLIC_URL) {
      serverUrl = process.env.PUBLIC_URL.replace(/\/$/, '');
    } else {
      serverUrl = `http://localhost:${port}`;
    }
  } else {
    serverUrl = serverUrl.replace(/\/$/, '');
  }

  // Construcción dinámica de FRONTEND_URL
  let frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl || frontendUrl.includes('tu-frontend.run.app')) {
    if (isProd) {
      frontendUrl = serverUrl;
    } else {
      // En desarrollo local Vite corre en 5173 por defecto, o el mismo serverUrl si sirve estáticos
      frontendUrl = process.env.VITE_DEV_URL || 'http://localhost:5173';
    }
  } else {
    frontendUrl = frontendUrl.replace(/\/$/, '');
  }

  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${serverUrl}/api/auth/google/callback`;

  // Listas blancas VIP (Acceso Pro / Admin Ilimitado Automático)
  const allowedEmails = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  const allowedVipKeys = (process.env.ALLOWED_VIP_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  return {
    IS_PRODUCTION: isProd,
    PORT: port,
    SERVER_URL: serverUrl,
    FRONTEND_URL: frontendUrl,
    GOOGLE_REDIRECT_URI: googleRedirectUri,

    // Seguridad JWT y VIP
    JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || 'tu-secreto-jwt-ultra-seguro-2026',
    ALLOWED_EMAILS: allowedEmails,
    ALLOWED_VIP_KEYS: allowedVipKeys,
    AUTH_CLOSED_MODE: process.env.AUTH_CLOSED_MODE === 'true',

    // Google OAuth 2.0 Directo
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

    // Cloudflare D1
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
    D1_DATABASE_ID: process.env.D1_DATABASE_ID || '',

    // Cloudflare R2
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'mi-app-media',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
    R2_PUBLIC_DOMAIN: (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, ''),

    // Stripe
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    STRIPE_PRICE_ID_CREATOR_MONTHLY: process.env.STRIPE_PRICE_ID_CREATOR_MONTHLY || '',
    STRIPE_PRICE_ID_PRO_MONTHLY: process.env.STRIPE_PRICE_ID_PRO_MONTHLY || '',

    // Rutas de archivos
    ENV_FILE_PATH
  };
}

/**
 * Equivalente a dotenv.set_key en Python:
 * Guarda o actualiza una clave en el archivo .env y recarga process.env en memoria al instante.
 */
function setEnvKey(key, value) {
  const sanitizedKey = String(key).trim();
  const sanitizedVal = String(value ?? '').replace(/\r?\n/g, '');
  let content = '';
  if (fs.existsSync(ENV_FILE_PATH)) {
    content = fs.readFileSync(ENV_FILE_PATH, 'utf8');
  }
  const regex = new RegExp(`^${sanitizedKey}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${sanitizedKey}=${sanitizedVal}`);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    content += `${sanitizedKey}=${sanitizedVal}\n`;
  }
  fs.writeFileSync(ENV_FILE_PATH, content, 'utf8');
  process.env[sanitizedKey] = sanitizedVal;
  reloadEnv();
  return true;
}

module.exports = {
  getAppConfig,
  reloadEnv,
  setEnvKey,
  isProductionEnv,
  ENV_FILE_PATH
};
