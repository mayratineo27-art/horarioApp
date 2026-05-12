-- Store reminder windows in one JSONB field to avoid schema drift across environments.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminder_config JSONB DEFAULT '{}'::jsonb;
