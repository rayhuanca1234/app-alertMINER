const path = require('path');
const fs = require('fs');
const fastify = require('fastify')({
  logger: true,
  bodyLimit: 60 * 1024 * 1024 // 60 MB para subida de videos / fotos a R2
});
const cors = require('@fastify/cors');
const helmet = require('helmet');
const rateLimit = require('@fastify/rate-limit');
const fastifyStatic = require('@fastify/static');

const { getAppConfig } = require('./app_config');
const { init_d1_tables, isD1Configured } = require('./cloudflare_db');
const { cloudflareAuthRoutes } = require('./cloudflare_auth');
const { stripeSubscriptionRoutes } = require('./backend_stripe_subscription');
const { userToolsRoutes } = require('./routes/user_tools_routes');
const { LOCAL_UPLOAD_DIR } = require('./storage_service');
const socketPlugin = require('./plugins/socket');
const pushRoutes = require('./routes/push');

// Check if we have a built frontend to serve
const publicDir = path.join(__dirname, '../public');
const hasFrontend = fs.existsSync(publicDir);

async function start() {
  try {
    // 1. Inicializar automáticamente las tablas en Cloudflare D1 (y SQLite local de respaldo)
    await init_d1_tables();

    // 2. Middlewares CORS y Seguridad
    await fastify.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    await fastify.register(helmet, {
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    });

    await fastify.register(rateLimit, {
      max: 300,
      timeWindow: '1 minute'
    });

    // 3. Plugins (Socket.IO Realtime)
    await fastify.register(socketPlugin);

    // 4. Servir archivos subidos localmente cuando R2 está en modo fallback local
    if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
      fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
    }
    await fastify.register(fastifyStatic, {
      root: LOCAL_UPLOAD_DIR,
      prefix: '/uploads/',
      decorateReply: !hasFrontend
    });

    // 5. Registrar los 7 Módulos Core (Auth OAuth 2.0 + JWT/fr_..., Suscripciones Stripe/VIP, Herramientas y D1/R2)
    await fastify.register(cloudflareAuthRoutes);
    await fastify.register(stripeSubscriptionRoutes);
    await fastify.register(userToolsRoutes);
    await fastify.register(pushRoutes, { prefix: '/api/push' });

    fastify.get('/api/health', async (req) => {
      const cfg = getAppConfig(req.headers.host, req.headers['x-forwarded-proto'] || req.protocol);
      return {
        status: 'MinerAlert OK',
        engine: 'Cloudflare D1 + R2 + Google OAuth 2.0',
        d1_configured: isD1Configured(),
        is_production: cfg.IS_PRODUCTION
      };
    });

    // 6. Serve built frontend static files (production)
    if (hasFrontend) {
      await fastify.register(fastifyStatic, {
        root: publicDir,
        prefix: '/',
        decorateReply: true
      });

      // SPA fallback — React Router handles all non-API routes
      fastify.setNotFoundHandler((request, reply) => {
        if (
          request.url.startsWith('/api/') ||
          request.url.startsWith('/socket.io/') ||
          request.url.startsWith('/uploads/')
        ) {
          reply.status(404).send({ error: 'Not found' });
        } else {
          reply.sendFile('index.html');
        }
      });
    }

    const cfg = getAppConfig();
    const port = Number(cfg.PORT) || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`🚀 MinerAlert (100% Cloudflare D1 + R2) running on http://localhost:${port}`);
    fastify.log.info(`🔗 OAuth Callback URI: ${cfg.GOOGLE_REDIRECT_URI}`);
    fastify.log.info(`📁 Serving frontend: ${hasFrontend ? 'YES' : 'NO (dev mode)'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
