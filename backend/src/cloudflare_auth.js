/**
 * cloudflare_auth.js
 * Módulo 3: Autenticación Google OAuth 2.0 Directo + Token Firmado Sin Estado (URLSafeSerializer)
 * + Middleware / Decorador @require_auth Dual (Token Web + API Key fr_...).
 */
const crypto = require('crypto');
const { getAppConfig } = require('./app_config');
const {
  execute_d1_query,
  d1_rows,
  verificar_api_key,
  actualizar_uso_api_key,
  resolve_email_from_api_key
} = require('./cloudflare_db');

// ============================================================================
// URLSafeSerializer (Equivalente exacto a itsdangerous.URLSafeSerializer(JWT_SECRET_KEY, salt="auth"))
// ============================================================================
class URLSafeSerializer {
  constructor(secretKey, salt = 'auth') {
    this.secretKey = String(secretKey || 'tu-secreto-jwt-ultra-seguro-2026');
    this.salt = String(salt || 'auth');
  }

  _deriveKey() {
    return crypto.createHmac('sha256', this.secretKey).update(this.salt).digest();
  }

  dumps(obj) {
    const jsonStr = JSON.stringify(obj);
    const payloadB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this._deriveKey())
      .update(payloadB64)
      .digest('base64url');
    return `${payloadB64}.${sig}`;
  }

  loads(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      throw new Error('Malformed token');
    }
    const lastDot = token.lastIndexOf('.');
    const payloadB64 = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);

    const expectedSig = crypto
      .createHmac('sha256', this._deriveKey())
      .update(payloadB64)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid token signature');
    }

    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    return JSON.parse(jsonStr);
  }
}

function getSerializer() {
  const cfg = getAppConfig();
  return new URLSafeSerializer(cfg.JWT_SECRET_KEY, 'auth');
}

/**
 * Registra o actualiza un usuario en system_users y profiles de Cloudflare D1
 */
async function upsertUserInD1({ user_id, email, full_name, avatar_url, phone = null }) {
  const cfg = getAppConfig();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const isVipEmail = cfg.ALLOWED_EMAILS.includes(normalizedEmail);
  const role = isVipEmail ? 'admin' : 'user';
  const nowEpoch = Math.floor(Date.now() / 1000);
  const nowIso = new Date().toISOString();

  // 1. INSERT OR REPLACE en system_users
  const existingSys = d1_rows(
    await execute_d1_query(`SELECT id, created_at, password_hash FROM system_users WHERE user_id = ? OR email = ? LIMIT 1`, [
      user_id,
      normalizedEmail
    ])
  );
  const createdAtEpoch = existingSys[0]?.created_at || nowEpoch;
  const passHash = existingSys[0]?.password_hash || null;

  await execute_d1_query(
    `INSERT OR REPLACE INTO system_users (user_id, email, full_name, avatar_url, role, password_hash, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, normalizedEmail, full_name, avatar_url, role, passHash, createdAtEpoch, nowEpoch]
  );

  // 2. INSERT OR REPLACE en profiles (preservando metadatos previos si existen)
  const existingProf = d1_rows(
    await execute_d1_query(`SELECT * FROM profiles WHERE id = ? LIMIT 1`, [user_id])
  );
  const prev = existingProf[0] || {};
  const metadataObj = prev.metadata
    ? (() => { try { return JSON.parse(prev.metadata); } catch { return {}; } })()
    : {};
  metadataObj.plan = isVipEmail ? 'pro' : (metadataObj.plan || 'free');
  metadataObj.is_vip = isVipEmail;

  await execute_d1_query(
    `INSERT OR REPLACE INTO profiles (
      id, email, full_name, name, phone, bio, avatar_url, role,
      following_count, followers_count, likes_count, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      normalizedEmail,
      full_name || prev.full_name || prev.name || 'Minero',
      full_name || prev.name || prev.full_name || 'Minero',
      phone || prev.phone || null,
      prev.bio || 'Aprovecha la vida que el tiempo nos gana',
      avatar_url || prev.avatar_url || null,
      role,
      prev.following_count || 0,
      prev.followers_count || 0,
      prev.likes_count || 0,
      JSON.stringify(metadataObj),
      prev.created_at || nowIso
    ]
  );

  return {
    user_id,
    email: normalizedEmail,
    full_name: full_name || prev.full_name || 'Minero',
    avatar_url: avatar_url || prev.avatar_url || null,
    role,
    is_vip: isVipEmail
  };
}

// ============================================================================
// Decorador / Middleware @require_auth Dual (Token Web + API Key fr_...)
// ============================================================================
async function require_auth(request, reply) {
  const cfg = getAppConfig();
  let token = null;

  const authHeader = request.headers['authorization'] || request.headers['Authorization'];
  const apiKeyHeader = request.headers['x-api-key'] || request.headers['X-API-Key'];

  if (authHeader && String(authHeader).startsWith('Bearer ')) {
    token = String(authHeader).slice(7).trim();
  } else if (apiKeyHeader) {
    token = String(apiKeyHeader).trim();
  } else if (request.query && request.query.token) {
    token = String(request.query.token).trim();
  }

  if (!token) {
    return reply.code(401).send({ error: 'No autenticado. Falta token o X-API-Key.' });
  }

  // Caso 1: Es una API Key (token.startswith("fr_"))
  if (token.startsWith('fr_')) {
    const keyRow = await verificar_api_key(token);
    if (!keyRow) {
      return reply.code(401).send({ error: 'API Key inválida o expirada.' });
    }

    const email = (await resolve_email_from_api_key(keyRow.user_id)) || '';
    const normalizedEmail = email.toLowerCase();
    const isVip =
      Boolean(keyRow.is_vip_env) ||
      cfg.ALLOWED_VIP_KEYS.includes(token) ||
      cfg.ALLOWED_EMAILS.includes(normalizedEmail);
    const role = isVip ? 'admin' : 'user';

    // Obtener perfil completo si existe
    const profRows = d1_rows(
      await execute_d1_query(`SELECT * FROM profiles WHERE id = ? LIMIT 1`, [keyRow.user_id])
    );
    const prof = profRows[0] || {};

    // Dispara en background actualizar_uso_api_key(key_id)
    actualizar_uso_api_key(keyRow.id);

    const userData = {
      id: keyRow.user_id,
      user_id: keyRow.user_id,
      email: normalizedEmail || prof.email || 'api_user@mineralert.com',
      full_name: prof.full_name || prof.name || keyRow.name || 'API Key User',
      name: prof.name || prof.full_name || keyRow.name || 'API Key User',
      avatar_url: prof.avatar_url || null,
      role,
      is_vip: isVip,
      api_key: token
    };

    // Inyección estilo flask.g en request.g y request
    request.g = {
      user_id: userData.id,
      user_email: userData.email,
      user_data: userData,
      access_token: token
    };
    request.user = userData;
    return;
  }

  // Caso 2: Es un Token de Sesión Web (URLSafeSerializer)
  try {
    const serializer = getSerializer();
    const payload = serializer.loads(token);

    const normalizedEmail = String(payload.email || '').trim().toLowerCase();
    const isVip = cfg.ALLOWED_EMAILS.includes(normalizedEmail);
    const role = isVip ? 'admin' : 'user';

    const userData = {
      id: payload.user_id,
      user_id: payload.user_id,
      email: normalizedEmail,
      full_name: payload.name || payload.full_name || normalizedEmail.split('@')[0] || 'Minero',
      name: payload.name || payload.full_name || normalizedEmail.split('@')[0] || 'Minero',
      avatar_url: payload.picture || payload.avatar_url || null,
      role,
      is_vip: isVip
    };

    request.g = {
      user_id: userData.id,
      user_email: userData.email,
      user_data: userData,
      access_token: token
    };
    request.user = userData;
  } catch (err) {
    return reply.code(401).send({ error: 'Token de sesión inválido o expirado.' });
  }
}

// ============================================================================
// Rutas de Autenticación Google OAuth 2.0 + Auth Local Directo (Fastify Plugin)
// ============================================================================
async function cloudflareAuthRoutes(fastify) {
  /**
   * GET /api/auth/google/login
   * Construye la URL hacia https://accounts.google.com/o/oauth2/v2/auth y redirige al usuario.
   */
  fastify.get('/api/auth/google/login', async (request, reply) => {
    const host = request.headers.host;
    const proto = request.headers['x-forwarded-proto'] || request.protocol;
    const cfg = getAppConfig(host, proto);

    // Si en desarrollo local aún no han puesto GOOGLE_CLIENT_ID real, ofrecer login directo de desarrollo o redirigir a Google
    const isDummyGoogleClient =
      !cfg.GOOGLE_CLIENT_ID ||
      cfg.GOOGLE_CLIENT_ID.startsWith('xxx') ||
      cfg.GOOGLE_CLIENT_ID.startsWith('tu_');

    if (isDummyGoogleClient && request.query.dev_bypass !== 'false') {
      // Si viene un email en query o usamos cuenta demo de desarrollo para que funcione out-of-the-box sin bloquear
      const devEmail = request.query.email || cfg.ALLOWED_EMAILS[0] || 'minero@gmail.com';
      const devSub = 'google_dev_' + crypto.createHash('md5').update(devEmail).digest('hex').slice(0, 16);
      const devName = devEmail.split('@')[0].replace(/[._]/g, ' ');
      const devPic = `https://ui-avatars.com/api/?name=${encodeURIComponent(devName)}&background=2563eb&color=fff`;

      await upsertUserInD1({
        user_id: devSub,
        email: devEmail,
        full_name: devName,
        avatar_url: devPic
      });

      const serializer = getSerializer();
      const localToken = serializer.dumps({
        user_id: devSub,
        email: devEmail,
        name: devName,
        picture: devPic
      });

      const redirectTarget = request.headers.referer
        ? new URL(request.headers.referer).origin
        : cfg.FRONTEND_URL;
      return reply.redirect(`${redirectTarget}/?token=${encodeURIComponent(localToken)}`);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: cfg.GOOGLE_CLIENT_ID,
      redirect_uri: cfg.GOOGLE_REDIRECT_URI,
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account'
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  /**
   * GET /api/auth/google/callback
   * Recibe code por query string, intercambia por access_token, obtiene userinfo,
   * verifica ALLOWED_EMAILS, hace INSERT OR REPLACE en D1, firma el token y redirige a FRONTEND_URL/?token=...
   */
  fastify.get('/api/auth/google/callback', async (request, reply) => {
    const host = request.headers.host;
    const proto = request.headers['x-forwarded-proto'] || request.protocol;
    const cfg = getAppConfig(host, proto);
    const { code, error } = request.query || {};

    if (error || !code) {
      return reply.redirect(`${cfg.FRONTEND_URL}/login?error=${encodeURIComponent(error || 'missing_code')}`);
    }

    try {
      // 1. Intercambiar code por access_token
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: cfg.GOOGLE_CLIENT_ID,
          client_secret: cfg.GOOGLE_CLIENT_SECRET,
          redirect_uri: cfg.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code'
        }).toString()
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        fastify.log.error('[OAuth Callback] Error obteniendo token:', tokenData);
        return reply.redirect(`${cfg.FRONTEND_URL}/login?error=oauth_token_exchange_failed`);
      }

      // 2. Obtener datos del usuario desde OpenID Connect
      const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userInfo = await userRes.json();
      if (!userRes.ok || !userInfo.sub || !userInfo.email) {
        return reply.redirect(`${cfg.FRONTEND_URL}/login?error=oauth_userinfo_failed`);
      }

      const email = String(userInfo.email).trim().toLowerCase();
      const googleSub = String(userInfo.sub);
      const fullName = userInfo.name || email.split('@')[0];
      const avatarUrl = userInfo.picture || null;

      // 3. Verificar ALLOWED_EMAILS (modo cerrado vs modo SaaS abierto con promoción automática VIP)
      if (cfg.AUTH_CLOSED_MODE && cfg.ALLOWED_EMAILS.length > 0 && !cfg.ALLOWED_EMAILS.includes(email)) {
        return reply.redirect(`${cfg.FRONTEND_URL}/login?error=email_not_allowed`);
      }

      // 4. INSERT OR REPLACE en system_users y profiles de Cloudflare D1
      await upsertUserInD1({
        user_id: googleSub,
        email,
        full_name: fullName,
        avatar_url: avatarUrl
      });

      // 5. Generar token firmado sin estado con URLSafeSerializer(JWT_SECRET_KEY, salt="auth")
      const serializer = getSerializer();
      const local_token = serializer.dumps({
        user_id: googleSub,
        email,
        name: fullName,
        picture: avatarUrl
      });

      // 6. Redirigir al frontend con ?token=...
      return reply.redirect(`${cfg.FRONTEND_URL}/?token=${encodeURIComponent(local_token)}`);
    } catch (err) {
      fastify.log.error('[OAuth Callback] Excepción:', err);
      return reply.redirect(`${cfg.FRONTEND_URL}/login?error=internal_oauth_error`);
    }
  });

  /**
   * POST /api/auth/login & POST /api/auth/register
   * Soporte directo en Cloudflare D1 para inicio de sesión con Email/Contraseña (sin Supabase)
   */
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password, name, phone } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email y contraseña requeridos.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const userId = 'usr_' + crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 24);
    const passHash = crypto.createHash('sha256').update(String(password) + '_cf_salt').digest('hex');
    const fullName = name || normalizedEmail.split('@')[0];
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=10b981&color=fff`;

    await upsertUserInD1({
      user_id: userId,
      email: normalizedEmail,
      full_name: fullName,
      avatar_url: avatarUrl,
      phone: phone || null
    });

    await execute_d1_query(
      `UPDATE system_users SET password_hash = ? WHERE user_id = ?`,
      [passHash, userId]
    );

    const serializer = getSerializer();
    const token = serializer.dumps({
      user_id: userId,
      email: normalizedEmail,
      name: fullName,
      picture: avatarUrl
    });

    return {
      token,
      user: {
        id: userId,
        user_id: userId,
        email: normalizedEmail,
        name: fullName,
        full_name: fullName,
        avatar_url: avatarUrl
      }
    };
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email y contraseña requeridos.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const passHash = crypto.createHash('sha256').update(String(password) + '_cf_salt').digest('hex');

    const rows = d1_rows(
      await execute_d1_query(`SELECT * FROM system_users WHERE email = ? LIMIT 1`, [normalizedEmail])
    );

    let userId;
    let fullName;
    let avatarUrl;

    if (rows.length === 0) {
      // Auto- aprovisionar en primer login si no existe para experiencia fluida
      userId = 'usr_' + crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 24);
      fullName = normalizedEmail.split('@')[0];
      avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2563eb&color=fff`;
      await upsertUserInD1({ user_id: userId, email: normalizedEmail, full_name: fullName, avatar_url: avatarUrl });
      await execute_d1_query(`UPDATE system_users SET password_hash = ? WHERE user_id = ?`, [passHash, userId]);
    } else {
      const existing = rows[0];
      if (existing.password_hash && existing.password_hash !== passHash) {
        return reply.code(401).send({ error: 'Credenciales inválidas.' });
      }
      userId = existing.user_id;
      fullName = existing.full_name || normalizedEmail.split('@')[0];
      avatarUrl = existing.avatar_url;
      await upsertUserInD1({ user_id: userId, email: normalizedEmail, full_name: fullName, avatar_url: avatarUrl });
    }

    const serializer = getSerializer();
    const token = serializer.dumps({
      user_id: userId,
      email: normalizedEmail,
      name: fullName,
      picture: avatarUrl
    });

    return {
      token,
      user: {
        id: userId,
        user_id: userId,
        email: normalizedEmail,
        name: fullName,
        full_name: fullName,
        avatar_url: avatarUrl
      }
    };
  });
}

module.exports = {
  URLSafeSerializer,
  getSerializer,
  require_auth,
  upsertUserInD1,
  cloudflareAuthRoutes
};
