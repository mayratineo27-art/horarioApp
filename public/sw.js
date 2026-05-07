self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Determines vibration pattern based on activity type and time until activity
 * Exercises get priority: more intense vibration pattern
 */
function getVibrationPattern(payload) {
  const activityName = payload.body || '';
  const isExercise = 
    activityName.toLowerCase().includes('ejercicio') ||
    activityName.toLowerCase().includes('piernas') ||
    activityName.toLowerCase().includes('glúteos') ||
    activityName.toLowerCase().includes('gluteos') ||
    payload.data?.isExercise === true;

  if (isExercise) {
    // Extra intense vibration for exercise (💪)
    return [300, 100, 300, 100, 300]; // Stronger pattern
  }

  // Standard vibration for other activities
  return [200, 80, 200, 80, 200];
}

/**
 * Determines audio cue based on minutes until activity
 * 90 min: gentle beep
 * 30 min: medium alert
 * 10 min: urgent alert
 */
function getSoundTag(minutesUntilActivity) {
  if (minutesUntilActivity === 90 || minutesUntilActivity === '90') {
    return 'sound-90-min'; // Gentle beep
  }
  if (minutesUntilActivity === 30 || minutesUntilActivity === '30') {
    return 'sound-30-min'; // Medium alert
  }
  if (minutesUntilActivity === 10 || minutesUntilActivity === '10') {
    return 'sound-10-min'; // Urgent alert
  }
  return 'sound-default';
}

self.addEventListener('push', (event) => {
  // Default payload with fallback structure
  let payload = {
    title: 'Mya Dynamics',
    body: 'Tienes una notificación de actividad próxima.',
    icon: '/icons/icon-192.svg',
    badge: '/icons/badge-72.svg',
    data: { 
      url: '/', 
      activityId: null, 
      activityTime: null,
      minutesUntil: null,
      isExercise: false,
    },
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

  const activityName = payload.body || '';
  const isExercise = 
    activityName.toLowerCase().includes('ejercicio') ||
    activityName.toLowerCase().includes('piernas') ||
    activityName.toLowerCase().includes('glúteos') ||
    activityName.toLowerCase().includes('gluteos');

  const vibrationPattern = getVibrationPattern(payload);
  const soundTag = getSoundTag(payload.data?.minutesUntil);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: payload.data || {},
      vibrate: vibrationPattern,
      tag: soundTag, // Use sound tag for grouping notifications by time window
      renotify: true,
      silent: false,
      requireInteraction: true, // Force user to interact; don't auto-dismiss
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
    }).then(() => {
      console.log('[SW] Notification shown:', {
        title: payload.title,
        body: payload.body,
        isExercise,
        vibration: vibrationPattern,
        soundTag,
      });
      
      // Notify any open clients to play a sound based on time window
      return self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        for (const client of clients) {
          try {
            client.postMessage({ 
              type: 'play-sound',
              soundTag,
              activityId: payload.data?.activityId,
              isExercise,
              minutesUntil: payload.data?.minutesUntil,
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
