const webpush = require('web-push');
const { execute_d1_query, d1_rows } = require('../cloudflare_db');

module.exports = async function (fastify, opts) {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:admin@mineralert.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  }

  fastify.post('/broadcast', async (request, reply) => {
    const { alert } = request.body || {};

    if (!alert || !alert.id) {
      return reply.code(400).send({ error: 'Falta la información de la alerta.' });
    }

    try {
      const res = await execute_d1_query(
        `SELECT * FROM push_subscriptions WHERE user_id != ?`,
        [alert.user_id || '00000000-0000-0000-0000-000000000000']
      );
      const subscriptions = d1_rows(res);

      if (!subscriptions || subscriptions.length === 0) {
        return { success: true, message: 'No devices to notify.' };
      }

      const pushPayload = JSON.stringify({
        title: '⚠️ ¡ALERTA MinerAlert!',
        body: alert.description || '¡Se ha reportado una nueva amenaza de seguridad!',
        alertId: alert.id,
        lat: alert.latitude,
        lng: alert.longitude,
        desc: alert.description,
        icon: alert.avatar_url
      });

      let sentCount = 0;
      let expiredCount = 0;

      const pushPromises = subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload);
          sentCount++;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            expiredCount++;
            await execute_d1_query(`DELETE FROM push_subscriptions WHERE id = ?`, [sub.id]);
          } else {
            fastify.log.error(`Error sending push to ${sub.id}:`, err);
          }
        }
      });

      await Promise.all(pushPromises);

      fastify.log.info(`Push notifications sent: ${sentCount}. Expired removed: ${expiredCount}`);
      return { success: true, sent: sentCount, removed: expiredCount };
    } catch (err) {
      fastify.log.error('Unhandled error in /broadcast:', err);
      return reply.code(500).send({ error: 'Internal server error.' });
    }
  });

  fastify.post('/broadcast-chat', async (request, reply) => {
    const { message } = request.body || {};

    if (!message || !message.id) {
      return reply.code(400).send({ error: 'Falta la información del mensaje.' });
    }

    try {
      const res = await execute_d1_query(
        `SELECT * FROM push_subscriptions WHERE user_id != ?`,
        [message.user_id || '00000000-0000-0000-0000-000000000000']
      );
      const subscriptions = d1_rows(res);

      if (!subscriptions || subscriptions.length === 0) {
        return { success: true, message: 'No devices to notify.' };
      }

      const pushPayload = JSON.stringify({
        title: `💬 ${message.sender_name || 'Alguien'}`,
        body: message.content || 'Nuevo mensaje',
        messageId: message.id,
        channelId: message.channel_id,
        icon: message.avatar_url || '/pwa-192x192.png',
        type: 'chat'
      });

      let sentCount = 0;
      let expiredCount = 0;

      const pushPromises = subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, pushPayload);
          sentCount++;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            expiredCount++;
            await execute_d1_query(`DELETE FROM push_subscriptions WHERE id = ?`, [sub.id]);
          } else {
            fastify.log.error(`Error sending push to ${sub.id}:`, err);
          }
        }
      });

      await Promise.all(pushPromises);

      fastify.log.info(`Chat push notifications sent: ${sentCount}. Expired removed: ${expiredCount}`);
      return { success: true, sent: sentCount, removed: expiredCount };
    } catch (err) {
      fastify.log.error('Unhandled error in /broadcast-chat:', err);
      return reply.code(500).send({ error: 'Internal server error.' });
    }
  });
};
