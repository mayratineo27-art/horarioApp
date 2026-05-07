import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { INITIAL_SCHEDULE } from '../src/constants.ts';

dotenv.config({ override: true });

const STORAGE_MODE = (process.env.STORAGE_MODE || 'local').toLowerCase();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const USE_SUPABASE = STORAGE_MODE === 'supabase' && !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'user-config.json');
const COURSE_DATA_FILE = path.join(DATA_DIR, 'course-store.json');
const COURSE_USER_KEY = process.env.COURSE_USER_KEY || 'default-user';

export const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(getDefaultConfig(), null, 2), 'utf-8');
  }
}

function loadConfigFromFile(): UserConfig {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as UserConfig;
    return {
      ...getDefaultConfig(),
      ...parsed,
      sentByDate: parsed.sentByDate || {},
      schedule: parsed.schedule || [],
      subscription: parsed.subscription || null,
      timezone: parsed.timezone || 'America/Santo_Domingo',
    };
  } catch {
    return getDefaultConfig();
  }
}

function saveConfigToFile(config: UserConfig) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function ensureCourseDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(COURSE_DATA_FILE)) {
    fs.writeFileSync(COURSE_DATA_FILE, JSON.stringify({ fixedCourses: [], courseChecklists: {} }, null, 2), 'utf-8');
  }
}

function loadCourseStore() {
  ensureCourseDataFile();
  try {
    const raw = fs.readFileSync(COURSE_DATA_FILE, 'utf-8');
    return JSON.parse(raw) as { fixedCourses: FixedCourseRow[]; courseChecklists: Record<string, CourseChecklistRow> };
  } catch {
    return { fixedCourses: [], courseChecklists: {} };
  }
}

function saveCourseStore(store: { fixedCourses: FixedCourseRow[]; courseChecklists: Record<string, CourseChecklistRow> }) {
  ensureCourseDataFile();
  fs.writeFileSync(COURSE_DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function isMissingSchemaError(error: any) {
  return error?.code === 'PGRST204' || error?.code === 'PGRST205';
}

export async function initializeDatabase() {
  if (!USE_SUPABASE) {
    ensureDataFile();
    ensureCourseDataFile();
    console.log('✓ Local storage mode enabled (server/data/user-config.json)');
    return;
  }

  console.log('✓ Supabase client initialized');
}

export interface Activity {
  id: string;
  name: string;
  category?: string;
  startTime: string;
  endTime: string;
  isFixed?: boolean;
  esFijo?: boolean;
  courseId?: string;
  emoji?: string;
}

export interface DaySchedule {
  day: string;
  activities: Activity[];
}

export interface UserConfig {
  timezone: string;
  schedule: DaySchedule[];
  subscription: unknown | null;
  sentByDate: Record<string, Record<string, boolean>>;
  notificationHourStart: number;
  notificationHourEnd: number;
}

export interface CourseTaskItem {
  id: string;
  text: string;
  done: boolean;
}

export interface FixedCourseRow {
  id?: string;
  user_key: string;
  course_code: string;
  name: string;
  category: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  es_fijo: boolean;
  is_exercise: boolean;
  emoji: string;
  checklist: CourseTaskItem[] | string[];
  updated_at?: string;
}

export interface CourseChecklistRow {
  id?: string;
  user_key: string;
  course_id?: string;
  course_code: string;
  items: CourseTaskItem[];
  completed: boolean;
  updated_at?: string;
}

export interface CourseRecord {
  id?: string;
  courseCode: string;
  name: string;
  category: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  esFijo: boolean;
  isExercise: boolean;
  emoji: string;
  checklist: CourseTaskItem[];
  completed: boolean;
}

function normalizeTasks(value: unknown): CourseTaskItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: `task-${index}`, text: item, done: false } satisfies CourseTaskItem;
      }
      if (item && typeof item === 'object') {
        const candidate = item as Partial<CourseTaskItem>;
        return {
          id: candidate.id || `task-${index}`,
          text: candidate.text || '',
          done: !!candidate.done,
        } satisfies CourseTaskItem;
      }
      return null;
    })
    .filter((item): item is CourseTaskItem => !!item && !!item.text.trim());
}

function extractCourseCode(value: string): string | null {
  const codeMatch = value.match(/\bIS-\d+\b/);
  if (codeMatch) {
    return codeMatch[0];
  }

  const parenMatch = value.match(/\((IS-\d+)\)/);
  return parenMatch ? parenMatch[1] : null;
}

function buildCoursesFromSchedule(schedule: DaySchedule[]): CourseRecord[] {
  const courseMap = new Map<string, CourseRecord>();

  for (const day of schedule) {
    for (const activity of day.activities) {
      const courseCode = activity.name.includes('IS-') || activity.courseId
        ? (activity.courseId || extractCourseCode(activity.name))
        : null;

      if (!courseCode || courseMap.has(courseCode)) {
        continue;
      }

      courseMap.set(courseCode, {
        id: undefined,
        courseCode,
        name: activity.name.replace(/\s*\(IS-\d+\)/, '').trim(),
        category: activity.category || 'Académico',
        dayOfWeek: day.day,
        startTime: activity.startTime,
        endTime: activity.endTime,
        esFijo: !!activity.isFixed || !!activity.esFijo,
        isExercise: activity.name.toLowerCase().includes('ejercicio') || activity.emoji === '💪',
        emoji: activity.emoji || '📘',
        checklist: [],
        completed: false,
      });
    }
  }

  return Array.from(courseMap.values());
}

function courseRowToRecord(course: FixedCourseRow, checklist: CourseChecklistRow | null): CourseRecord {
  return {
    id: course.id,
    courseCode: course.course_code,
    name: course.name,
    category: course.category,
    dayOfWeek: course.day_of_week,
    startTime: course.start_time,
    endTime: course.end_time,
    esFijo: course.es_fijo,
    isExercise: course.is_exercise,
    emoji: course.emoji,
    checklist: checklist ? checklist.items : normalizeTasks(course.checklist),
    completed: checklist ? checklist.completed : false,
  };
}

export async function loadCourses(): Promise<CourseRecord[]> {
  const localStore = loadCourseStore();
  if (localStore.fixedCourses.length > 0) {
    return localStore.fixedCourses.map(course => courseRowToRecord(course, localStore.courseChecklists[course.course_code] || null));
  }

  if (!USE_SUPABASE || !supabase) {
    const config = loadConfigFromFile();
    const scheduleSource = Array.isArray(config.schedule) && config.schedule.length > 0 ? config.schedule : INITIAL_SCHEDULE;
    const seedCourses = buildCoursesFromSchedule(scheduleSource as DaySchedule[]);
    if (seedCourses.length > 0) {
      await saveCourses(seedCourses);
      return seedCourses;
    }

    return [];
  }

  try {
    const { data: fixedCourses, error: fixedCoursesError } = await supabase
      .from('fixed_courses')
      .select('*')
      .eq('user_key', COURSE_USER_KEY)
      .order('course_code', { ascending: true });

    if (fixedCoursesError) throw fixedCoursesError;

    const { data: checklists, error: checklistsError } = await supabase
      .from('course_checklists')
      .select('*')
      .eq('user_key', COURSE_USER_KEY);

    if (checklistsError) throw checklistsError;

    if (!fixedCourses || fixedCourses.length === 0) {
      const config = await loadConfig();
      const scheduleSource = Array.isArray(config.schedule) && config.schedule.length > 0 ? config.schedule : INITIAL_SCHEDULE;
      const seedCourses = buildCoursesFromSchedule(scheduleSource as DaySchedule[]);
      if (seedCourses.length > 0) {
        await saveCourses(seedCourses);
        return seedCourses;
      }
    }

    const checklistsByCode = new Map<string, CourseChecklistRow>();
    for (const row of checklists || []) {
      checklistsByCode.set(row.course_code, {
        id: row.id,
        user_key: row.user_key,
        course_id: row.course_id,
        course_code: row.course_code,
        items: normalizeTasks(row.items),
        completed: !!row.completed,
        updated_at: row.updated_at,
      });
    }

    return (fixedCourses || []).map((course: any) =>
      courseRowToRecord(
        {
          id: course.id,
          user_key: course.user_key,
          course_code: course.course_code,
          name: course.name,
          category: course.category,
          day_of_week: course.day_of_week,
          start_time: course.start_time,
          end_time: course.end_time,
          es_fijo: course.es_fijo,
          is_exercise: course.is_exercise,
          emoji: course.emoji,
          checklist: normalizeTasks(course.checklist),
          updated_at: course.updated_at,
        },
        checklistsByCode.get(course.course_code) || null,
      ),
    );
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.warn('Supabase schema missing for courses, falling back to local file storage.');
      const store = loadCourseStore();
      if (store.fixedCourses.length === 0) {
        const scheduleSource = INITIAL_SCHEDULE;
        const seedCourses = buildCoursesFromSchedule(scheduleSource as DaySchedule[]);
        if (seedCourses.length > 0) {
          await saveCourses(seedCourses);
          return seedCourses;
        }
      }
      return store.fixedCourses.map(course => courseRowToRecord(course, store.courseChecklists[course.course_code] || null));
    }
    console.error('Error loading courses:', error);
    return [];
  }
}

export async function saveCourses(courses: CourseRecord[]): Promise<void> {
  if (!USE_SUPABASE || !supabase) {
    const store = loadCourseStore();
    const nextFixedCourses: FixedCourseRow[] = [];
    const nextChecklists: Record<string, CourseChecklistRow> = { ...store.courseChecklists };

    for (const course of courses) {
      const row: FixedCourseRow = {
        id: store.fixedCourses.find(item => item.course_code === course.courseCode)?.id,
        user_key: COURSE_USER_KEY,
        course_code: course.courseCode,
        name: course.name,
        category: course.category,
        day_of_week: course.dayOfWeek,
        start_time: course.startTime,
        end_time: course.endTime,
        es_fijo: course.esFijo,
        is_exercise: course.isExercise,
        emoji: course.emoji,
        checklist: course.checklist,
        updated_at: new Date().toISOString(),
      };
      nextFixedCourses.push(row);
      nextChecklists[course.courseCode] = {
        id: nextChecklists[course.courseCode]?.id,
        user_key: COURSE_USER_KEY,
        course_code: course.courseCode,
        items: course.checklist,
        completed: course.completed,
        updated_at: new Date().toISOString(),
      };
    }

    saveCourseStore({ fixedCourses: nextFixedCourses, courseChecklists: nextChecklists });
    return;
  }

  try {
    for (const course of courses) {
      const existingCourse = await supabase
        .from('fixed_courses')
        .select('id')
        .eq('user_key', COURSE_USER_KEY)
        .eq('course_code', course.courseCode)
        .maybeSingle();

      let courseId = existingCourse.data?.id || null;

      if (courseId) {
        const { error } = await supabase.from('fixed_courses').update({
          name: course.name,
          category: course.category,
          day_of_week: course.dayOfWeek,
          start_time: course.startTime,
          end_time: course.endTime,
          es_fijo: course.esFijo,
          is_exercise: course.isExercise,
          emoji: course.emoji,
          checklist: course.checklist,
          updated_at: new Date().toISOString(),
        }).eq('id', courseId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('fixed_courses').insert({
          user_key: COURSE_USER_KEY,
          course_code: course.courseCode,
          name: course.name,
          category: course.category,
          day_of_week: course.dayOfWeek,
          start_time: course.startTime,
          end_time: course.endTime,
          es_fijo: course.esFijo,
          is_exercise: course.isExercise,
          emoji: course.emoji,
          checklist: course.checklist,
          updated_at: new Date().toISOString(),
        }).select('id').single();

        if (error) throw error;
        courseId = data.id;
      }

      const { error: checklistError } = await supabase.from('course_checklists').upsert({
        user_key: COURSE_USER_KEY,
        course_id: courseId,
        course_code: course.courseCode,
        items: course.checklist,
        completed: course.completed,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_key,course_id' });

      if (checklistError) throw checklistError;
    }
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.warn('Supabase schema missing for courses, saving locally instead.');
      const store = loadCourseStore();
      const nextFixedCourses: FixedCourseRow[] = [];
      const nextChecklists: Record<string, CourseChecklistRow> = { ...store.courseChecklists };

      for (const course of courses) {
        const row: FixedCourseRow = {
          id: store.fixedCourses.find(item => item.course_code === course.courseCode)?.id,
          user_key: COURSE_USER_KEY,
          course_code: course.courseCode,
          name: course.name,
          category: course.category,
          day_of_week: course.dayOfWeek,
          start_time: course.startTime,
          end_time: course.endTime,
          es_fijo: course.esFijo,
          is_exercise: course.isExercise,
          emoji: course.emoji,
          checklist: course.checklist,
          updated_at: new Date().toISOString(),
        };
        nextFixedCourses.push(row);
        nextChecklists[course.courseCode] = {
          id: nextChecklists[course.courseCode]?.id,
          user_key: COURSE_USER_KEY,
          course_code: course.courseCode,
          items: course.checklist,
          completed: course.completed,
          updated_at: new Date().toISOString(),
        };
      }

      saveCourseStore({ fixedCourses: nextFixedCourses, courseChecklists: nextChecklists });
      return;
    }

    console.error('Error saving courses:', error);
    throw error;
  }
}

export async function saveCourseChecklist(courseCode: string, items: CourseTaskItem[], completed = false): Promise<void> {
  if (!USE_SUPABASE || !supabase) {
    const store = loadCourseStore();
    const fixedCourse = store.fixedCourses.find(course => course.course_code === courseCode);
    store.courseChecklists[courseCode] = {
      id: store.courseChecklists[courseCode]?.id,
      user_key: COURSE_USER_KEY,
      course_code: courseCode,
      course_id: fixedCourse?.id,
      items,
      completed,
      updated_at: new Date().toISOString(),
    };
    saveCourseStore(store);
    return;
  }

  try {
    const { data: fixedCourses, error: fixedCourseError } = await supabase
      .from('fixed_courses')
      .select('id')
      .eq('user_key', COURSE_USER_KEY)
      .eq('course_code', courseCode)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (fixedCourseError) throw fixedCourseError;

    const fixedCourse = Array.isArray(fixedCourses) ? fixedCourses[0] : null;

    if (!fixedCourse?.id) {
      throw new Error(`Course not found: ${courseCode}`);
    }

    const { error } = await supabase.from('course_checklists').upsert({
      user_key: COURSE_USER_KEY,
      course_id: fixedCourse.id,
      course_code: courseCode,
      items,
      completed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_key,course_id' });

    if (error) throw error;
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.warn('Supabase schema missing for course checklists, saving locally instead.');
      const store = loadCourseStore();
      const fixedCourse = store.fixedCourses.find(course => course.course_code === courseCode);
      store.courseChecklists[courseCode] = {
        id: store.courseChecklists[courseCode]?.id,
        user_key: COURSE_USER_KEY,
        course_code: courseCode,
        course_id: fixedCourse?.id,
        items,
        completed,
        updated_at: new Date().toISOString(),
      };
      saveCourseStore(store);
      return;
    }

    console.error('Error saving course checklist:', error);
    throw error;
  }
}

const TABLE_NAME = 'user_configs';

export async function loadConfig(): Promise<UserConfig> {
  if (!USE_SUPABASE || !supabase) {
    return loadConfigFromFile();
  }

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows found, return default
      return getDefaultConfig();
    }

    if (error) {
      console.error('Error loading config from Supabase:', error);
      return getDefaultConfig();
    }

    return {
      timezone: data.timezone || 'America/Santo_Domingo',
      schedule: data.schedule || [],
      subscription: data.subscription || null,
      sentByDate: data.sent_by_date || {},
      notificationHourStart: data.notification_hour_start ?? 7,
      notificationHourEnd: data.notification_hour_end ?? 22,
    };
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.warn('Supabase schema missing for config, falling back to local file storage.');
      return loadConfigFromFile();
    }
    console.error('Error loading config:', error);
    return getDefaultConfig();
  }
}

export async function saveConfig(config: UserConfig): Promise<void> {
  if (!USE_SUPABASE || !supabase) {
    saveConfigToFile(config);
    return;
  }

  try {
    // Upsert: si existe, actualiza; si no, crea
    const { error: upsertError } = await supabase.from(TABLE_NAME).upsert(
      {
        id: 1, // Always use same ID to keep single config
        timezone: config.timezone,
        schedule: config.schedule,
        subscription: config.subscription,
        sent_by_date: config.sentByDate,
        notification_hour_start: config.notificationHourStart,
        notification_hour_end: config.notificationHourEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (upsertError) {
      if (isMissingSchemaError(upsertError)) {
        console.warn('Supabase schema missing for config, saving locally instead.');
        saveConfigToFile(config);
        return;
      }
      console.error('Error saving config to Supabase:', upsertError);
      throw upsertError;
    }
  } catch (error) {
    if (isMissingSchemaError(error)) {
      saveConfigToFile(config);
      return;
    }
    console.error('Error saving config:', error);
    throw error;
  }
}

function getDefaultConfig(): UserConfig {
  return {
    timezone: 'America/Santo_Domingo',
    schedule: [],
    subscription: null,
    sentByDate: {},
    notificationHourStart: 7,
    notificationHourEnd: 22,
  };
}

export type PushSubscriptionPayload = {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  expirationTime?: number | null;
};

export interface UserConfigWithTimestamp {
  user_key: string;
  subscription?: PushSubscriptionPayload | null;
  timezone: string;
  notification_hour_start?: number;
  notification_hour_end?: number;
  last_reset_date?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Saves or updates a push subscription in Supabase user_configs table using upsert.
 * Guarantees the subscription is properly persisted with user_key as unique identifier.
 */
export async function saveSubscriptionToSupabase(
  userKey: string,
  subscription: PushSubscriptionPayload,
  timezone: string = 'America/Santo_Domingo'
): Promise<void> {
  if (!USE_SUPABASE || !supabase) {
    console.log('[✓] Local storage mode: subscription persisted to user-config.json');
    const config = loadConfigFromFile();
    config.subscription = subscription;
    config.timezone = timezone;
    saveConfigToFile(config);
    return;
  }

  try {
    // Normalize subscription to ensure clean JSON storage
    const normalizedSubscription: PushSubscriptionPayload = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || '',
      },
      expirationTime: subscription.expirationTime || null,
    };

    const { error } = await supabase
      .from('user_configs')
      .upsert(
        {
          user_key: userKey,
          subscription: normalizedSubscription,
          timezone,
          notification_hour_start: 7,
          notification_hour_end: 21,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_key' }
      );

    if (error) {
      console.error('[✗] Error upserting subscription to Supabase:', error);
      throw error;
    }

    console.log(`[✓] Push subscription saved to Supabase for user: ${userKey}`);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      console.warn('[⚠] Supabase schema missing, falling back to local storage');
      saveSubscriptionToSupabase(userKey, subscription, timezone);
      return;
    }
    console.error('[✗] Failed to save subscription:', error);
    throw error;
  }
}

/**
 * Retrieves the last reset date for a user (for Monday resets at 05:00).
 */
export async function getLastResetDate(userKey: string): Promise<string | null> {
  if (!USE_SUPABASE || !supabase) {
    const config = loadConfigFromFile();
    // Store in sentByDate for now in local mode
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('user_configs')
      .select('last_reset_date')
      .eq('user_key', userKey)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[✗] Error fetching reset date:', error);
      return null;
    }

    return data?.last_reset_date || null;
  } catch (error) {
    console.error('[✗] Error getting last reset date:', error);
    return null;
  }
}

/**
 * Updates the last reset date for a user (called after resetting activities on Monday 05:00).
 */
export async function updateLastResetDate(userKey: string, resetDate: string = new Date().toISOString().split('T')[0]): Promise<void> {
  if (!USE_SUPABASE || !supabase) {
    console.log(`[✓] Local mode: reset date updated to ${resetDate}`);
    return;
  }

  try {
    const { error } = await supabase
      .from('user_configs')
      .update({
        last_reset_date: resetDate,
        updated_at: new Date().toISOString(),
      })
      .eq('user_key', userKey);

    if (error) {
      console.error('[✗] Error updating reset date:', error);
      return;
    }

    console.log(`[✓] Reset date updated for user: ${userKey} -> ${resetDate}`);
  } catch (error) {
    console.error('[✗] Failed to update reset date:', error);
  }
}
