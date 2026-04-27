const fp = require('fastify-plugin');
const { Server } = require('socket.io');

module.exports = fp(async function (fastify, opts) {
  const io = new Server(fastify.server, {
    cors: {
      origin: '*', // TODO: restrict in production
      methods: ['GET', 'POST']
    }
  });

  fastify.decorate('io', io);

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);

    // Join a specific channel/room for chat or alerts
    socket.on('join_channel', (channelId) => {
      socket.join(channelId);
      fastify.log.info(`Socket ${socket.id} joined channel ${channelId}`);
    });

    // Broadcast a new message to everyone in the channel
    socket.on('send_message', (data) => {
      // data: { channelId, message }
      io.to(data.channelId).emit('new_message', data.message);
    });

    // Alert broadcasts
    socket.on('trigger_alert', (alertData) => {
      // Broadcast to all connected clients that a new alert is active
      socket.broadcast.emit('new_alert', alertData);
    });

    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });
});
