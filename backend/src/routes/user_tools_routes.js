/**
 * user_tools_routes.js
 * Módulo 7: Herramientas Conectadas, Gestión de Llaves IA en Caliente, Delegación Multi-Usuario,
 * Endpoints de Perfil, Uso, API Keys (fr_...), Proyectos (D1 + R2) y Motor de Datos RESTful en D1.
 */
const crypto = require('crypto');
const { getAppConfig, reloadEnv, setEnvKey } = require('../app_config');
const {
  execute_d1_query,
  d1_rows,
  guardar_api_key,
  obtener_api_keys,
  eliminar_api_key
} = require('../cloudflare_db');
const { require_auth, upsertUserInD1 } = require('../cloudflare_auth');
const { storageService } = require('../storage_service');
const { getSubscriptionStatus } = require('../backend_stripe_subscription');

// Claves de motores IA y herramientas soportadas en GET/POST /api/env-keys
const MANAGED_ENV_KEYS = [
  'GROQ_API_KEY',
  'FAL_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'ELEVENLABS_API_KEY',
  'REPLICATE_API_TOKEN',
  'DEEPGRAM_API_KEY',
  'ALLOWED_EMAILS',
  'ALLOWED_VIP_KEYS'
];

function maskSecret(val) {
  if (!val) return '';
  const s = String(val);
  if (s.length <= 8) return '••••' + s.slice(-2);
  return s.slice(0, 4) + '••••••••' + s.slice(-4);
}

async function userToolsRoutes(fastify) {
  // ==========================================================================
  // 1. Endpoints de Usuario y Perfil en D1
  // ==========================================================================

  /**
   * GET /api/user/profile
   * Devuelve datos del usuario y registra su actividad en system_users de Cloudflare D1.
   */
  fastify.get('/api/user/profile', { preHandler: [require_auth] }, async (request) => {
    const { user_id, user_email, user_data } = request.g;
    const nowEpoch = Math.floor(Date.now() / 1000);

    // Registrar actividad en system_users
    await execute_d1_query(
      `UPDATE system_users SET last_seen = ? WHERE user_id = ?`,
      [nowEpoch, user_id]
    );

    let profRows = d1_rows(
      await execute_d1_query(`SELECT * FROM profiles WHERE id = ? LIMIT 1`, [user_id])
    );

    if (profRows.length === 0) {
      await upsertUserInD1({
        user_id,
        email: user_email,
        full_name: user_data.full_name,
        avatar_url: user_data.avatar_url
      });
      profRows = d1_rows(
        await execute_d1_query(`SELECT * FROM profiles WHERE id = ? LIMIT 1`, [user_id])
      );
    }

    const prof = profRows[0] || {};
    const subStatus = await getSubscriptionStatus(user_id, user_email, user_data?.api_key);

    return {
      id: user_id,
      user_id,
      email: user_email,
      name: prof.name || prof.full_name || user_data.full_name || 'Minero',
      full_name: prof.full_name || prof.name || user_data.full_name || 'Minero',
      bio: prof.bio || 'Aprovecha la vida que el tiempo nos gana',
      phone: prof.phone || null,
      avatar_url: prof.avatar_url || user_data.avatar_url || null,
      role: user_data.is_vip ? 'admin' : (prof.role || 'user'),
      is_vip: subStatus.is_vip,
      plan: subStatus.plan,
      following_count: Number(prof.following_count || 0),
      followers_count: Number(prof.followers_count || 0),
      likes_count: Number(prof.likes_count || 0),
      subscription: subStatus
    };
  });

  /**
   * PUT /api/user/profile
   * Actualiza datos del perfil en Cloudflare D1
   */
  fastify.put('/api/user/profile', { preHandler: [require_auth] }, async (request) => {
    const { user_id, user_email, user_data } = request.g;
    const updates = request.body || {};

    const profRows = d1_rows(
      await execute_d1_query(`SELECT * FROM profiles WHERE id = ? LIMIT 1`, [user_id])
    );
    const current = profRows[0] || {};

    const newName = updates.name ?? updates.full_name ?? current.name ?? user_data.full_name ?? 'Minero';
    const newBio = updates.bio ?? current.bio ?? '';
    const newAvatar = updates.avatar_url ?? current.avatar_url ?? user_data.avatar_url ?? null;
    const newPhone = updates.phone ?? current.phone ?? null;

    await execute_d1_query(
      `INSERT OR REPLACE INTO profiles (
        id, email, full_name, name, phone, bio, avatar_url, role,
        following_count, followers_count, likes_count, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        user_email,
        newName,
        newName,
        newPhone,
        newBio,
        newAvatar,
        current.role || user_data.role || 'user',
        current.following_count || 0,
        current.followers_count || 0,
        current.likes_count || 0,
        current.metadata || '{}',
        current.created_at || new Date().toISOString()
      ]
    );

    await execute_d1_query(
      `UPDATE system_users SET full_name = ?, avatar_url = ?, last_seen = ? WHERE user_id = ?`,
      [newName, newAvatar, Math.floor(Date.now() / 1000), user_id]
    );

    const updatedRows = d1_rows(
      await execute_d1_query(`SELECT * FROM profiles WHERE id = ? LIMIT 1`, [user_id])
    );
    return updatedRows[0] || { id: user_id, name: newName, bio: newBio, avatar_url: newAvatar };
  });

  /**
   * GET /api/user/usage
   * Cuenta los proyectos del usuario en D1 (SELECT COUNT(*) FROM proyectos WHERE user_id = ? AND deleted_at IS NULL)
   * y retorna su cuota usada/restante.
   */
  fastify.get('/api/user/usage', { preHandler: [require_auth] }, async (request) => {
    const { user_id, user_email, user_data } = request.g;
    const countRows = d1_rows(
      await execute_d1_query(
        `SELECT COUNT(*) AS count FROM proyectos WHERE user_id = ? AND deleted_at IS NULL`,
        [user_id]
      )
    );
    const projectCount = Number(countRows[0]?.count || 0);
    const sub = await getSubscriptionStatus(user_id, user_email, user_data?.api_key);

    const used = Math.max(projectCount, Number(sub.videos_used || 0));
    const limit = sub.videos_limit;
    const remaining = limit === -1 ? -1 : Math.max(0, limit - used);

    return {
      user_id,
      email: user_email,
      plan: sub.plan,
      is_vip: sub.is_vip,
      projects_count: projectCount,
      videos_used: used,
      videos_limit: limit,
      videos_remaining: remaining,
      allow_async_parallel: sub.allow_async_parallel
    };
  });

  // ==========================================================================
  // 2. CRUD Completo de API Keys (fr_...) en D1
  // ==========================================================================

  /**
   * GET /api/user/apikeys
   */
  fastify.get('/api/user/apikeys', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const keys = await obtener_api_keys(user_id);
    return { keys };
  });

  /**
   * POST /api/user/apikeys
   */
  fastify.post('/api/user/apikeys', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { name = 'My API Key', expires_at = 'Never', custom_key = null } = request.body || {};
    const newKey = await guardar_api_key(user_id, custom_key, name, expires_at);
    return { key: newKey };
  });

  /**
   * DELETE /api/user/apikeys/:key_id
   */
  fastify.delete('/api/user/apikeys/:key_id', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { key_id } = request.params;
    const deleted = await eliminar_api_key(key_id, user_id);
    return { success: deleted, id: key_id };
  });

  // ==========================================================================
  // 3. Gestión de Proyectos y Almacenamiento en Cloudflare D1 + R2
  // ==========================================================================

  /**
   * GET /api/user/projects
   */
  fastify.get('/api/user/projects', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const rows = d1_rows(
      await execute_d1_query(
        `SELECT * FROM proyectos WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
        [user_id]
      )
    );
    return { projects: rows };
  });

  /**
   * POST /api/user/projects
   * Permite subir o registrar un proyecto / recurso multimedia en R2 y D1
   */
  fastify.post('/api/user/projects', { preHandler: [require_auth] }, async (request, reply) => {
    const { user_id } = request.g;
    const {
      title = 'Nuevo Proyecto',
      filename = 'media.mp4',
      content_type = 'video/mp4',
      file_base64 = null,
      settings = {},
      metadata = {}
    } = request.body || {};

    const projectId = crypto.randomUUID();
    let videoUrl = '';
    let objectPath = '';
    let storageBackend = 'cloudflare';
    let fileSize = 0;

    if (file_base64) {
      const base64Clean = String(file_base64).includes(',')
        ? String(file_base64).split(',')[1]
        : String(file_base64);
      const buffer = Buffer.from(base64Clean, 'base64');
      const saved = await storageService.save_file(buffer, user_id, projectId, content_type, filename);
      videoUrl = saved.url;
      objectPath = saved.object_path;
      storageBackend = saved.storage_backend;
      fileSize = saved.size;
    }

    const nowIso = new Date().toISOString();
    await execute_d1_query(
      `INSERT INTO proyectos (
        id, user_id, title, filename, video_url, gcs_path, storage_backend,
        status, file_size_bytes, settings, metadata, created_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, NULL)`,
      [
        projectId,
        user_id,
        title,
        filename,
        videoUrl,
        objectPath,
        storageBackend,
        fileSize,
        JSON.stringify(settings),
        JSON.stringify(metadata),
        nowIso
      ]
    );

    const rows = d1_rows(
      await execute_d1_query(`SELECT * FROM proyectos WHERE id = ? LIMIT 1`, [projectId])
    );
    return reply.code(201).send({ project: rows[0] });
  });

  /**
   * DELETE /api/user/projects/:project_id
   * Elimina el archivo en R2 y marca deleted_at en Cloudflare D1
   */
  fastify.delete('/api/user/projects/:project_id', { preHandler: [require_auth] }, async (request, reply) => {
    const { user_id } = request.g;
    const { project_id } = request.params;

    const rows = d1_rows(
      await execute_d1_query(`SELECT * FROM proyectos WHERE id = ? AND user_id = ? LIMIT 1`, [project_id, user_id])
    );
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Proyecto no encontrado' });
    }

    const proj = rows[0];
    if (proj.gcs_path) {
      await storageService.delete_file(proj.gcs_path);
    }

    const nowIso = new Date().toISOString();
    await execute_d1_query(
      `UPDATE proyectos SET deleted_at = ?, status = 'deleted' WHERE id = ? AND user_id = ?`,
      [nowIso, project_id, user_id]
    );

    return { success: true, id: project_id };
  });

  // ==========================================================================
  // 4. Subida general de medios a Cloudflare R2 (para Chat, Avatares, Alertas)
  // ==========================================================================

  /**
   * POST /api/storage/upload
   * Recibe { filename, content_type, data_base64, folder } y lo sube a Cloudflare R2 (o LocalStorage fallback)
   */
  fastify.post('/api/storage/upload', { preHandler: [require_auth] }, async (request, reply) => {
    const { user_id } = request.g;
    const { filename = 'upload.bin', content_type = 'application/octet-stream', data_base64 } = request.body || {};

    if (!data_base64) {
      return reply.code(400).send({ error: 'Falta data_base64' });
    }

    const base64Clean = String(data_base64).includes(',')
      ? String(data_base64).split(',')[1]
      : String(data_base64);
    const buffer = Buffer.from(base64Clean, 'base64');
    const projectId = crypto.randomUUID().slice(0, 8);

    const saved = await storageService.save_file(buffer, user_id, projectId, content_type, filename);

    // También registrar en tabla proyectos para contabilizar uso y permitir gestión en R2
    const nowIso = new Date().toISOString();
    await execute_d1_query(
      `INSERT INTO proyectos (
        id, user_id, title, filename, video_url, gcs_path, storage_backend,
        status, file_size_bytes, settings, metadata, created_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, '{}', '{}', ?, NULL)`,
      [
        crypto.randomUUID(),
        user_id,
        filename,
        filename,
        saved.url,
        saved.object_path,
        saved.storage_backend,
        saved.size,
        nowIso
      ]
    );

    return {
      publicUrl: saved.url,
      url: saved.url,
      object_path: saved.object_path,
      storage_backend: saved.storage_backend,
      size: saved.size
    };
  });

  /**
   * DELETE /api/storage/object
   */
  fastify.delete('/api/storage/object', { preHandler: [require_auth] }, async (request) => {
    const { object_path } = request.body || request.query || {};
    if (object_path) {
      await storageService.delete_file(object_path);
    }
    return { success: true };
  });

  // ==========================================================================
  // 5. Gestión de API Keys de Motores IA en Caliente (GET/POST /api/env-keys)
  // ==========================================================================

  /**
   * GET /api/env-keys
   */
  fastify.get('/api/env-keys', { preHandler: [require_auth] }, async () => {
    reloadEnv();
    const keysStatus = {};
    for (const k of MANAGED_ENV_KEYS) {
      const val = process.env[k] || '';
      keysStatus[k] = {
        configured: Boolean(val && !val.startsWith('tu_') && !val.startsWith('xxx')),
        masked: maskSecret(val),
        value: k.startsWith('ALLOWED_') ? val : undefined
      };
    }
    return { keys: keysStatus };
  });

  /**
   * POST /api/env-keys
   * Guarda directamente en el archivo .env y recarga en memoria al instante
   */
  fastify.post('/api/env-keys', { preHandler: [require_auth] }, async (request, reply) => {
    const { keys } = request.body || {};
    if (!keys || typeof keys !== 'object') {
      return reply.code(400).send({ error: 'Se requiere un objeto { keys: { KEY: VALUE } }' });
    }

    const updated = [];
    for (const [k, v] of Object.entries(keys)) {
      if (v !== undefined && v !== null) {
        setEnvKey(k, String(v).trim());
        updated.push(k);
      }
    }

    reloadEnv();
    return {
      success: true,
      updated,
      message: 'Variables guardadas en .env y recargadas en memoria en caliente.'
    };
  });

  // ==========================================================================
  // 6. Delegación de Herramientas / Cuentas Compartidas (social_account_shares en D1)
  // ==========================================================================

  /**
   * GET /api/social/shares
   * Lista cuentas que el usuario ha compartido y cuentas que otros han compartido con él (por user_id o email)
   */
  fastify.get('/api/social/shares', { preHandler: [require_auth] }, async (request) => {
    const { user_id, user_email } = request.g;

    const ownedShares = d1_rows(
      await execute_d1_query(
        `SELECT * FROM social_account_shares WHERE owner_user_id = ? OR owner_email = ? ORDER BY created_at DESC`,
        [user_id, user_email]
      )
    );

    const receivedShares = d1_rows(
      await execute_d1_query(
        `SELECT * FROM social_account_shares WHERE shared_with_user_id = ? OR shared_with_email = ? ORDER BY created_at DESC`,
        [user_id, user_email]
      )
    );

    return {
      owned_shares: ownedShares,
      received_shares: receivedShares
    };
  });

  /**
   * POST /api/social/shares
   * Comparte cuentas OAuth conectadas (TikTok, Facebook, YouTube, etc.) con otro usuario por su email
   */
  fastify.post('/api/social/shares', { preHandler: [require_auth] }, async (request, reply) => {
    const { user_id, user_email } = request.g;
    const {
      shared_with_email,
      platform = 'TikTok',
      account_name = 'Cuenta Oficial',
      permissions = 'publish,analytics'
    } = request.body || {};

    if (!shared_with_email || !String(shared_with_email).includes('@')) {
      return reply.code(400).send({ error: 'Correo del destinatario inválido.' });
    }

    const targetEmail = String(shared_with_email).trim().toLowerCase();
    // Resolver user_id del destinatario si ya está registrado en system_users o profiles
    const targetRows = d1_rows(
      await execute_d1_query(
        `SELECT user_id FROM system_users WHERE email = ? LIMIT 1`,
        [targetEmail]
      )
    );
    const targetUserId = targetRows[0]?.user_id || null;

    const shareId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await execute_d1_query(
      `INSERT INTO social_account_shares (
        id, owner_user_id, owner_email, shared_with_email, shared_with_user_id,
        platform, account_name, permissions, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shareId,
        user_id,
        user_email,
        targetEmail,
        targetUserId,
        platform,
        account_name,
        permissions,
        nowIso
      ]
    );

    return {
      success: true,
      share: {
        id: shareId,
        owner_user_id: user_id,
        owner_email: user_email,
        shared_with_email: targetEmail,
        shared_with_user_id: targetUserId,
        platform,
        account_name,
        permissions,
        created_at: nowIso
      }
    };
  });

  /**
   * DELETE /api/social/shares/:share_id
   */
  fastify.delete('/api/social/shares/:share_id', { preHandler: [require_auth] }, async (request) => {
    const { user_id, user_email } = request.g;
    const { share_id } = request.params;
    await execute_d1_query(
      `DELETE FROM social_account_shares WHERE id = ? AND (owner_user_id = ? OR owner_email = ?)`,
      [share_id, user_id, user_email]
    );
    return { success: true, id: share_id };
  });

  // ==========================================================================
  // 7. Endpoints de Datos de la App MinerAlert en Cloudflare D1 (Reemplazo 100% de Supabase)
  // ==========================================================================

  // --- ALERTAS ---
  fastify.get('/api/data/alerts', async (request) => {
    const { since, limit = 100 } = request.query || {};
    let sql = `
      SELECT a.*, p.name AS profile_name, p.avatar_url AS profile_avatar
      FROM alerts a
      LEFT JOIN profiles p ON a.user_id = p.id
      WHERE a.is_active = 1
    `;
    const params = [];
    if (since) {
      sql += ` AND a.created_at >= ?`;
      params.push(String(since));
    }
    sql += ` ORDER BY a.created_at DESC LIMIT ?`;
    params.push(Number(limit) || 100);

    const rows = d1_rows(await execute_d1_query(sql, params));
    const formatted = rows.map(r => ({
      ...r,
      is_active: Boolean(r.is_active),
      profiles: {
        name: r.profile_name || 'Minero',
        avatar_url: r.profile_avatar || null
      }
    }));
    return { data: formatted };
  });

  fastify.post('/api/data/alerts', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const body = request.body || {};
    const id = body.id || crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

    await execute_d1_query(
      `INSERT INTO alerts (id, user_id, location, latitude, longitude, description, is_active, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        user_id,
        body.location || `SRID=4326;POINT(${body.longitude} ${body.latitude})`,
        Number(body.latitude),
        Number(body.longitude),
        body.description || '⚠️ Alerta de seguridad',
        nowIso,
        expiresIso
      ]
    );

    const profRows = d1_rows(await execute_d1_query(`SELECT name, avatar_url FROM profiles WHERE id = ? LIMIT 1`, [user_id]));
    const prof = profRows[0] || { name: request.g.user_data?.name || 'Minero', avatar_url: request.g.user_data?.avatar_url };

    const created = {
      id,
      user_id,
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      description: body.description || '⚠️ Alerta de seguridad',
      is_active: true,
      created_at: nowIso,
      expires_at: expiresIso,
      profiles: prof
    };

    if (fastify.io) {
      fastify.io.emit('new_alert', created);
    }

    return { data: created };
  });

  // --- CANALES Y MENSAJES DE CHAT ---
  fastify.get('/api/data/channels', async () => {
    const rows = d1_rows(await execute_d1_query(`SELECT * FROM channels ORDER BY created_at ASC`, []));
    return { data: rows };
  });

  fastify.put('/api/data/channels/:channel_id', { preHandler: [require_auth] }, async (request) => {
    const { channel_id } = request.params;
    const { expiration_hours } = request.body || {};
    await execute_d1_query(
      `UPDATE channels SET expiration_hours = ? WHERE id = ?`,
      [expiration_hours ?? null, channel_id]
    );
    return { success: true };
  });

  fastify.get('/api/data/messages', async (request) => {
    const { channel_id, before, user_id, types, limit = 50, offset = 0 } = request.query || {};
    let sql = `
      SELECT m.*,
             p.name AS sender_name, p.avatar_url AS sender_avatar,
             rm.id AS reply_id, rm.content AS reply_content, rm.type AS reply_type,
             rm.media_url AS reply_media_url, rm.media_urls AS reply_media_urls,
             rm.file_metadata AS reply_file_metadata,
             rp.name AS reply_sender_name
      FROM messages m
      LEFT JOIN profiles p ON m.user_id = p.id
      LEFT JOIN messages rm ON m.reply_to = rm.id
      LEFT JOIN profiles rp ON rm.user_id = rp.id
      WHERE 1=1
    `;
    const params = [];

    if (channel_id) {
      sql += ` AND m.channel_id = ?`;
      params.push(String(channel_id));
    }
    if (user_id) {
      sql += ` AND m.user_id = ?`;
      params.push(String(user_id));
    }
    if (before) {
      sql += ` AND m.created_at < ?`;
      params.push(String(before));
    }
    if (types) {
      const typeList = String(types).split(',').map(t => t.trim()).filter(Boolean);
      if (typeList.length > 0) {
        sql += ` AND m.type IN (${typeList.map(() => '?').join(',')})`;
        params.push(...typeList);
      }
    }

    sql += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 50, Number(offset) || 0);

    const rows = d1_rows(await execute_d1_query(sql, params));
    const msgIds = rows.map(r => r.id);

    const reactionsMap = {};
    if (msgIds.length > 0) {
      const reactSql = `
        SELECT mr.*, p.name AS profile_name
        FROM message_reactions mr
        LEFT JOIN profiles p ON mr.user_id = p.id
        WHERE mr.message_id IN (${msgIds.map(() => '?').join(',')})
      `;
      const reactRows = d1_rows(await execute_d1_query(reactSql, msgIds));
      for (const r of reactRows) {
        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
        reactionsMap[r.message_id].push({
          ...r,
          profiles: { name: r.profile_name || 'Minero' }
        });
      }
    }

    const parseJsonSafe = (val, fallback = null) => {
      if (!val) return fallback;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return fallback; }
    };

    const enriched = rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      channel_id: r.channel_id,
      type: r.type,
      content: r.content,
      media_url: r.media_url,
      media_urls: parseJsonSafe(r.media_urls, null),
      file_metadata: parseJsonSafe(r.file_metadata, null),
      reply_to: r.reply_to,
      views: Number(r.views || 0),
      created_at: r.created_at,
      profiles: {
        name: r.sender_name || 'Minero',
        avatar_url: r.sender_avatar || null
      },
      reply: r.reply_id
        ? {
            id: r.reply_id,
            content: r.reply_content,
            type: r.reply_type,
            media_url: r.reply_media_url,
            media_urls: parseJsonSafe(r.reply_media_urls, null),
            file_metadata: parseJsonSafe(r.reply_file_metadata, null),
            profiles: { name: r.reply_sender_name || 'Minero' }
          }
        : null,
      reactions: reactionsMap[r.id] || []
    }));

    return { data: enriched };
  });

  fastify.post('/api/data/messages', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const body = request.body || {};
    const id = body.id || crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await execute_d1_query(
      `INSERT INTO messages (
        id, user_id, channel_id, type, content, media_url, media_urls, file_metadata, reply_to, views, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        user_id,
        body.channel_id || '00000000-0000-0000-0000-000000000001',
        body.type || 'TEXT',
        body.content || '',
        body.media_url || null,
        body.media_urls ? JSON.stringify(body.media_urls) : null,
        body.file_metadata ? JSON.stringify(body.file_metadata) : null,
        body.reply_to || null,
        nowIso
      ]
    );

    const res = await fastify.inject({
      method: 'GET',
      url: `/api/data/messages?channel_id=${encodeURIComponent(body.channel_id || '00000000-0000-0000-0000-000000000001')}&limit=1`
    });
    const list = JSON.parse(res.payload)?.data || [];
    const created = list.find(m => m.id === id) || list[0];

    if (fastify.io && created) {
      fastify.io.to(created.channel_id).emit('new_message', created);
    }

    return { data: created };
  });

  fastify.delete('/api/data/messages/:message_id', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { message_id } = request.params;
    await execute_d1_query(`DELETE FROM messages WHERE id = ? AND user_id = ?`, [message_id, user_id]);
    return { success: true };
  });

  // --- REACCIONES ---
  fastify.post('/api/data/reactions', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { message_id, emoji } = request.body || {};
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    await execute_d1_query(
      `INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, message_id, user_id, emoji, nowIso]
    );
    const profRows = d1_rows(await execute_d1_query(`SELECT name FROM profiles WHERE id = ? LIMIT 1`, [user_id]));
    return {
      data: {
        id,
        message_id,
        user_id,
        emoji,
        created_at: nowIso,
        profiles: { name: profRows[0]?.name || 'Minero' }
      }
    };
  });

  fastify.delete('/api/data/reactions/:reaction_id', { preHandler: [require_auth] }, async (request) => {
    const { reaction_id } = request.params;
    await execute_d1_query(`DELETE FROM message_reactions WHERE id = ?`, [reaction_id]);
    return { success: true };
  });

  // --- NOTIFICACIONES & PUSH SUBSCRIPTIONS ---
  fastify.get('/api/data/notifications', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const rows = d1_rows(
      await execute_d1_query(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [user_id]
      )
    );
    return {
      data: rows.map(r => ({
        ...r,
        is_read: Boolean(r.is_read)
      }))
    };
  });

  fastify.put('/api/data/notifications/read', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { id, all } = request.body || {};
    if (all) {
      await execute_d1_query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [user_id]);
    } else if (id) {
      await execute_d1_query(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [id, user_id]);
    }
    return { success: true };
  });

  fastify.post('/api/data/push-subscriptions', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { endpoint, p256dh, auth } = request.body || {};
    if (!endpoint) return { success: false };

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    await execute_d1_query(
      `INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
       VALUES (COALESCE((SELECT id FROM push_subscriptions WHERE endpoint = ?), ?), ?, ?, ?, ?, ?)`,
      [endpoint, id, user_id, endpoint, p256dh || '', auth || '', nowIso]
    );
    return { success: true };
  });

  // --- INTERACCIONES MULTIMEDIA (TikTokViewer) ---
  fastify.post('/api/data/media/view', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { message_id, media_index = 0 } = request.body || {};
    const id = `${message_id}_${media_index}`;
    await execute_d1_query(
      `INSERT INTO media_views (id, message_id, media_index, user_id, views_count, created_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET views_count = views_count + 1`,
      [id, message_id, Number(media_index), user_id, new Date().toISOString()]
    );
    await execute_d1_query(`UPDATE messages SET views = COALESCE(views, 0) + 1 WHERE id = ?`, [message_id]);
    return { success: true };
  });

  fastify.get('/api/data/media/interactions', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { message_id, media_index = 0 } = request.query || {};

    const viewRows = d1_rows(
      await execute_d1_query(
        `SELECT views_count FROM media_views WHERE message_id = ? AND media_index = ? LIMIT 1`,
        [message_id, Number(media_index)]
      )
    );
    const likeRows = d1_rows(
      await execute_d1_query(
        `SELECT user_id FROM media_likes WHERE message_id = ? AND media_index = ?`,
        [message_id, Number(media_index)]
      )
    );
    const commentRows = d1_rows(
      await execute_d1_query(
        `SELECT mc.*, p.name AS profile_name, p.avatar_url AS profile_avatar
         FROM media_comments mc
         LEFT JOIN profiles p ON mc.user_id = p.id
         WHERE mc.message_id = ? AND mc.media_index = ?
         ORDER BY mc.created_at DESC`,
        [message_id, Number(media_index)]
      )
    );

    return {
      views_count: Number(viewRows[0]?.views_count || 0),
      likes_count: likeRows.length,
      is_liked: likeRows.some(l => l.user_id === user_id),
      comments: commentRows.map(c => ({
        ...c,
        profiles: { name: c.profile_name || 'Minero', avatar_url: c.profile_avatar || null }
      }))
    };
  });

  fastify.post('/api/data/media/like', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { message_id, media_index = 0 } = request.body || {};
    const existing = d1_rows(
      await execute_d1_query(
        `SELECT id FROM media_likes WHERE message_id = ? AND media_index = ? AND user_id = ? LIMIT 1`,
        [message_id, Number(media_index), user_id]
      )
    );
    if (existing.length > 0) {
      await execute_d1_query(`DELETE FROM media_likes WHERE id = ?`, [existing[0].id]);
      return { liked: false };
    } else {
      await execute_d1_query(
        `INSERT INTO media_likes (id, message_id, media_index, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), message_id, Number(media_index), user_id, new Date().toISOString()]
      );
      return { liked: true };
    }
  });

  fastify.post('/api/data/media/comment', { preHandler: [require_auth] }, async (request) => {
    const { user_id } = request.g;
    const { message_id, media_index = 0, content } = request.body || {};
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    await execute_d1_query(
      `INSERT INTO media_comments (id, message_id, media_index, user_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, message_id, Number(media_index), user_id, content, nowIso]
    );
    return { success: true, id };
  });
}

module.exports = {
  userToolsRoutes
};
