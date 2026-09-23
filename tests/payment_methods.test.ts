import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../src/db/database';

describe('Payment Methods Suite: Zero-Prefill & Dynamic Merchant Control', () => {
  const db = new DatabaseService(':memory:');
  const merchantId = 'm_demo_101';

  it('should start with 0 payment channels by default (clean slate on initial state)', () => {
    const allMethods = db.getPaymentMethods(merchantId, false) as any[];
    assert.equal(
      allMethods.length,
      0,
      'Merchant should start with 0 payment channels until explicitly added'
    );
  });

  it('should dynamically add payment channels when added by the merchant', () => {
    const bkash = db.upsertPaymentMethod({
      merchant_id: merchantId,
      provider_type: 'bkash',
      title: 'bKash',
      badge: 'MFS',
      account_number: '01580397069',
      is_active: 1,
    }) as any;

    assert.ok(bkash && bkash.id, 'Payment channel must be created with ID');
    const methodsAfterOne = db.getPaymentMethods(merchantId, false) as any[];
    assert.equal(methodsAfterOne.length, 1, 'Exactly 1 payment method should exist');
    assert.equal(methodsAfterOne[0].provider_type, 'bkash');
  });

  it('should toggle payment method active status dynamically', () => {
    const methods = db.getPaymentMethods(merchantId, false) as any[];
    const channel = methods[0];
    assert.ok(channel, 'Channel must exist');

    // Toggle to inactive
    db.togglePaymentMethod(channel.id, merchantId, false);
    const activeListOff = db.getPaymentMethods(merchantId, true) as any[];
    assert.equal(activeListOff.length, 0, 'Inactive channel must not be returned in checkout active list');

    // Toggle back to active
    db.togglePaymentMethod(channel.id, merchantId, true);
    const activeListOn = db.getPaymentMethods(merchantId, true) as any[];
    assert.equal(activeListOn.length, 1, 'Channel should return to active list');
  });

  it('should support saving and retrieving custom qr_code_url on payment channels', () => {
    const testQrData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const method = db.upsertPaymentMethod({
      merchant_id: merchantId,
      provider_type: 'nagad',
      title: 'Nagad Store',
      account_number: '01712345678',
      qr_code_url: testQrData,
      is_active: 1,
    }) as any;

    assert.ok(method, 'Nagad channel should be created');
    assert.equal(method.qr_code_url, testQrData, 'qr_code_url must match uploaded test QR data');

    // Update with clear/remove QR
    const updated = db.upsertPaymentMethod({
      id: method.id,
      merchant_id: merchantId,
      provider_type: 'nagad',
      title: 'Nagad Store',
      account_number: '01712345678',
      qr_code_url: '',
    }) as any;

    assert.equal(updated.qr_code_url, null, 'qr_code_url should be null when cleared');
  });

  it('should delete payment method and remove it from merchant list', () => {
    const methods = db.getPaymentMethods(merchantId, false) as any[];
    for (const m of methods) {
      db.deletePaymentMethod(m.id, merchantId);
    }

    const remaining = db.getPaymentMethods(merchantId, false) as any[];
    assert.equal(remaining.length, 0, 'All payment methods should be deleted');
  });
});
