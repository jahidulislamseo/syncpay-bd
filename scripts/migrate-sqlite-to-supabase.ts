import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { CryptoUtil } from '../src/utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../payflow.db');

// Deterministic UUID mapper for legacy non-UUID IDs
function mapToUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  if (id === 'm_demo_101') return '00000000-0000-0000-0000-000000000101';
  if (id === 'm_payflow_sandbox') return '00000000-0000-0000-0000-000000000999';
  if (id === 'dev_phone_1') return '00000000-0000-0000-0000-000000000001';

  // Generate deterministic 32-char hex from SHA256 of string
  const hash = CryptoUtil.hashToken(id);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided.');
    console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-sqlite-to-supabase.ts');
    process.exit(1);
  }

  console.log('🚀 Connecting to Supabase PostgreSQL at:', supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📂 Opening local SQLite database at:', DB_PATH);
  const sqlite = new DatabaseSync(DB_PATH);

  // 1. Migrate Merchants
  console.log('\n[1/5] Migrating Merchants...');
  const merchants = sqlite.prepare('SELECT * FROM merchants').all() as any[];
  for (const m of merchants) {
    const merchantUuid = mapToUuid(m.id);
    const { error } = await supabase.from('merchants').upsert({
      id: merchantUuid,
      business_name: m.name,
      email: m.id === 'm_demo_101' ? 'merchant@example.com' : 'sandbox@payflowmfs.com',
      webhook_url: m.webhook_url,
      status: 'ACTIVE',
      created_at: m.created_at,
    });
    if (error) console.error(`⚠️ Merchant ${m.id} failed:`, error.message);
    else console.log(`  ✓ Merchant migrated: ${m.name} -> ${merchantUuid}`);

    // Create primary API key record in merchant_api_keys
    if (m.api_key) {
      const keyHash = CryptoUtil.hashToken(m.api_key);
      await supabase.from('merchant_api_keys').upsert({
        merchant_id: merchantUuid,
        key_prefix: m.api_key.substring(0, 8),
        key_hash: keyHash,
        name: 'Primary API Key',
        status: 'active',
      }, { onConflict: 'key_hash' });
    }
  }

  // 2. Migrate Additional API Keys
  console.log('\n[2/5] Migrating Additional API Keys...');
  try {
    const apiKeys = sqlite.prepare('SELECT * FROM api_keys').all() as any[];
    for (const k of apiKeys) {
      const merchantUuid = mapToUuid(k.merchant_id);
      const keyHash = CryptoUtil.hashToken(k.secret_key);
      const { error } = await supabase.from('merchant_api_keys').upsert({
        merchant_id: merchantUuid,
        key_prefix: k.key_prefix,
        key_hash: keyHash,
        name: k.name,
        status: k.status,
        created_at: k.created_at,
      }, { onConflict: 'key_hash' });
      if (error) console.error(`⚠️ API Key ${k.id} failed:`, error.message);
      else console.log(`  ✓ API Key migrated: ${k.name} for ${k.merchant_id}`);
    }
  } catch (e: any) {
    console.log('  ℹ No api_keys table or empty');
  }

  // 3. Migrate Devices
  console.log('\n[3/5] Migrating Telephony Devices...');
  const devices = sqlite.prepare('SELECT * FROM devices').all() as any[];
  for (const d of devices) {
    const deviceUuid = mapToUuid(d.id);
    const merchantUuid = mapToUuid(d.merchant_id);
    const tokenHash = CryptoUtil.hashToken(d.device_token);

    const { error } = await supabase.from('devices').upsert({
      id: deviceUuid,
      merchant_id: merchantUuid,
      device_token_hash: tokenHash,
      device_name: d.device_name,
      device_model: 'Samsung Galaxy A54',
      android_version: 'Android 14',
      mfs_provider: 'ALL',
      status: d.status || 'ONLINE',
      last_seen_at: d.last_seen,
    }, { onConflict: 'device_token_hash' });
    if (error) console.error(`⚠️ Device ${d.id} failed:`, error.message);
    else console.log(`  ✓ Device migrated: ${d.device_name} -> ${deviceUuid}`);
  }

  // 4. Migrate Invoices
  console.log('\n[4/5] Migrating Invoices...');
  const invoices = sqlite.prepare('SELECT * FROM invoices').all() as any[];
  for (const inv of invoices) {
    const invoiceUuid = mapToUuid(inv.id);
    const merchantUuid = mapToUuid(inv.merchant_id);

    const { error } = await supabase.from('invoices').upsert({
      id: invoiceUuid,
      merchant_id: merchantUuid,
      invoice_id: inv.id,
      customer_name: inv.customer_name,
      amount: inv.expected_amount,
      redirect_url: inv.redirect_url || null,
      webhook_url: inv.webhook_url || null,
      status: inv.status,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
    }, { onConflict: 'invoice_id' });
    if (error) console.error(`⚠️ Invoice ${inv.id} failed:`, error.message);
    else console.log(`  ✓ Invoice migrated: ${inv.id}`);
  }

  // 5. Migrate Transactions
  console.log('\n[5/5] Migrating Transactions...');
  const transactions = sqlite.prepare('SELECT * FROM transactions').all() as any[];
  for (const t of transactions) {
    const merchantUuid = mapToUuid(t.merchant_id);
    const deviceUuid = mapToUuid(t.device_id);

    const { error } = await supabase.from('transactions').upsert({
      merchant_id: merchantUuid,
      device_id: deviceUuid,
      provider: t.provider,
      trx_id: t.trx_id,
      amount: t.amount,
      sender_number: t.sender || null,
      raw_sms: t.raw_sms,
      status: t.is_verified === 1 ? 'COMPLETED' : 'PENDING',
      created_at: t.created_at,
    }, { onConflict: 'merchant_id,trx_id' });
    if (error) console.error(`⚠️ Transaction ${t.trx_id} failed:`, error.message);
    else console.log(`  ✓ Transaction migrated: ${t.trx_id} (Tk ${t.amount})`);
  }

  console.log('\n🎉 SQLite to Supabase Migration Completed Successfully!');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
