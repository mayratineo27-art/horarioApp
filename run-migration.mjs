#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config({ override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_ANON_KEY not set in .env');
  process.exit(1);
}

// Parse Supabase URL to get connection details
// Format: https://PROJECT.supabase.co
const projectRef = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Invalid SUPABASE_URL format');
  process.exit(1);
}

// Standard Supabase PostgreSQL connection string
const connectionString = `postgresql://postgres:[YOUR_DB_PASSWORD]@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;

const migrationSQL = `
ALTER TABLE public.fixed_courses
ADD COLUMN IF NOT EXISTS custom_color text;
`;

async function migrate() {
  let client;
  try {
    console.log('🔄 Attempting to execute SQL migration...');
    console.log('📍 Note: Direct DB connection requires DB password (not available via anon key)');
    console.log('\n📋 SQL to execute:');
    console.log('='.repeat(70));
    console.log(migrationSQL.trim());
    console.log('='.repeat(70));
    console.log('\n✅ To apply this migration, execute via Supabase Dashboard:');
    console.log(`📍 Visit: ${SUPABASE_URL}/projects/${projectRef}/sql/new`);
    console.log('\n📋 Paste the SQL above and click "Run"');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

migrate();
