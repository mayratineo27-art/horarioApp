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
      // Reproduce magic sound using Web Audio API
      playMagicSound();
    }).catch(err => {
      console.error('Notification error:', err);
    })
  );
});

function playMagicSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Create a sparkle/magic sound effect using oscillators
    const createNote = (freq, duration, startTime) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    // Magic chord progression (C major arpeggio with sparkles)
    const notes = [
      { freq: 523.25, duration: 0.1, delay: 0 },      // C5
      { freq: 659.25, duration: 0.1, delay: 0.08 },   // E5
      { freq: 783.99, duration: 0.1, delay: 0.16 },   // G5
      { freq: 1046.5, duration: 0.15, delay: 0.24 },  // C6
      { freq: 1174.66, duration: 0.2, delay: 0.28 },  // D6
    ];
    
    notes.forEach(note => {
      createNote(note.freq, note.duration, now + note.delay);
    });
  } catch (err) {
    console.log('Sound play failed (expected on some devices):', err);
  }
}

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
