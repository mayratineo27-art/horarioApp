-- BLOQUE 2: Create Supabase tables for user data migration
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/pxwurgeoqiygcyggummh/sql/new

-- 0. User Configs Table (for push subscriptions and backward compatibility)
-- Stores push subscriptions and timezone info using user_key as identifier
CREATE TABLE IF NOT EXISTS public.user_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_key TEXT NOT NULL UNIQUE,
  subscription JSONB,
  timezone TEXT DEFAULT 'America/Santo_Domingo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. User Schedules Table
-- Stores the weekly schedule for each user
CREATE TABLE IF NOT EXISTS public.user_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  timezone TEXT DEFAULT 'America/Lima',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. User Completions Table
-- Tracks which activities were marked complete on each day
CREATE TABLE IF NOT EXISTS public.user_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed_ids JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 3. User Exceptions Table
-- Temporary weekly exceptions for activities (when user modifies just one week)
CREATE TABLE IF NOT EXISTS public.user_exceptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,  -- Format: YYYY-WW (e.g., 2026-05)
  activity_id TEXT NOT NULL,
  modified_data JSONB NOT NULL,  -- Stores modified activity data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_key, activity_id)
);

-- 4. User Settings Table
-- Stores user preferences and onboarding state
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_hour_start INTEGER DEFAULT 7,
  notification_hour_end INTEGER DEFAULT 22,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.user_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Policy: Users can only access their own schedule
CREATE POLICY "Users can only access their own schedule" 
  ON public.user_schedules 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only access their own completions
CREATE POLICY "Users can only access their own completions" 
  ON public.user_completions 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only access their own exceptions
CREATE POLICY "Users can only access their own exceptions" 
  ON public.user_exceptions 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only access their own settings
CREATE POLICY "Users can only access their own settings" 
  ON public.user_settings 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS user_schedules_user_id ON public.user_schedules(user_id);
CREATE INDEX IF NOT EXISTS user_completions_user_id ON public.user_completions(user_id);
CREATE INDEX IF NOT EXISTS user_completions_user_date ON public.user_completions(user_id, date);
CREATE INDEX IF NOT EXISTS user_exceptions_user_id ON public.user_exceptions(user_id);
CREATE INDEX IF NOT EXISTS user_exceptions_week_key ON public.user_exceptions(user_id, week_key);
CREATE INDEX IF NOT EXISTS user_settings_user_id ON public.user_settings(user_id);
