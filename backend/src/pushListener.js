const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

function setupPushListener(fastify) {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    fastify.log.warn('⚠️ Web Push VAPID keys not configured. Push notifications are disabled.');
    return;
  }

  webpush.setVapidDetails(
    'mailto:admin@mineralert.com', // Change this to your actual email
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    fastify.log.warn('⚠️ Supabase URL or Service Role Key missing. Cannot listen for alerts.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  fastify.log.info('🎧 Setting up Supabase Realtime listener for Web Push Notifications...');

  const channel = supabase.channel('push-notifications-listener');

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'alerts' },
    async (payload) => {
      const alert = payload.new;
      fastify.log.info(`🔔 New alert detected (ID: ${alert.id}). Sending push notifications...`);

      try {
        // Fetch all subscriptions EXCEPT the user who created the alert
        const { data: subscriptions, error } = await supabase
          .from('push_subscriptions')
          .select('*')
          .neq('user_id', alert.user_id);

        if (error) {
          fastify.log.error('Error fetching subscriptions:', error);
          return;
        }

        if (!subscriptions || subscriptions.length === 0) {
          fastify.log.info('No other users subscribed for push notifications.');
          return;
        }

        const pushPayload = JSON.stringify({
          title: '⚠️ ¡ALERTA MinerAlert!',
          body: alert.description || '¡Se ha reportado una nueva amenaza de seguridad!',
          alertId: alert.id,
          lat: alert.latitude,
          lng: alert.longitude,
          desc: alert.description
        });

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
          } catch (err) {
            // If subscription is invalid/expired (status 410), delete it
            if (err.statusCode === 410 || err.statusCode === 404) {
              fastify.log.info(`Subscription ${sub.id} expired. Removing from database.`);
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            } else {
              fastify.log.error(`Error sending push to ${sub.id}:`, err);
            }
          }
        });

        await Promise.all(pushPromises);
        fastify.log.info(`✅ Push notifications sent to ${subscriptions.length} devices.`);
      } catch (err) {
        fastify.log.error('Unhandled error in push notification listener:', err);
      }
    }
  ).subscribe((status, err) => {
    if (err) {
      fastify.log.error('Error subscribing to push notifications channel:', err);
    } else {
      fastify.log.info(`Push listener status: ${status}`);
    }
  });
}

module.exports = setupPushListener;
