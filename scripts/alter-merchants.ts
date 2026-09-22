import { Client } from 'pg';

async function main() {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.qytfwngstqhqrhymuupk',
    password: 'SyncPay2026!#',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL!');

  await client.query(`
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);
  console.log('✅ Column password_hash added to merchants table in Supabase!');

  await client.end();
}

main().catch(console.error);
