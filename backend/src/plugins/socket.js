const fp = require('fastify-plugin');
const { Server } = require('socket.io');

module.exports = fp(async function (fastify, opts) {
  const io = new Server(fastify.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  fastify.decorate('io', io);

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);

    // Join a specific channel/room for chat, alerts, or global notifications
    socket.on('join_channel', (channelId) => {
      socket.join(channelId);
      fastify.log.info(`Socket ${socket.id} joined channel ${channelId}`);
    });

    socket.on('leave_channel', (channelId) => {
      socket.leave(channelId);
    });

    // Generic realtime broadcast relay (replaces Supabase Realtime Broadcast)
    socket.on('realtime_broadcast', (data) => {
      // data: { channel, event, payload }
      if (!data || !data.channel || !data.event) return;
      io.to(data.channel).emit('realtime_event', {
        channel: data.channel,
        event: data.event,
        payload: data.payload
      });
    });

    // Legacy chat message event
    socket.on('send_message', (data) => {
      if (data?.channelId) {
        io.to(data.channelId).emit('new_message', data.message);
      }
    });

    // Legacy alert broadcast event
    socket.on('trigger_alert', (alertData) => {
      socket.broadcast.emit('new_alert', alertData);
    });

    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });
});
