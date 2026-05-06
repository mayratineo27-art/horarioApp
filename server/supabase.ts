import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ override: true });

const STORAGE_MODE = (process.env.STORAGE_MODE || 'local').toLowerCase();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const USE_SUPABASE = STORAGE_MODE === 'supabase' && !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'user-config.json');

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

export async function initializeDatabase() {
  if (!USE_SUPABASE) {
    ensureDataFile();
    console.log('✓ Local storage mode enabled (server/data/user-config.json)');
    return;
  }

  console.log('✓ Supabase client initialized');
}

export interface Activity {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
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
    };
  } catch (error) {
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (upsertError) {
      console.error('Error saving config to Supabase:', upsertError);
      throw upsertError;
    }
  } catch (error) {
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
  };
}
