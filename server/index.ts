import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import cron from 'node-cron';
import webpush from 'web-push';
import {
  loadConfig,
  saveConfig,
  initializeDatabase,
  loadCourses,
  saveCourses,
  saveCourseChecklist,
  saveSubscriptionToSupabase,
  updateLastResetDate,
  type DaySchedule,
  type CourseRecord,
  type CourseTaskItem,
  type PushSubscriptionPayload,
} from './supabase.js';

dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.PORT || 8787);
const PUSH_API_TOKEN = process.env.PUSH_API_TOKEN || '';
const COURSE_USER_KEY = process.env.COURSE_USER_KEY || 'anonimo';
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

async function sendPush(subscription: PushSubscriptionPayload, title: string, body: string) {
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

  const { subscription, timezone, schedule, userId } = req.body as {
    subscription?: PushSubscriptionPayload;
    timezone?: string;
    schedule?: DaySchedule[];
    userId?: string;
  };

  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ ok: false, error: 'Invalid subscription: missing endpoint', received: !!subscription });
    return;
  }

  try {
    // Use userId if provided, otherwise fall back to COURSE_USER_KEY for backward compatibility
    const userKey = userId || COURSE_USER_KEY;
    await saveSubscriptionToSupabase(userKey, subscription, timezone || 'America/Santo_Domingo');
    
    // Also update local config for immediate availability (backward compatibility)
    const config = await loadConfig();
    config.subscription = subscription;
    config.timezone = timezone || config.timezone || 'America/Santo_Domingo';
    if (Array.isArray(schedule)) {
      config.schedule = schedule;
    }
    await saveConfig(config);
    
    console.log(`[✓] Push subscription registered for user: ${userKey} | timezone: ${config.timezone}`);
    res.json({ ok: true, message: 'Subscription saved and active for push notifications', userKey });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to save subscription',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/push/schedule', async (req, res) => {
  if (!requirePushToken(req, res)) {
    return;
  }

  const { schedule, timezone, userId } = req.body as {
    schedule?: DaySchedule[];
    timezone?: string;
    userId?: string;
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

app.post('/api/push/test', async (req, res) => {
  if (!requirePushToken(req, res)) {
    return;
  }

  const { userId } = req.body as { userId?: string };

  try {
    const config = await loadConfig();
    const subscription = config.subscription as PushSubscriptionPayload | null;
    if (!subscription?.endpoint) {
      res.status(400).json({ ok: false, error: 'No subscription saved yet' });
      return;
    }

    await sendPush(subscription, 'Mya Dynamics', 'Notificacion de prueba enviada desde backend.');
    res.json({ ok: true, userId: userId || 'anonymous' });
  } catch (error) {
    console.error('Error sending test push:', error);
    res.status(500).json({ ok: false, error: 'Failed to send push' });
  }
});

app.post('/api/push/notification-hours', async (req, res) => {
  if (!requirePushToken(req, res)) {
    return;
  }

  const { notificationHourStart, notificationHourEnd, userId } = req.body as {
    notificationHourStart?: number;
    notificationHourEnd?: number;
    userId?: string;
  };

  if (notificationHourStart === undefined || notificationHourEnd === undefined) {
    res.status(400).json({ ok: false, error: 'notificationHourStart and notificationHourEnd are required' });
    return;
  }

  if (notificationHourStart < 0 || notificationHourStart > 23 || notificationHourEnd < 0 || notificationHourEnd > 23) {
    res.status(400).json({ ok: false, error: 'Hours must be between 0 and 23' });
    return;
  }

  try {
    const config = await loadConfig();
    config.notificationHourStart = notificationHourStart;
    config.notificationHourEnd = notificationHourEnd;
    await saveConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving notification hours:', error);
    res.status(500).json({ ok: false, error: 'Failed to save notification hours' });
  }
});

// Debug endpoint: devuelve si hay suscripción y configuración relevante
app.get('/api/push/config', async (req, res) => {
  if (!requirePushToken(req, res)) return;
  try {
    const config = await loadConfig();
    res.json({
      ok: true,
      hasSubscription: !!config.subscription,
      timezone: config.timezone,
      notificationHourStart: config.notificationHourStart ?? 7,
      notificationHourEnd: config.notificationHourEnd ?? 22,
      scheduleCount: Array.isArray(config.schedule) ? config.schedule.length : 0,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to read config' });
  }
});

app.get('/api/courses', async (req, res) => {
  if (!requirePushToken(req, res)) return;

  try {
    const courses = await loadCourses();
    res.json({ ok: true, courses });
  } catch (error) {
    console.error('Error loading courses:', error);
    res.status(500).json({ ok: false, error: 'Failed to load courses' });
  }
});

app.post('/api/courses/sync', async (req, res) => {
  if (!requirePushToken(req, res)) return;

  const { courses } = req.body as { courses?: CourseRecord[] };
  if (!Array.isArray(courses)) {
    res.status(400).json({ ok: false, error: 'courses is required' });
    return;
  }

  try {
    await saveCourses(courses);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error syncing courses:', error);
    res.status(500).json({ ok: false, error: 'Failed to sync courses' });
  }
});

app.put('/api/courses/:courseCode/checklist', async (req, res) => {
  if (!requirePushToken(req, res)) return;

  const { courseCode } = req.params;
  const { items, completed, userId } = req.body as { items?: CourseTaskItem[]; completed?: boolean; userId?: string };

  if (!Array.isArray(items)) {
    res.status(400).json({ ok: false, error: 'items is required' });
    return;
  }

  try {
    await saveCourseChecklist(courseCode, items, !!completed, userId || COURSE_USER_KEY);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving checklist:', error);
    res.status(500).json({ ok: false, error: 'Failed to save checklist' });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const config = await loadConfig();
    const subscription = config.subscription as PushSubscriptionPayload | null;
    if (!subscription?.endpoint || !config.schedule.length || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return;
    }

    const { day, hh, mm, dateKey } = getLocalParts(config.timezone || 'America/Santo_Domingo');
    
    // Check if current hour is within notification window
    const notificationStart = config.notificationHourStart ?? 7;
    const notificationEnd = config.notificationHourEnd ?? 22;
    if (hh < notificationStart || hh >= notificationEnd) {
      return;
    }
    
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
          await sendPush(subscription, `Aviso ${win} min`, body);
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

/**
 * Cron Job: Reset fixed activities every Monday at 05:00 AM (user's timezone)
 * Clears completion status for fixed routines (Ducha, Almuerzo, Clases, Ejercicio, etc.)
 * Tasks and projects are NOT reset automatically - they remain until marked complete.
 */
cron.schedule('0 5 * * 1', async () => {
  console.log('[🔄] Running Monday 05:00 reset for fixed activities...');
  try {
    const config = await loadConfig();
    const userKey = COURSE_USER_KEY;
    
    // Mark the reset date in Supabase
    await updateLastResetDate(userKey);
    
    // In a production app, you would:
    // 1. Clear completion flags in course_checklists for fixed activities
    // 2. Reset activity visibility in the database
    // 3. Send a notification to the user
    // For now, we just log it
    console.log(`[✓] Reset completed for user: ${userKey} at Monday 05:00`);
  } catch (error) {
    console.error('[✗] Error in Monday reset cron job:', error);
  }
});

app.listen(PORT, async () => {
  try {
    await initializeDatabase();
    console.log(`Backend listening on http://localhost:${PORT}`);

    // Keep server awake on Render free tier (ping every 14 minutes)
    const HEALTH_CHECK_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
    setInterval(async () => {
      try {
        await fetch(`${HEALTH_CHECK_URL}/api/health`);
        console.log('[KeepAlive] Ping enviado');
      } catch (e) {
        console.log('[KeepAlive] Error ping:', e instanceof Error ? e.message : String(e));
      }
    }, 14 * 60 * 1000); // cada 14 minutos
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
});
