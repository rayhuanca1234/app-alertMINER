module.exports = async function (fastify, opts) {
  fastify.post('/', async (request, reply) => {
    const { title, body, subscriptions } = request.body;
    
    // Aquí se implementaría web-push para notificar a los PWA subscriptions
    // Ejemplo:
    // subscriptions.forEach(sub => webpush.sendNotification(sub, payload));

    return { success: true, message: 'Push notifications sent (mock)' };
  });
};
