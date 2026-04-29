const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function (fastify, opts) {
  // Configurar web-push
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:admin@mineralert.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  }

  fastify.post('/broadcast', async (request, reply) => {
    const { alert } = request.body;

    if (!alert || !alert.id) {
      return reply.code(400).send({ error: 'Falta la información de la alerta.' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return reply.code(500).send({ error: 'Supabase admin keys not configured.' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      // Buscar suscripciones excepto la del usuario que envió la alerta
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .neq('user_id', alert.user_id || '00000000-0000-0000-0000-000000000000');

      if (error) {
        fastify.log.error('Error fetching subscriptions:', error);
        return reply.code(500).send({ error: 'Failed to fetch subscriptions.' });
      }

      if (!subscriptions || subscriptions.length === 0) {
        return { success: true, message: 'No devices to notify.' };
      }

      const pushPayload = JSON.stringify({
        title: '⚠️ ¡ALERTA MinerAlert!',
        body: alert.description || '¡Se ha reportado una nueva amenaza de seguridad!',
        alertId: alert.id,
        lat: alert.latitude,
        lng: alert.longitude,
        desc: alert.description
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
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
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
};
