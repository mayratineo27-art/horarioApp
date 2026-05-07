self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  // Default payload with fallback structure
  let payload = {
    title: 'Mya Dynamics',
    body: 'Tienes una notificación de actividad próxima.',
    icon: '/icons/icon-192.svg',
    badge: '/icons/badge-72.svg',
    data: { url: '/', activityId: null, activityTime: null },
  };

  try {
    if (event.data) {
      const incomingData = event.data.json();
      // Merge incoming data with defaults to preserve all fields
      payload = { ...payload, ...incomingData };
      if (incomingData.data) {
        payload.data = { ...payload.data, ...incomingData.data };
      }
    }
  } catch (e) {
    console.warn('[SW] Push data not JSON, using defaults:', e.message);
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: payload.data || {},
      vibrate: [200, 80, 200, 80, 200],
      tag: 'mya-dynamics-reminder',
      renotify: true,
      silent: false,
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
    }).then(() => {
      console.log('[SW] Notification shown:', payload.title);
      // Notify any open clients to play a sound (service workers cannot play audio directly)
      return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        for (const client of clients) {
          try {
            client.postMessage({ 
              type: 'play-sound',
              activityId: payload.data?.activityId,
            });
          } catch (e) {
            console.warn('[SW] Could not post message to client:', e.message);
          }
        }
      });
    }).catch(err => {
      console.error('[SW] Notification error:', err);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      // Look for an existing window to focus
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window exists, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});
