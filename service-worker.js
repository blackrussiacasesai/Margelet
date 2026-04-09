self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (_error) {
        payload = {
            title: 'Новое сообщение',
            body: event.data ? String(event.data.text() || '') : ''
        };
    }

    const title = String(payload.title || 'Новое сообщение');
    const body = String(payload.body || 'Откройте чат, чтобы прочитать сообщение');
    const conversationId = String(payload.conversationId || '').trim();
    const baseUrl = String(payload.url || self.location.origin + '/');

    const options = {
        body,
        icon: 'icons/ymusic.png',
        badge: 'icons/ymusic.png',
        tag: 'chat-' + String(conversationId || 'generic'),
        renotify: true,
        data: {
            conversationId,
            url: baseUrl
        }
    };

    if (Array.isArray(payload.vibrate)) {
        options.vibrate = payload.vibrate;
    }

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification?.data || {};
    const conversationId = String(data.conversationId || '').trim();
    const baseUrl = String(data.url || self.location.origin + '/');
    const targetUrl = conversationId
        ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'openConversation=' + encodeURIComponent(conversationId)
        : baseUrl;

    event.waitUntil((async () => {
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

        for (const client of windowClients) {
            const sameOrigin = typeof client.url === 'string' && client.url.startsWith(self.location.origin);
            if (!sameOrigin) continue;

            try {
                await client.focus();
            } catch (_error) {
                // ignore focus errors
            }

            if (conversationId) {
                client.postMessage({
                    type: 'OPEN_CONVERSATION',
                    conversationId
                });
            }
            return;
        }

        await self.clients.openWindow(targetUrl);
    })());
});
