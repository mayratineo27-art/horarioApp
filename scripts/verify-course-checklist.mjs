import 'dotenv/config';

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const userKey = (process.argv[2] || process.env.USER_KEY || '').trim();
const courseCode = (process.argv[3] || process.env.COURSE_CODE || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

if (!userKey || !courseCode) {
  console.error('Usage: npm run verify:course -- <user_key> <course_code>');
  console.error('Example: npm run verify:course -- 550e8400-e29b-41d4-a716-446655440000 IS-485');
  process.exit(1);
}

const url = new URL(`${supabaseUrl}/rest/v1/course_checklists`);
url.searchParams.set('select', 'id,user_key,course_id,course_code,items,completed,created_at,updated_at');
url.searchParams.set('user_key', `eq.${userKey}`);
url.searchParams.set('course_code', `eq.${courseCode}`);

const response = await fetch(url, {
  headers: {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  },
});

if (!response.ok) {
  const text = await response.text();
  console.error(`Supabase query failed (${response.status}): ${text}`);
  process.exit(1);
}

const rows = await response.json();

if (!Array.isArray(rows) || rows.length === 0) {
  console.log(`No checklist rows found for user_key=${userKey} and course_code=${courseCode}.`);
  process.exit(0);
}

console.log(`Found ${rows.length} row(s):`);
console.log(JSON.stringify(rows, null, 2));