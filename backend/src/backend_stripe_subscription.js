/**
 * backend_stripe_subscription.js
 * Módulo 6: Suscripciones, Cuotas Mensuales y Lista Blanca VIP en Cloudflare D1
 *
 * Planes Soportados:
 * - Plan Free ($0): 10 ejecuciones/mes, cola secuencial 1x1 (allow_async_parallel = False)
 * - Plan Creator ($5/mes): 100 ejecuciones/mes, ejecución paralela asíncrona (allow_async_parallel = True)
 * - Plan Pro ($10/mes) / VIP (ALLOWED_EMAILS o ALLOWED_VIP_KEYS): Ejecuciones ilimitadas (videos_limit = -1),
 *   ejecución paralela asíncrona (allow_async_parallel = True, is_vip = True)
 */
const crypto = require('crypto');
const { getAppConfig, reloadEnv } = require('./app_config');
const {
  execute_d1_query,
  d1_rows,
  obtener_api_keys,
  guardar_api_key
} = require('./cloudflare_db');
const { require_auth } = require('./cloudflare_auth');

const PLAN_CONFIG = {
  free: {
    plan: 'free',
    price_usd: 0,
    videos_limit: 10,
    allow_async_parallel: false
  },
  creator: {
    plan: 'creator',
    price_usd: 5,
    videos_limit: 100,
    allow_async_parallel: true
  },
  pro: {
    plan: 'pro',
    price_usd: 10,
    videos_limit: -1,
    allow_async_parallel: true
  }
};

/**
 * Obtiene o inicializa el estado de suscripción de un usuario con Detección VIP en Caliente
 */
async function getSubscriptionStatus(user_id, email, activeApiKey = null) {
  // Recarga .env en cada verificación (load_dotenv(override=True))
  reloadEnv();
  const cfg = getAppConfig();

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const isVipByEmail = Boolean(normalizedEmail && cfg.ALLOWED_EMAILS.includes(normalizedEmail));
  const isVipByKey = Boolean(activeApiKey && cfg.ALLOWED_VIP_KEYS.includes(activeApiKey));
  const isVip = isVipByEmail || isVipByKey;

  // Buscar suscripción en D1
  const subRows = d1_rows(
    await execute_d1_query(`SELECT * FROM user_subscriptions WHERE user_id = ? LIMIT 1`, [user_id])
  );

  // Contar proyectos reales en D1 si no hay registro previo
  const projCountRows = d1_rows(
    await execute_d1_query(
      `SELECT COUNT(*) AS total FROM proyectos WHERE user_id = ? AND deleted_at IS NULL`,
      [user_id]
    )
  );
  const projectsCount = Number(projCountRows[0]?.total || 0);

  let sub = subRows[0];
  if (!sub) {
    const initialPlan = isVip ? 'pro' : 'free';
    const planRules = PLAN_CONFIG[initialPlan];
    const nowIso = new Date().toISOString();

    await execute_d1_query(
      `INSERT OR REPLACE INTO user_subscriptions (
        user_id, email, plan, status, videos_used, videos_limit, allow_async_parallel, updated_at
      ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        user_id,
        normalizedEmail,
        initialPlan,
        projectsCount,
        planRules.videos_limit,
        planRules.allow_async_parallel ? 1 : 0,
        nowIso
      ]
    );

    sub = {
      user_id,
      email: normalizedEmail,
      plan: initialPlan,
      status: 'active',
      videos_used: projectsCount,
      videos_limit: planRules.videos_limit,
      allow_async_parallel: planRules.allow_async_parallel ? 1 : 0
    };
  }

  // Promoción automática VIP en caliente
  let effectivePlan = isVip ? 'pro' : (sub.plan || 'free').toLowerCase();
  if (!PLAN_CONFIG[effectivePlan]) effectivePlan = 'free';
  const rules = PLAN_CONFIG[effectivePlan];

  const videosUsed = Math.max(Number(sub.videos_used || 0), projectsCount);
  const videosLimit = isVip ? -1 : rules.videos_limit;
  const allowAsyncParallel = isVip ? true : Boolean(rules.allow_async_parallel);

  // Asegurar que el usuario tenga al menos una API Key fr_... para retornar en status
  let keys = await obtener_api_keys(user_id);
  if (!keys || keys.length === 0) {
    const createdKey = await guardar_api_key(user_id, null, 'Default API Key', 'Never');
    keys = [createdKey];
  }

  return {
    plan: effectivePlan,
    status: sub.status || 'active',
    is_vip: isVip,
    videos_used: videosUsed,
    videos_limit: videosLimit,
    allow_async_parallel: allowAsyncParallel,
    api_key: activeApiKey || keys[0]?.secret_key || null,
    email: normalizedEmail
  };
}

/**
 * Descuenta 1 crédito de forma idempotente usando project_signature
 */
async function consumeSubscriptionQuota(user_id, email, project_signature, activeApiKey = null) {
  const status = await getSubscriptionStatus(user_id, email, activeApiKey);
  const sig = project_signature || `sig_${user_id}_${Date.now()}`;

  // Verificar idempotencia
  const existing = d1_rows(
    await execute_d1_query(
      `SELECT project_signature FROM subscription_consumptions WHERE project_signature = ? LIMIT 1`,
      [sig]
    )
  );

  if (existing.length > 0) {
    return {
      success: true,
      idempotent_replay: true,
      ...status
    };
  }

  // Verificar límite si no es ilimitado (-1) y no es VIP
  if (!status.is_vip && status.videos_limit !== -1 && status.videos_used >= status.videos_limit) {
    return {
      success: false,
      error: 'Has alcanzado el límite mensual de tu plan. Actualiza a Creator o Pro.',
      ...status
    };
  }

  const nowIso = new Date().toISOString();
  await execute_d1_query(
    `INSERT OR IGNORE INTO subscription_consumptions (project_signature, user_id, consumed_at) VALUES (?, ?, ?)`,
    [sig, user_id, nowIso]
  );

  const newUsed = status.videos_used + 1;
  await execute_d1_query(
    `UPDATE user_subscriptions SET videos_used = ?, updated_at = ? WHERE user_id = ?`,
    [newUsed, nowIso, user_id]
  );

  return {
    success: true,
    idempotent_replay: false,
    ...status,
    videos_used: newUsed
  };
}

/**
 * Verifica firma HMAC-SHA256 de Stripe Webhook (Stripe-Signature: t=...,v1=...)
 */
function verifyStripeSignature(rawPayload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = String(sigHeader).split(',');
  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${rawPayload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

async function stripeSubscriptionRoutes(fastify) {
  /**
   * GET /api/subscription/status
   * Devuelve {plan, status, is_vip, videos_used, videos_limit, allow_async_parallel, api_key, email}
   */
  fastify.get('/api/subscription/status', { preHandler: [require_auth] }, async (request) => {
    const { user_id, user_email, user_data } = request.g;
    return await getSubscriptionStatus(user_id, user_email, user_data?.api_key);
  });

  /**
   * POST /api/subscription/consume
   * Descuenta 1 crédito de forma idempotente usando project_signature
   */
  fastify.post('/api/subscription/consume', { preHandler: [require_auth] }, async (request, reply) => {
    const { user_id, user_email, user_data } = request.g;
    const { project_signature } = request.body || {};

    const result = await consumeSubscriptionQuota(user_id, user_email, project_signature, user_data?.api_key);
    if (!result.success) {
      return reply.code(402).send(result);
    }
    return result;
  });

  /**
   * POST /api/subscription/create-checkout
   * Integración con Stripe Checkout API
   */
  fastify.post('/api/subscription/create-checkout', { preHandler: [require_auth] }, async (request, reply) => {
    const cfg = getAppConfig(request.headers.host, request.headers['x-forwarded-proto'] || request.protocol);
    const { user_id, user_email } = request.g;
    const { plan = 'creator' } = request.body || {};

    const normalizedPlan = String(plan).toLowerCase() === 'pro' ? 'pro' : 'creator';
    const priceId = normalizedPlan === 'pro'
      ? cfg.STRIPE_PRICE_ID_PRO_MONTHLY
      : cfg.STRIPE_PRICE_ID_CREATOR_MONTHLY;

    // Si Stripe está configurado con llaves reales, crear sesión en https://api.stripe.com/v1/checkout/sessions
    const hasRealStripe =
      cfg.STRIPE_SECRET_KEY &&
      !cfg.STRIPE_SECRET_KEY.endsWith('...') &&
      priceId &&
      !priceId.endsWith('...');

    if (hasRealStripe) {
      const form = new URLSearchParams({
        'mode': 'subscription',
        'customer_email': user_email,
        'client_reference_id': user_id,
        'success_url': `${cfg.FRONTEND_URL}/profile?checkout=success&plan=${normalizedPlan}`,
        'cancel_url': `${cfg.FRONTEND_URL}/profile?checkout=cancel`,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'metadata[user_id]': user_id,
        'metadata[plan]': normalizedPlan
      });

      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      });
      const data = await res.json();
      if (!res.ok) {
        return reply.code(400).send({ error: data?.error?.message || 'Error creando sesión de Stripe' });
      }
      return { checkout_url: data.url, session_id: data.id };
    }

    // Modo Sandbox / Desarrollo cuando Stripe aún tiene placeholders en .env: activa el plan elegido y redirige
    const rules = PLAN_CONFIG[normalizedPlan];
    const nowIso = new Date().toISOString();
    await execute_d1_query(
      `INSERT OR REPLACE INTO user_subscriptions (
        user_id, email, plan, status, videos_used, videos_limit, allow_async_parallel, updated_at
      ) VALUES (
        ?, ?, ?, 'active',
        COALESCE((SELECT videos_used FROM user_subscriptions WHERE user_id = ?), 0),
        ?, ?, ?
      )`,
      [
        user_id,
        user_email,
        normalizedPlan,
        user_id,
        rules.videos_limit,
        rules.allow_async_parallel ? 1 : 0,
        nowIso
      ]
    );

    return {
      checkout_url: `${cfg.FRONTEND_URL}/profile?checkout=success&plan=${normalizedPlan}`,
      sandbox_activated: true,
      plan: normalizedPlan
    };
  });

  /**
   * POST /api/subscription/webhook
   * Webhook de Stripe con verificación HMAC-SHA256
   */
  fastify.post('/api/subscription/webhook', async (request, reply) => {
    const cfg = getAppConfig();
    const sigHeader = request.headers['stripe-signature'];
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});

    if (cfg.STRIPE_WEBHOOK_SECRET && !cfg.STRIPE_WEBHOOK_SECRET.endsWith('...')) {
      const valid = verifyStripeSignature(rawBody, sigHeader, cfg.STRIPE_WEBHOOK_SECRET);
      if (!valid) {
        return reply.code(400).send({ error: 'Invalid Stripe webhook signature' });
      }
    }

    const event = typeof request.body === 'object' ? request.body : JSON.parse(rawBody);
    const eventType = event?.type;
    const obj = event?.data?.object || {};

    if (eventType === 'checkout.session.completed' || eventType === 'invoice.paid') {
      const userId = obj.client_reference_id || obj.metadata?.user_id;
      const email = obj.customer_email || obj.customer_details?.email || '';
      const plan = (obj.metadata?.plan || 'pro').toLowerCase();
      const rules = PLAN_CONFIG[plan] || PLAN_CONFIG.pro;

      if (userId) {
        await execute_d1_query(
          `INSERT OR REPLACE INTO user_subscriptions (
            user_id, email, plan, status, stripe_customer_id, stripe_subscription_id,
            videos_used, videos_limit, allow_async_parallel, updated_at
          ) VALUES (?, ?, ?, 'active', ?, ?, 0, ?, ?, ?)`,
          [
            userId,
            email.toLowerCase(),
            rules.plan,
            obj.customer || null,
            obj.subscription || null,
            rules.videos_limit,
            rules.allow_async_parallel ? 1 : 0,
            new Date().toISOString()
          ]
        );
      }
    } else if (eventType === 'customer.subscription.deleted') {
      const subId = obj.id;
      if (subId) {
        await execute_d1_query(
          `UPDATE user_subscriptions SET plan = 'free', status = 'canceled', videos_limit = 10, allow_async_parallel = 0, updated_at = ? WHERE stripe_subscription_id = ?`,
          [new Date().toISOString(), subId]
        );
      }
    }

    return { received: true };
  });
}

module.exports = {
  PLAN_CONFIG,
  getSubscriptionStatus,
  consumeSubscriptionQuota,
  verifyStripeSignature,
  stripeSubscriptionRoutes
};
