import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../src/db/database';

describe('Approved MFS Channels & Dynamic Checkout Suite', () => {
  const db = new DatabaseService(':memory:');
  const merchantId = 'm_demo_101';

  const APPROVED_MFS_KEYS = [
    'bkash',
    'nagad',
    'rocket',
    'upay',
    'tap',
    'islamic_wallet',
    'mcash',
    'mycash',
    'ok_wallet',
    'meghna_pay',
    'telecash',
    'surecash',
    'rupali_surecash',
  ];

  it('should have all 13 Approved MFS providers seeded in the database', () => {
    const allMethods = db.getPaymentMethods(merchantId, false) as any[];
    const providerTypes = allMethods.map(m => m.provider_type);

    for (const key of APPROVED_MFS_KEYS) {
      assert.ok(
        providerTypes.includes(key),
        `Provider type "${key}" is missing from database seeds`
      );
    }
  });

  it('should toggle payment method active status dynamically', () => {
    const tapMethod = (db.getPaymentMethods(merchantId, false) as any[]).find(
      m => m.provider_type === 'tap'
    );
    assert.ok(tapMethod, 'TAP provider must exist');

    // Initially inactive
    assert.equal(tapMethod.is_active, 0);

    // Toggle to active
    db.togglePaymentMethod(tapMethod.id, merchantId, true);

    const activeListAfter = (db.getPaymentMethods(merchantId, true) as any[]).map(
      m => m.provider_type
    );
    assert.ok(
      activeListAfter.includes('tap'),
      'TAP must appear in active list after being toggled on'
    );

    // Toggle back to inactive
    db.togglePaymentMethod(tapMethod.id, merchantId, false);
    const activeListAfterOff = (db.getPaymentMethods(merchantId, true) as any[]).map(
      m => m.provider_type
    );
    assert.ok(
      !activeListAfterOff.includes('tap'),
      'TAP must disappear from active list after being toggled off'
    );
  });

  it('should verify only selected channels are returned for checkout', () => {
    const activeMethods = db.getPaymentMethods(merchantId, true) as any[];
    for (const method of activeMethods) {
      assert.equal(
        method.is_active,
        1,
        `Method ${method.id} returned in active list must have is_active == 1`
      );
    }
  });
});
