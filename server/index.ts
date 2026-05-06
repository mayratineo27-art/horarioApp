import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import cron from 'node-cron';
import webpush from 'web-push';
import { loadConfig, saveConfig, initializeDatabase, type DaySchedule } from './supabase.js';

dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.PORT || 8787);
const PUSH_API_TOKEN = process.env.PUSH_API_TOKEN || '';
const WINDOWS = [90, 30, 10] as const;

function normalizeDay(day: string): string {
  return day
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getLocalParts(timezone: string) {
  const now = new Date();
  const day = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: timezone }).format(now);
  const hh = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: timezone }).format(now));
  const mm = Number(new Intl.DateTimeFormat('en-GB', { minute: '2-digit', hour12: false, timeZone: timezone }).format(now));
  const yyyy = Number(new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: timezone }).format(now));
  const month = Number(new Intl.DateTimeFormat('en-CA', { month: '2-digit', timeZone: timezone }).format(now));
  const dd = Number(new Intl.DateTimeFormat('en-CA', { day: '2-digit', timeZone: timezone }).format(now));
  const dateKey = `${yyyy}-${String(month).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return { day, hh, mm, dateKey };
}

function toTotalMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

async function sendPush(subscription: webpush.PushSubscription, title: string, body: string) {
  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      title,
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: '/' },
    }),
  );
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn('Missing VAPID keys. Generate them with: npx web-push generate-vapid-keys');
} else {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:you@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function requirePushToken(req: express.Request, res: express.Response): boolean {
  if (!PUSH_API_TOKEN) {
    return true;
  }

  const token = req.header('x-mya-push-token');
  if (token !== PUSH_API_TOKEN) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }

  return true;
}

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'Mya Dynamics Backend', version: '1.0.0', endpoints: ['/api/health', '/api/push/public-key', '/api/push/subscribe', '/api/push/schedule', '/api/push/test'] });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Backend online' });
});

app.get('/api/push/public-key', (_req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    res.status(500).json({ ok: false, error: 'VAPID_PUBLIC_KEY missing in server env' });
    return;
  }
  res.json({ ok: true, publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', async (req, res) => {
  if (!requirePushToken(req, res)) {
    return;
  }

  const { subscription, timezone, schedule } = req.body as {
    subscription?: webpush.PushSubscription;
    timezone?: string;
    schedule?: DaySchedule[];
  };

  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ ok: false, error: 'Invalid subscription' });
    return;
  }

  try {
    const config = await loadConfig();
    config.subscription = subscription;
    config.timezone = timezone || config.timezone || 'America/Santo_Domingo';
    if (Array.isArray(schedule)) {
      config.schedule = schedule;
    }
    await saveConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ ok: false, error: 'Failed to save subscription' });
  }
});

app.post('/api/push/schedule', async (req, res) => {
  if (!requirePushToken(req, res)) {
    return;
  }

  const { schedule, timezone } = req.body as {
    schedule?: DaySchedule[];
    timezone?: string;
  };

  if (!Array.isArray(schedule)) {
    res.status(400).json({ ok: false, error: 'schedule is required' });
    return;
  }

  try {
    const config = await loadConfig();
    config.schedule = schedule;
    if (timezone) {
      config.timezone = timezone;
    }
    await saveConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving schedule:', error);
    res.status(500).json({ ok: false, error: 'Failed to save schedule' });
  }
});

app.post('/api/push/test', async (_req, res) => {
  if (!requirePushToken(_req, res)) {
    return;
  }

  try {
    const config = await loadConfig();
    if (!config.subscription) {
      res.status(400).json({ ok: false, error: 'No subscription saved yet' });
      return;
    }

    await sendPush(config.subscription, 'Mya Dynamics', 'Notificacion de prueba enviada desde backend.');
    res.json({ ok: true });
  } catch (error) {
    console.error('Error sending test push:', error);
    res.status(500).json({ ok: false, error: 'Failed to send push' });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const config = await loadConfig();
    if (!config.subscription || !config.schedule.length || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return;
    }

    const { day, hh, mm, dateKey } = getLocalParts(config.timezone || 'America/Santo_Domingo');
    const today = config.schedule.find((d) => normalizeDay(d.day) === normalizeDay(day));
    if (!today) {
      return;
    }

    const nowTotal = hh * 60 + mm;
    const sentMap = config.sentByDate[dateKey] || {};
    let changed = false;

    for (const activity of today.activities) {
      const startTotal = toTotalMinutes(activity.startTime);
      const diff = startTotal - nowTotal;

      for (const win of WINDOWS) {
        const key = `${activity.id}_${win}`;
        if (diff !== win || sentMap[key]) {
          continue;
        }

        try {
          const body = `Faltan ${win} minutos para: ${activity.name}`;
          await sendPush(config.subscription, `Aviso ${win} min`, body);
          sentMap[key] = true;
          changed = true;
        } catch (error: any) {
          if (error?.statusCode === 410 || error?.statusCode === 404) {
            config.subscription = null;
            changed = true;
          }
        }
      }
    }

    const prunedSentByDate: Record<string, Record<string, boolean>> = {};
    prunedSentByDate[dateKey] = sentMap;

    if (changed || JSON.stringify(config.sentByDate) !== JSON.stringify(prunedSentByDate)) {
      config.sentByDate = prunedSentByDate;
      await saveConfig(config);
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});

app.listen(PORT, async () => {
  try {
    await initializeDatabase();
    console.log(`Backend listening on http://localhost:${PORT}`);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
});
