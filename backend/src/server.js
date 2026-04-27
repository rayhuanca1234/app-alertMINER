const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const helmet = require('helmet');
const rateLimit = require('@fastify/rate-limit');
require('dotenv').config();

const socketPlugin = require('./plugins/socket');
const pushRoutes = require('./routes/push');

async function start() {
  try {
    // CORS — in production restrict to the frontend domain
    const allowedOrigins = process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL]
      : ['http://localhost:5173', 'http://localhost:4173'];

    // Middlewares
    await fastify.register(cors, {
      origin: allowedOrigins,
      credentials: true,
    });
    await fastify.register(helmet);
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });

    // Plugins
    await fastify.register(socketPlugin);

    // Routes
    await fastify.register(pushRoutes, { prefix: '/api/push' });

    fastify.get('/', async (request, reply) => {
      return { status: 'MinerAlert Backend OK' };
    });

    const port = process.env.PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
