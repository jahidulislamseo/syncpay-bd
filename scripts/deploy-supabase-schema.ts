import { Client } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
  const port = 6543;
  const user = 'postgres.qytfwngstqhqrhymuupk';
  const password = process.env.DB_PASSWORD || 'SyncPay2026!#';

  console.log(`[1/3] Connecting to Supabase PostgreSQL at ${host}:${port} as ${user}...`);
  const client = new Client({
    host,
    port,
    database: 'postgres',
    user,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  console.log('✅ Connected successfully to Supabase PostgreSQL!');

  const sqlPath = path.resolve(__dirname, '../src/db/migrations/001_initial_supabase_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('[2/3] Executing schema migration (tables, indexes, RLS policies, seed data)...');
  await client.query(sql);
  console.log('✅ Schema migration executed successfully!');

  console.log('[3/3] Verifying created tables...');
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('✅ Tables present in Supabase:', res.rows.map(r => r.table_name));
  await client.end();
}

deploy().catch(err => {
  console.error('❌ Deployment error:', err.message);
  process.exit(1);
});
