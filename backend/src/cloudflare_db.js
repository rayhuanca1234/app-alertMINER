/**
 * cloudflare_db.js
 * Módulo 2: Motor de Base de Datos Serverless en Cloudflare D1 + Fallback Automático a SQLite Local.
 * Incluye:
 * - execute_d1_query(sql, params) con 3 reintentos automáticos y timeout=10s
 * - d1_rows(res) helper
 * - init_d1_tables() que auto-crea el esquema en D1 (y SQLite local)
 * - CRUD completo de API Keys (prefijo fr_...) y actualización de uso en background
 * - CRUD de proyectos, cuentas compartidas (social_account_shares) y tablas de MinerAlert
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getAppConfig } = require('./app_config');

// Inicializar SQLite local de respaldo (Node 22 built-in node:sqlite)
let localDb = null;
const LOCAL_DB_PATH = path.resolve(__dirname, '../data/local_d1_fallback.sqlite');

function getLocalSqlite() {
  if (localDb) return localDb;
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    localDb = new DatabaseSync(LOCAL_DB_PATH);
    localDb.exec('PRAGMA journal_mode = WAL;');
    return localDb;
  } catch (err) {
    console.warn('[cloudflare_db] node:sqlite fallback warning:', err.message);
    return null;
  }
}

function isD1Configured() {
  const cfg = getAppConfig();
  return Boolean(
    cfg.CLOUDFLARE_ACCOUNT_ID &&
    cfg.CLOUDFLARE_API_TOKEN &&
    cfg.D1_DATABASE_ID &&
    !cfg.CLOUDFLARE_ACCOUNT_ID.startsWith('tu_') &&
    !cfg.CLOUDFLARE_API_TOKEN.startsWith('tu_') &&
    !cfg.D1_DATABASE_ID.startsWith('tu_')
  );
}

/**
 * Helper d1_rows(res): extrae limpiamente res["result"][0]["results"]
 */
function d1_rows(res) {
  try {
    if (res && Array.isArray(res.result) && res.result[0] && Array.isArray(res.result[0].results)) {
      return res.result[0].results;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Ejecuta en SQLite local y devuelve el mismo formato estructural que la API de Cloudflare D1
 */
function executeLocalSqlite(sql, params = []) {
  const db = getLocalSqlite();
  if (!db) {
    return { success: false, errors: [{ message: 'Local SQLite not available' }], result: [{ results: [] }] };
  }
  try {
    const trimmed = sql.trim();
    const isSelect = /^(SELECT|PRAGMA|WITH)/i.test(trimmed);
    const stmt = db.prepare(trimmed);
    const cleanParams = (params || []).map(p => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

    if (isSelect) {
      const rows = stmt.all(...cleanParams).map(r => ({ ...r }));
      return {
        success: true,
        backend: 'sqlite_local',
        result: [{ results: rows, success: true, meta: { changes: 0 } }]
      };
    } else {
      const info = stmt.run(...cleanParams);
      return {
        success: true,
        backend: 'sqlite_local',
        result: [{
          results: [],
          success: true,
          meta: {
            changes: info.changes || 0,
            last_row_id: Number(info.lastInsertRowid || 0)
          }
        }]
      };
    }
  } catch (err) {
    return {
      success: false,
      backend: 'sqlite_local',
      errors: [{ message: err.message }],
      result: [{ results: [] }]
    };
  }
}

/**
 * Ejecutor SQL en Cloudflare D1 con hasta 3 reintentos automáticos y timeout=10s.
 * Si D1 no tiene credenciales configuradas o está sin conexión en desarrollo, usa SQLite local automáticamente.
 */
async function execute_d1_query(sql, params = null) {
  const safeParams = Array.isArray(params) ? params : [];

  if (!isD1Configured()) {
    return executeLocalSqlite(sql, safeParams);
  }

  const cfg = getAppConfig();
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${cfg.CLOUDFLARE_ACCOUNT_ID}/d1/database/${cfg.D1_DATABASE_ID}/query`;
  const headers = {
    'Authorization': `Bearer ${cfg.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json'
  };
  const payload = JSON.stringify({
    sql,
    params: safeParams
  });

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000); // timeout=10s
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await response.json();
      if (response.ok && data && data.success) {
        // Sincronizar en espejo local para baja latencia / offline si es escritura
        if (!/^(SELECT|PRAGMA)/i.test(sql.trim())) {
          try { executeLocalSqlite(sql, safeParams); } catch {}
        }
        return data;
      }

      lastError = new Error(data?.errors?.[0]?.message || `D1 HTTP ${response.status}`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
    }

    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }

  console.warn(`[cloudflare_db] D1 query failed after 3 retries (${lastError?.message}). Using local SQLite fallback.`);
  return executeLocalSqlite(sql, safeParams);
}

/**
 * Inicialización Automática de Esquema en Cloudflare D1 (init_d1_tables)
 */
async function init_d1_tables() {
  const statements = [
    // 1. Usuarios registrados vía Google OAuth
    `CREATE TABLE IF NOT EXISTS system_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE,
      email TEXT UNIQUE,
      full_name TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      password_hash TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_seen INTEGER DEFAULT (strftime('%s', 'now'))
    )`,

    // 2. Perfiles de usuario y metadatos
    `CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT,
      full_name TEXT,
      name TEXT,
      phone TEXT,
      bio TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      following_count INTEGER DEFAULT 0,
      followers_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT
    )`,

    // 3. API Keys generadas por los usuarios (prefijo fr_)
    `CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      secret_key TEXT UNIQUE,
      created_at TEXT,
      usage_count INTEGER DEFAULT 0,
      last_used TEXT,
      expires_at TEXT
    )`,

    // 4. Proyectos / Recursos guardados por el usuario en R2
    `CREATE TABLE IF NOT EXISTS proyectos (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      filename TEXT,
      video_url TEXT,
      gcs_path TEXT,
      storage_backend TEXT DEFAULT 'cloudflare',
      status TEXT DEFAULT 'completed',
      file_size_bytes INTEGER DEFAULT 0,
      settings TEXT,
      metadata TEXT,
      created_at TEXT,
      deleted_at TEXT
    )`,

    // 5. Suscripciones y Cuotas Mensuales (Módulo 6)
    `CREATE TABLE IF NOT EXISTS user_subscriptions (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      plan TEXT DEFAULT 'free',
      status TEXT DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      videos_used INTEGER DEFAULT 0,
      videos_limit INTEGER DEFAULT 10,
      allow_async_parallel INTEGER DEFAULT 0,
      current_period_end TEXT,
      updated_at TEXT
    )`,

    // Registro idempotente de consumo por project_signature
    `CREATE TABLE IF NOT EXISTS subscription_consumptions (
      project_signature TEXT PRIMARY KEY,
      user_id TEXT,
      consumed_at TEXT
    )`,

    // 6. Delegación de Herramientas / Cuentas Compartidas (Módulo 7)
    `CREATE TABLE IF NOT EXISTS social_account_shares (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      owner_email TEXT,
      shared_with_email TEXT,
      shared_with_user_id TEXT,
      platform TEXT DEFAULT 'all',
      account_name TEXT,
      permissions TEXT DEFAULT 'use',
      created_at TEXT
    )`,

    // 7. Tablas operativas de la aplicación MinerAlert (Alertas, Canales, Chat, Notificaciones, Push)
    `CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      location TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      expires_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      expiration_hours INTEGER,
      created_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      channel_id TEXT,
      type TEXT DEFAULT 'TEXT',
      content TEXT,
      media_url TEXT,
      media_urls TEXT,
      file_metadata TEXT,
      reply_to TEXT,
      views INTEGER DEFAULT 0,
      created_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      user_id TEXT,
      emoji TEXT,
      created_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      sender_id TEXT,
      title TEXT,
      message TEXT,
      body TEXT,
      type TEXT,
      related_id TEXT,
      is_read INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      endpoint TEXT UNIQUE,
      p256dh TEXT,
      auth TEXT,
      created_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS media_views (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      media_index INTEGER DEFAULT 0,
      user_id TEXT,
      views_count INTEGER DEFAULT 1,
      created_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS media_likes (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      media_index INTEGER DEFAULT 0,
      user_id TEXT,
      created_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS media_comments (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      media_index INTEGER DEFAULT 0,
      user_id TEXT,
      content TEXT,
      created_at TEXT
    )`
  ];

  // Asegurar siempre primero en SQLite local y luego en D1 si está configurado
  for (const sql of statements) {
    executeLocalSqlite(sql, []);
    if (isD1Configured()) {
      await execute_d1_query(sql, []);
    }
  }

  // Semilla de canales por defecto
  const defaultChannels = [
    ['00000000-0000-0000-0000-000000000001', 'General', 'Canal principal de comunicación comunitaria'],
    ['00000000-0000-0000-0000-000000000002', 'Alertas', 'Canal automático de alertas de seguridad'],
    ['00000000-0000-0000-0000-000000000003', 'Coordinación', 'Canal de coordinación y logística']
  ];
  for (const [id, name, desc] of defaultChannels) {
    const seedSql = `INSERT OR IGNORE INTO channels (id, name, description, created_at) VALUES (?, ?, ?, ?)`;
    const nowIso = new Date().toISOString();
    executeLocalSqlite(seedSql, [id, name, desc, nowIso]);
    if (isD1Configured()) {
      await execute_d1_query(seedSql, [id, name, desc, nowIso]);
    }
  }
}

// ============================================================================
// CRUD Completo de API Keys en Cloudflare D1 (prefijo fr_)
// ============================================================================

function computeExpirationIso(expiresOption) {
  if (!expiresOption || expiresOption === 'Never' || expiresOption === 'never') {
    return null;
  }
  const now = new Date();
  if (expiresOption === '1d') {
    return new Date(now.getTime() + 1 * 86400 * 1000).toISOString();
  }
  if (expiresOption === '7d') {
    return new Date(now.getTime() + 7 * 86400 * 1000).toISOString();
  }
  if (expiresOption === '30d') {
    return new Date(now.getTime() + 30 * 86400 * 1000).toISOString();
  }
  // Si ya es una fecha ISO válida
  const parsed = Date.parse(expiresOption);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return null;
}

/**
 * guardar_api_key(user_id, api_key, name="My API Key", expires_at=None)
 * Crea una llave con formato "fr_" + secrets.token_hex(16) y expiración opcional (1d, 7d, 30d, Never).
 */
async function guardar_api_key(user_id, api_key = null, name = 'My API Key', expires_at = null) {
  const id = crypto.randomUUID();
  const secret_key = api_key && String(api_key).startsWith('fr_')
    ? String(api_key)
    : `fr_${crypto.randomBytes(16).toString('hex')}`;
  const created_at = new Date().toISOString();
  const expIso = computeExpirationIso(expires_at);

  const sql = `
    INSERT INTO api_keys (id, user_id, name, secret_key, created_at, usage_count, last_used, expires_at)
    VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
  `;
  await execute_d1_query(sql, [id, user_id, name || 'My API Key', secret_key, created_at, expIso]);

  return {
    id,
    user_id,
    name: name || 'My API Key',
    secret_key,
    created_at,
    usage_count: 0,
    last_used: null,
    expires_at: expIso
  };
}

/**
 * obtener_api_keys(user_id)
 * Retorna todas las llaves del usuario ordenadas por created_at DESC.
 */
async function obtener_api_keys(user_id) {
  const sql = `SELECT id, user_id, name, secret_key, created_at, usage_count, last_used, expires_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`;
  const res = await execute_d1_query(sql, [user_id]);
  return d1_rows(res);
}

/**
 * eliminar_api_key(key_id, user_id)
 * Elimina la llave en D1 (DELETE FROM api_keys WHERE id = ? AND user_id = ?).
 */
async function eliminar_api_key(key_id, user_id) {
  const sql = `DELETE FROM api_keys WHERE id = ? AND user_id = ?`;
  const res = await execute_d1_query(sql, [key_id, user_id]);
  return res?.success || false;
}

/**
 * verificar_api_key(token)
 * Consulta SELECT id, user_id, expires_at FROM api_keys WHERE secret_key = ?.
 * Si tiene expires_at, verifica que no haya expirado respecto a UTC actual.
 */
async function verificar_api_key(token) {
  if (!token || !String(token).startsWith('fr_')) return null;

  // Verificar si está en ALLOWED_VIP_KEYS de .env directamente
  const cfg = getAppConfig();
  if (cfg.ALLOWED_VIP_KEYS.includes(token)) {
    return {
      id: 'vip_master_key',
      user_id: 'vip_admin',
      expires_at: null,
      is_vip_env: true
    };
  }

  const sql = `SELECT id, user_id, name, secret_key, expires_at, usage_count FROM api_keys WHERE secret_key = ? LIMIT 1`;
  const res = await execute_d1_query(sql, [token]);
  const rows = d1_rows(res);
  if (!rows || rows.length === 0) return null;

  const keyRow = rows[0];
  if (keyRow.expires_at) {
    const expTime = new Date(keyRow.expires_at).getTime();
    const nowUtc = Date.now();
    if (!isNaN(expTime) && nowUtc > expTime) {
      return null; // Expirada
    }
  }
  return keyRow;
}

/**
 * actualizar_uso_api_key(key_id)
 * Incrementa usage_count = usage_count + 1 y actualiza last_used en segundo plano (no bloquea la petición).
 */
function actualizar_uso_api_key(key_id) {
  if (!key_id || key_id === 'vip_master_key') return;
  setImmediate(async () => {
    try {
      const nowIso = new Date().toISOString();
      const sql = `UPDATE api_keys SET usage_count = COALESCE(usage_count, 0) + 1, last_used = ? WHERE id = ?`;
      await execute_d1_query(sql, [nowIso, key_id]);
    } catch (err) {
      console.warn('[cloudflare_db] Error actualizando uso de API key en background:', err.message);
    }
  });
}

/**
 * Resuelve el correo real del propietario buscando user_id en system_users / profiles de Cloudflare D1.
 */
async function resolve_email_from_api_key(user_id) {
  if (!user_id) return null;
  if (user_id === 'vip_admin') {
    const cfg = getAppConfig();
    return cfg.ALLOWED_EMAILS[0] || 'vip@mineralert.com';
  }

  const resSys = await execute_d1_query(
    `SELECT email, full_name, avatar_url, role FROM system_users WHERE user_id = ? LIMIT 1`,
    [user_id]
  );
  const rowsSys = d1_rows(resSys);
  if (rowsSys.length > 0 && rowsSys[0].email) {
    return rowsSys[0].email;
  }

  const resProf = await execute_d1_query(
    `SELECT email, full_name, avatar_url, role FROM profiles WHERE id = ? LIMIT 1`,
    [user_id]
  );
  const rowsProf = d1_rows(resProf);
  if (rowsProf.length > 0 && rowsProf[0].email) {
    return rowsProf[0].email;
  }

  return null;
}

module.exports = {
  execute_d1_query,
  d1_rows,
  init_d1_tables,
  isD1Configured,
  guardar_api_key,
  obtener_api_keys,
  eliminar_api_key,
  verificar_api_key,
  actualizar_uso_api_key,
  resolve_email_from_api_key
};
