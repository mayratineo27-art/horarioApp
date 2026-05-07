#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_ANON_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const migrationSQL = `
ALTER TABLE public.fixed_courses
ADD COLUMN IF NOT EXISTS custom_color text;
`;

async function migrate() {
  try {
    console.log('🔄 Connecting to Supabase...');
    
    // Test connection
    const { data, error } = await supabase.from('fixed_courses').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    console.log('✓ Connected to Supabase');
    
    // Execute migration via RPC or raw query
    // Note: Supabase JS client doesn't support raw DDL, so we use the REST API with Authorization
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to Supabase REST: ${response.status}`);
    }

    console.log('✓ REST API is accessible');
    
    // Since Supabase JS client doesn't support raw DDL directly,
    // we need to use the SQL editor via dashboard or CLI.
    // For now, log the SQL that needs to be executed manually.
    console.log('\n📋 Please execute the following SQL in your Supabase SQL Editor:');
    console.log('=' .repeat(60));
    console.log(migrationSQL);
    console.log('='.repeat(60));
    console.log('\n📍 Go to: https://app.supabase.com/project/pxwurgeoqiygcyggummh/sql');
    console.log('\n✅ After applying the migration, the schema will be updated.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
