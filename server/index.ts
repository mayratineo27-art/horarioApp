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
  saveUserSettings,
  updateLastResetDate,
  type DaySchedule,
  type CourseRecord,
  type CourseTaskItem,
  type PushSubscriptionPayload,
  supabase,
} from './supabase.js';

dotenv.config({ override: true });

const app = express();
const PORT = Number(process.env.PORT || 10000);
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

  if (!userId) {
    res.status(400).json({ ok: false, error: 'userId is required' });
    return;
  }

  try {
    // Use userId from authenticated frontend
    await saveSubscriptionToSupabase(userId, subscription, timezone || 'America/Santo_Domingo');
    
    // Also update local config for immediate availability (backward compatibility)
    const config = await loadConfig(userId);
    config.subscription = subscription;
    config.timezone = timezone || config.timezone || 'America/Santo_Domingo';
    if (Array.isArray(schedule)) {
      config.schedule = schedule;
    }
    await saveConfig(config, userId);
    
    console.log(`[✓] Push subscription registered for user: ${userId} | timezone: ${config.timezone}`);
    res.json({ ok: true, message: 'Subscription saved and active for push notifications', userKey: userId });
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

  if (!userId) {
    res.status(400).json({ ok: false, error: 'userId is required' });
    return;
  }

  try {
    const config = await loadConfig(userId);
    config.schedule = schedule;
    if (timezone) {
      config.timezone = timezone;
    }
    await saveConfig(config, userId);
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

  if (!userId) {
    res.status(400).json({ ok: false, error: 'userId is required' });
    return;
  }

  try {
    const config = await loadConfig(userId);
    config.notificationHourStart = notificationHourStart;
    config.notificationHourEnd = notificationHourEnd;
    await saveConfig(config, userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving notification hours:', error);
    res.status(500).json({ ok: false, error: 'Failed to save notification hours' });
  }
});

app.post('/api/push/reminder-settings', async (req, res) => {
  if (!requirePushToken(req, res)) {
    return;
  }

  const {
    userId,
    reminder_morning,
    reminder_afternoon,
    reminder_evening,
    reminder_morning_enabled,
    reminder_afternoon_enabled,
    reminder_evening_enabled,
  } = req.body as {
    userId?: string;
    reminder_morning?: string;
    reminder_afternoon?: string;
    reminder_evening?: string;
    reminder_morning_enabled?: boolean;
    reminder_afternoon_enabled?: boolean;
    reminder_evening_enabled?: boolean;
  };

  if (!userId) {
    res.status(400).json({ ok: false, error: 'userId is required' });
    return;
  }

  try {
    await saveUserSettings(userId, {
      reminder_morning,
      reminder_afternoon,
      reminder_evening,
      reminder_morning_enabled,
      reminder_afternoon_enabled,
      reminder_evening_enabled,
    });

    console.log(`[✓] Reminder settings saved for user: ${userId}`);
    res.json({ ok: true });
  } catch (error) {
    console.error('[✗] Error saving reminder settings in Supabase:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save reminder settings',
      details: error instanceof Error ? error.message : String(error),
    });
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

  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
  if (!userId) {
    res.status(400).json({ ok: false, error: 'userId is required' });
    return;
  }

  try {
    const courses = await loadCourses(userId);
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

  if (!userId) {
    res.status(400).json({ ok: false, error: 'userId is required' });
    return;
  }

  try {
    console.log(`[PUT] /api/courses/${courseCode}/checklist - payload: items=${Array.isArray(items) ? items.length : 0}, completed=${!!completed}, userId=${userId}`);
    await saveCourseChecklist(courseCode, items, !!completed, userId);
    console.log(`[PUT] /api/courses/${courseCode}/checklist - saveCourseChecklist completed for user=${userId}`);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving checklist:', error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, error: 'Failed to save checklist' });
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const db = supabase;
    if (!db) return;

    // Iterate user configs (with subscription) and send due notifications per user/timezone
    const { data: configs, error: configsError } = await db
      .from('user_configs')
      .select('user_key, subscription, schedule, timezone, sent_by_date')
      .not('subscription', 'is', null);

    if (configsError) {
      console.error('Error fetching user configs for cron:', configsError);
      return;
    }

    for (const row of (configs as any[]) || []) {
      try {
        const userKey = row.user_key;
        const subscription = (row.subscription || null) as PushSubscriptionPayload | null;
        const schedule = Array.isArray(row.schedule) ? row.schedule : [];
        const timezone = row.timezone || 'America/Santo_Domingo';
        const sentByDate = row.sent_by_date || {};

        if (!subscription?.endpoint || !schedule.length || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) continue;

        const { day, hh, mm, dateKey } = getLocalParts(timezone);
        const nowTotal = hh * 60 + mm;
        const sentMap = sentByDate[dateKey] || {};
        let changed = false;

        const today = schedule.find((d: any) => normalizeDay(d.day) === normalizeDay(day));
        if (!today) continue;

        // Process activities for notifications
        for (const activity of today.activities || []) {
          // Skip if notifications disabled for this activity
          if (activity.notificationConfig && activity.notificationConfig.enabled === false) continue;

          const minutesList = (activity.notificationConfig && Array.isArray(activity.notificationConfig.minutesBefore) && activity.notificationConfig.minutesBefore.length > 0)
            ? activity.notificationConfig.minutesBefore
            : WINDOWS;

          const startTotal = toTotalMinutes(activity.startTime);
          const diff = startTotal - nowTotal;

          for (const win of minutesList) {
            const key = `${activity.id}_${win}`;
            if (diff !== win || sentMap[key]) continue;
            try {
              const body = `Faltan ${win} minutos para: ${activity.name}`;
              await sendPush(subscription, `Aviso ${win} min`, body);
              sentMap[key] = true;
              changed = true;
            } catch (error: any) {
              if (error?.statusCode === 410 || error?.statusCode === 404) {
                // Invalidate subscription for this user
                await saveConfig({
                  timezone,
                  schedule,
                  subscription: null,
                  sentByDate,
                  notificationHourStart: 7,
                  notificationHourEnd: 22,
                }, userKey);
                continue;
              }
            }
          }

          // Course-specific reminder 30 min before
          if (activity.isAcademic || activity.activityType === 'FIJA_PERMANENTE') {
            const diff30 = toTotalMinutes(activity.startTime) - nowTotal;
            const key30 = `${activity.id}_curso_30`;
            if (diff30 === 30 && !sentMap[key30]) {
              const courseCode = activity.courseId || (activity.name.match(/\bIS-\d+\b/) || [])[0];
              if (courseCode) {
                try {
                  const { data: checklistRow } = await db
                    .from('course_checklists')
                    .select('items')
                    .eq('course_code', courseCode)
                    .eq('user_key', userKey)
                    .maybeSingle();

                  const items = (checklistRow as any)?.items || [];
                  const pendientes = (items || []).filter((i: any) => !i.done).length;

                  let body = `En 30 min tienes ${activity.name}.`;
                  if (pendientes > 0) body += ` ⚠️ Tienes ${pendientes} tarea${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''}.`;
                  else body += ` ✅ Estás al día con tus tareas.`;

                  await sendPush(subscription, '🎓 Clase próxima', body);
                  sentMap[key30] = true;
                  changed = true;
                } catch (err) {
                  console.error('Error fetching checklist for course reminder:', err);
                }
              }
            }
          }
        }

        const prunedSentByDate: Record<string, Record<string, boolean>> = {};
        prunedSentByDate[dateKey] = sentMap;
        if (changed || JSON.stringify(sentByDate) !== JSON.stringify(prunedSentByDate)) {
          await saveConfig({
            timezone,
            schedule,
            subscription,
            sentByDate: prunedSentByDate,
            notificationHourStart: 7,
            notificationHourEnd: 22,
          }, userKey);
        }
      } catch (err) {
        console.error('Error processing user config in cron:', err);
      }
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});

async function getPendingTaskSummary(userKey: string): Promise<{ total: number; courses: string[] }> {
  const db = supabase;
  if (!db) return { total: 0, courses: [] };

  const { data: checklists } = await db
    .from('course_checklists')
    .select('course_code, items')
    .eq('user_key', userKey);

  const courses: string[] = [];
  let total = 0;

  for (const checklist of (checklists as any[]) || []) {
    const items = checklist.items || [];
    const pendingCount = (items || []).filter((item: any) => !item.done).length;
    if (pendingCount > 0) {
      courses.push(checklist.course_code);
      total += pendingCount;
    }
  }

  return { total, courses };
}

async function processTaskReminderWindow(
  windowKey: 'morning' | 'afternoon' | 'evening',
  timeField: 'reminder_morning' | 'reminder_afternoon' | 'reminder_evening',
  enabledField: 'reminder_morning_enabled' | 'reminder_afternoon_enabled' | 'reminder_evening_enabled',
  title: string,
  buildMessage: (total: number, courses: string[]) => string,
) {
  const db = supabase;
  if (!db) return;

  const { data: configs, error } = await db
    .from('user_configs')
    .select('user_key, subscription, schedule, timezone, sent_by_date')
    .not('subscription', 'is', null);

  if (error) {
    console.error(`Error fetching user configs for ${windowKey} reminder:`, error);
    return;
  }

  for (const row of (configs as any[]) || []) {
    try {
      const userKey = row.user_key;
      const subscription = (row.subscription || null) as PushSubscriptionPayload | null;
      const timezone = row.timezone || 'America/Santo_Domingo';
      const sentByDate = row.sent_by_date || {};

      if (!subscription?.endpoint) continue;

      const { hh, mm, dateKey } = getLocalParts(timezone);
      const hhmm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const sentMap = sentByDate[dateKey] || {};
      const sentKey = `${windowKey}_task_reminder`;
      if (sentMap[sentKey]) continue;

      const { data: userSettings } = await db
        .from('user_settings')
        .select(`${timeField}, ${enabledField}`)
        .eq('user_id', userKey)
        .maybeSingle();

      if (!userSettings) continue;

      const enabled = userSettings[enabledField] !== false;
      const reminderTime = userSettings[timeField] || (windowKey === 'morning' ? '08:00' : windowKey === 'afternoon' ? '15:00' : '18:00');
      if (!enabled || hhmm !== reminderTime) continue;

      const { total, courses } = await getPendingTaskSummary(userKey);
      if (total <= 0 || courses.length === 0) {
        sentMap[sentKey] = true;
        await saveConfig({
          timezone,
          schedule: row.schedule || [],
          subscription,
          sentByDate: { ...sentByDate, [dateKey]: sentMap },
          notificationHourStart: 7,
          notificationHourEnd: 22,
        }, userKey);
        continue;
      }

      await sendPush(subscription, title, buildMessage(total, courses));
      sentMap[sentKey] = true;
      await saveConfig({
        timezone,
        schedule: row.schedule || [],
        subscription,
        sentByDate: { ...sentByDate, [dateKey]: sentMap },
        notificationHourStart: 7,
        notificationHourEnd: 22,
      }, userKey);
    } catch (error) {
      console.error(`Error processing ${windowKey} reminder:`, error);
    }
  }
}

cron.schedule('* * * * *', async () => {
  await processTaskReminderWindow(
    'morning',
    'reminder_morning',
    'reminder_morning_enabled',
    '🌅 Buenos días, Mayra!',
    (total, courses) => `Tienes ${total} tareas pendientes en: ${courses.join(', ')}. ¡Buen día para avanzar!`,
  );
});

cron.schedule('* * * * *', async () => {
  await processTaskReminderWindow(
    'afternoon',
    'reminder_afternoon',
    'reminder_afternoon_enabled',
    '☀️ Recordatorio de tarde',
    (total, courses) => `Aún tienes tiempo hoy. ${total} tareas pendientes en: ${courses.join(', ')}.`,
  );
});

cron.schedule('* * * * *', async () => {
  await processTaskReminderWindow(
    'evening',
    'reminder_evening',
    'reminder_evening_enabled',
    '🌙 Antes de cerrar el día',
    (total, courses) => `No olvides revisar tus tareas. ${total} pendientes en: ${courses.join(', ')}.`,
  );
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
    console.log(`Backend listening on port ${PORT}`);

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
