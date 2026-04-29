const path = require('path');
const fs = require('fs');
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const helmet = require('helmet');
const rateLimit = require('@fastify/rate-limit');
require('dotenv').config();

const socketPlugin = require('./plugins/socket');
const pushRoutes = require('./routes/push');
const setupPushListener = require('./pushListener');

// Check if we have a built frontend to serve
const publicDir = path.join(__dirname, '../public');
const hasFrontend = fs.existsSync(publicDir);

async function start() {
  try {
    // Middlewares
    // In production the frontend is served from the same origin — no CORS needed
    // In development allow local Vite dev server
    if (process.env.NODE_ENV !== 'production') {
      await fastify.register(cors, {
        origin: ['http://localhost:5173', 'http://localhost:4173'],
        credentials: true,
      });
    }

    await fastify.register(helmet, {
      // Allow serving frontend HTML
      contentSecurityPolicy: false,
    });
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });

    // Plugins
    await fastify.register(socketPlugin);

    // API Routes
    await fastify.register(pushRoutes, { prefix: '/api/push' });

    fastify.get('/api/health', async () => ({ status: 'MinerAlert OK' }));

    // Start background push notification listener
    setupPushListener(fastify);

    // Serve built frontend static files (production)
    if (hasFrontend) {
      await fastify.register(require('@fastify/static'), {
        root: publicDir,
        prefix: '/',
        decorateReply: false,
      });

      // SPA fallback — React Router handles all non-API routes
      fastify.setNotFoundHandler((request, reply) => {
        if (request.url.startsWith('/api/') || request.url.startsWith('/socket.io/')) {
          reply.status(404).send({ error: 'Not found' });
        } else {
          reply.sendFile('index.html', publicDir);
        }
      });
    }

    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`🚀 MinerAlert running on http://localhost:${port}`);
    fastify.log.info(`📁 Serving frontend: ${hasFrontend ? 'YES' : 'NO (dev mode)'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

