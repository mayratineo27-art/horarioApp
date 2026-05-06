export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  return registration;
}

async function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || '';
}

async function getApiToken() {
  return import.meta.env.VITE_PUSH_API_TOKEN || '';
}

async function buildHeaders(extraHeaders: Record<string, string> = {}) {
  const token = await getApiToken();
  return {
    ...extraHeaders,
    ...(token ? { 'x-mya-push-token': token } : {}),
  };
}

export async function getVapidPublicKey(): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/push/public-key`);
  if (!res.ok) {
    throw new Error('No se pudo leer la VAPID key del backend.');
  }
  const data = (await res.json()) as { publicKey: string };
  return data.publicKey;
}

export async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  const vapidPublicKey = await getVapidPublicKey();
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });
}

export async function syncSubscriptionToBackend(payload: {
  subscription: PushSubscription;
  timezone: string;
  schedule: unknown;
}) {
  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/push/subscribe`, {
    method: 'POST',
    headers: await buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('No se pudo guardar la suscripcion en backend.');
  }
}

export async function syncNotificationHours(notificationHourStart: number, notificationHourEnd: number) {
  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/push/notification-hours`, {
    method: 'POST',
    headers: await buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ notificationHourStart, notificationHourEnd }),
  });

  if (!res.ok) {
    throw new Error('No se pudieron guardar las horas de notificacion en backend.');
  }
}

export async function syncScheduleToBackend(payload: { timezone: string; schedule: unknown }) {
  const baseUrl = await getApiBaseUrl();
  await fetch(`${baseUrl}/api/push/schedule`, {
    method: 'POST',
    headers: await buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
}

export async function sendTestPush() {
  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/push/test`, {
    method: 'POST',
    headers: await buildHeaders(),
  });
  if (!res.ok) {
    throw new Error('No se pudo enviar la notificacion de prueba.');
  }
}
