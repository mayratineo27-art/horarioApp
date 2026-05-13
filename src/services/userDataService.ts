/**
 * Frontend service for user data management with Supabase
 */

import { supabase } from './supabaseAuth';
import { DaySchedule } from '../constants';

export interface UserSettings {
  notification_hour_start?: number;
  notification_hour_end?: number;
  onboarding_completed?: boolean;
  user_name?: string;
  reminder_morning?: string;
  reminder_afternoon?: string;
  reminder_evening?: string;
  reminder_morning_enabled?: boolean;
  reminder_afternoon_enabled?: boolean;
  reminder_evening_enabled?: boolean;
}

const TABLES = {
  schedules: 'user_schedules',
  settings: 'user_settings',
  exceptions: 'user_exceptions',
} as const;

export const loadUserScheduleFromSupabase = async (userId: string): Promise<DaySchedule[] | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.schedules)
      .select('schedule')
      .eq('user_id', userId)
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return data?.schedule || null;
  } catch (error: any) {
    if (error?.code === 'PGRST205' || error?.status === 404) {
      console.debug('Supabase table missing (user_schedules). Returning null.');
      return null;
    }
    console.error('Error loading user schedule:', error);
    return null;
  }
};

export const saveUserScheduleToSupabase = async (
  userId: string,
  schedule: DaySchedule[],
  timezone: string = 'America/Lima'
): Promise<void> => {
  try {
    const { error } = await supabase
      .from(TABLES.schedules)
      .upsert(
        {
          user_id: userId,
          schedule,
          timezone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    console.log(`[✓] User schedule saved for user: ${userId}`);
  } catch (error) {
    console.error('Error saving user schedule:', error);
    throw error;
  }
};

export const loadUserSettingsFromSupabase = async (userId: string): Promise<UserSettings | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.settings)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    
    if (!data) return null;

    // Desestructure reminder_config JSON into simple properties
    const reminderConfig = data.reminder_config || {};
    const settings: UserSettings = {
      notification_hour_start: data.notification_hour_start,
      notification_hour_end: data.notification_hour_end,
      onboarding_completed: data.onboarding_completed,
      user_name: data.user_name,
      reminder_morning: reminderConfig.morning || '08:00',
      reminder_afternoon: reminderConfig.afternoon || '15:00',
      reminder_evening: reminderConfig.evening || '18:00',
      reminder_morning_enabled: reminderConfig.morning_enabled ?? true,
      reminder_afternoon_enabled: reminderConfig.afternoon_enabled ?? true,
      reminder_evening_enabled: reminderConfig.evening_enabled ?? true,
    };

    return settings;
  } catch (error: any) {
    if (error?.code === 'PGRST205' || error?.status === 404) {
      console.debug('Supabase table missing (user_settings). Returning null.');
      return null;
    }
    console.error('Error loading user settings:', error);
    return null;
  }
};

export const saveUserSettingsToSupabase = async (userId: string, settings: UserSettings): Promise<void> => {
  try {
    // Build reminder_config JSON from simple properties
    const reminderConfig = {
      morning: settings.reminder_morning || '08:00',
      afternoon: settings.reminder_afternoon || '15:00',
      evening: settings.reminder_evening || '18:00',
      morning_enabled: settings.reminder_morning_enabled ?? true,
      afternoon_enabled: settings.reminder_afternoon_enabled ?? true,
      evening_enabled: settings.reminder_evening_enabled ?? true,
    };

    const { error } = await supabase
      .from(TABLES.settings)
      .upsert(
        {
          user_id: userId,
          notification_hour_start: settings.notification_hour_start,
          notification_hour_end: settings.notification_hour_end,
          onboarding_completed: settings.onboarding_completed,
          user_name: settings.user_name,
          reminder_config: reminderConfig,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    console.log(`[✓] User settings saved for user: ${userId}`);
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

export const isUserNewOnboarding = async (userId: string): Promise<boolean> => {
  try {
    const settings = await loadUserSettingsFromSupabase(userId);
    return !settings?.onboarding_completed;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
};

export const saveUserExceptionToSupabase = async (
  userId: string,
  weekKey: string,
  activityId: string,
  modifiedData: any
): Promise<void> => {
  try {
    const { error } = await supabase
      .from(TABLES.exceptions)
      .upsert(
        {
          user_id: userId,
          week_key: weekKey,
          activity_id: activityId,
          modified_data: modifiedData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week_key,activity_id' }
      );

    if (error) throw error;
    console.log(`[✓] Exception saved for ${activityId} in week ${weekKey}`);
  } catch (error) {
    console.error('Error saving user exception:', error);
    throw error;
  }
};

export const loadUserExceptionFromSupabase = async (
  userId: string,
  weekKey: string,
  activityId: string
): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.exceptions)
      .select('modified_data')
      .eq('user_id', userId)
      .eq('week_key', weekKey)
      .eq('activity_id', activityId)
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return data?.modified_data || null;
  } catch (error) {
    console.error('Error loading user exception:', error);
    return null;
  }
};

export const loadUserExceptionsForWeek = async (
  userId: string,
  weekKey: string
): Promise<Record<string, any>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.exceptions)
      .select('activity_id, modified_data')
      .eq('user_id', userId)
      .eq('week_key', weekKey);

    if (error) throw error;

    const exceptions: Record<string, any> = {};
    data?.forEach(row => {
      exceptions[row.activity_id] = row.modified_data;
    });
    return exceptions;
  } catch (error) {
    console.error('Error loading user exceptions for week:', error);
    return {};
  }
};

export const deleteExpiredExceptionsFromSupabase = async (
  userId: string,
  currentWeekKey: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from(TABLES.exceptions)
      .delete()
      .eq('user_id', userId)
      .lt('week_key', currentWeekKey);

    if (error) throw error;
    console.log(`[✓] Expired exceptions deleted for user ${userId}`);
  } catch (error) {
    console.error('Error deleting expired exceptions:', error);
    throw error;
  }
};

export const applyWeeklyExceptionsToSchedule = async (
  userId: string,
  baseSchedule: DaySchedule[],
  weekKey: string
): Promise<DaySchedule[]> => {
  try {
    const exceptions = await loadUserExceptionsForWeek(userId, weekKey);

    if (Object.keys(exceptions).length === 0) {
      return baseSchedule;
    }

    return baseSchedule.map(day => ({
      ...day,
      activities: day.activities.map(activity => {
        const exception = exceptions[activity.id];
        if (exception) {
          return {
            ...activity,
            startTime: exception.startTime || activity.startTime,
            endTime: exception.endTime || activity.endTime,
            name: exception.name || activity.name,
            emoji: exception.emoji || activity.emoji,
          };
        }
        return activity;
      }),
    }));
  } catch (error) {
    console.error('Error applying weekly exceptions:', error);
    return baseSchedule;
  }
};