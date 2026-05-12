-- Add configurable task reminder windows to user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminder_morning TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS reminder_afternoon TEXT DEFAULT '15:00',
  ADD COLUMN IF NOT EXISTS reminder_evening TEXT DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS reminder_morning_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_afternoon_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_evening_enabled BOOLEAN DEFAULT TRUE;
