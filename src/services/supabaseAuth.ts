/**
 * Supabase Authentication Service
 * Handles Google OAuth login, session management, and user data
 */

import { createClient } from '@supabase/supabase-js';

// Use Vite's import.meta.env for environment variables
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '') as string;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '') as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials missing. Auth will not work. Check .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at?: string;
}

/**
 * Get the current session
 */
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return data.session;
};

/**
 * Convert Supabase auth user to our User interface
 */
export const convertAuthToUser = (authUser: any): User | null => {
  if (!authUser) return null;

  return {
    id: authUser.id,
    email: authUser.email || '',
    name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
    avatar_url: authUser.user_metadata?.avatar_url,
    created_at: authUser.created_at,
  };
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

/**
 * Sign out the user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Listen to authentication state changes
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user;
    const convertedUser = convertAuthToUser(user);
    callback(convertedUser);
  });

  return subscription;
};
