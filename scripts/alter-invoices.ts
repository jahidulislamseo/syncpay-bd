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
  console.log('Connected!');

  await client.query(`
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_email TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS trx_id TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
  `);
  console.log('✅ Columns customer_email, trx_id, payment_method added to invoices table!');

  const cols = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'invoices';
  `);
  console.log('Invoices columns:', cols.rows.map(r => r.column_name));

  await client.end();
}

main().catch(console.error);
