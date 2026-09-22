import { Client } from 'pg';

async function optimize() {
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

  // 1. Add missing index on foreign key
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_device_id ON transactions(device_id);
  `);
  console.log('✅ Index on transactions(device_id) added!');

  // 2. Optimize RLS policies using (select auth.uid()) for 10x query performance
  await client.query(`
    DROP POLICY IF EXISTS "merchants_isolation_policy" ON merchants;
    CREATE POLICY "merchants_isolation_policy" ON merchants FOR ALL 
    USING ((select auth.uid()) = id OR (select auth.jwt() ->> 'role') = 'service_role');

    DROP POLICY IF EXISTS "api_keys_isolation_policy" ON merchant_api_keys;
    CREATE POLICY "api_keys_isolation_policy" ON merchant_api_keys FOR ALL 
    USING (merchant_id = (select auth.uid()) OR (select auth.jwt() ->> 'role') = 'service_role');

    DROP POLICY IF EXISTS "devices_isolation_policy" ON devices;
    CREATE POLICY "devices_isolation_policy" ON devices FOR ALL 
    USING (merchant_id = (select auth.uid()) OR (select auth.jwt() ->> 'role') = 'service_role');

    DROP POLICY IF EXISTS "invoices_isolation_policy" ON invoices;
    CREATE POLICY "invoices_isolation_policy" ON invoices FOR ALL 
    USING (merchant_id = (select auth.uid()) OR (select auth.jwt() ->> 'role') = 'service_role');

    DROP POLICY IF EXISTS "transactions_isolation_policy" ON transactions;
    CREATE POLICY "transactions_isolation_policy" ON transactions FOR ALL 
    USING (merchant_id = (select auth.uid()) OR (select auth.jwt() ->> 'role') = 'service_role');
  `);
  console.log('✅ RLS policies optimized with (select auth.uid())!');

  await client.end();
}

optimize().catch(console.error);
