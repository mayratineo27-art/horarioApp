self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Mya Dynamics', body: 'Tienes una nueva notificacion.', icon: '/icons/icon-192.svg', badge: '/icons/badge-72.svg', data: { url: '/' } };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    // Keep default payload when push body is not valid JSON.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: payload.data,
      vibrate: [120, 50, 120],
      tag: 'mya-dynamics-reminder',
      renotify: true,
      silent: false,
    }).then(() => {
      // Notify any open clients to play a sound (service workers cannot play audio directly)
      return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        for (const client of clients) {
          try {
            client.postMessage({ type: 'play-sound' });
          } catch (e) {
            // ignore
          }
        }
      });
    }).catch(err => {
      console.error('Notification error:', err);
    })
  );
});
// Note: audio playback must be performed on a client page; service workers cannot play audio directly.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
