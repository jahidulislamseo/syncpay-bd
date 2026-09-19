import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MfsParser } from '../src/parsers/mfs.parser.js';

describe('MFS SMS Regex Parser Engine', () => {
  test('should parse bKash Send Money SMS correctly', () => {
    const raw = 'You have received Tk 1,500.00 from 01799123456. Fee Tk 0.00. Balance Tk 12,500.00. TrxID 9J84BL201 at 19/09/2026 09:30';
    const result = MfsParser.parse('bKash', raw);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'bKash');
    assert.strictEqual(result.trxId, '9J84BL201');
    assert.strictEqual(result.amount, 1500);
    assert.strictEqual(result.sender, '01799123456');
    assert.strictEqual(result.balance, 12500);
  });

  test('should parse bKash Payment SMS with commas in amount', () => {
    const raw = 'You have received payment Tk 25,000.50 from +8801812345678. Ref order_991. TrxID 8A94K821M at 19/09/2026';
    const result = MfsParser.parse('16247', raw);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'bKash');
    assert.strictEqual(result.trxId, '8A94K821M');
    assert.strictEqual(result.amount, 25000.5);
    assert.strictEqual(result.sender, '01812345678');
  });

  test('should parse Nagad Received Money SMS', () => {
    const raw = 'Received Amount: Tk 3,450.00 from 01612345678. TxnID: 71NB482J. Balance: Tk 18,450.00';
    const result = MfsParser.parse('16167', raw);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'Nagad');
    assert.strictEqual(result.trxId, '71NB482J');
    assert.strictEqual(result.amount, 3450);
    assert.strictEqual(result.sender, '01612345678');
    assert.strictEqual(result.balance, 18450);
  });

  test('should parse Rocket Transaction SMS', () => {
    const raw = 'Tk 750.00 received from 017123456789. TxnId: 98124018. Balance: Tk 1,250.00';
    const result = MfsParser.parse('16216', raw);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'Rocket');
    assert.strictEqual(result.trxId, '98124018');
    assert.strictEqual(result.amount, 750);
  });

  test('should parse Upay Transaction SMS', () => {
    const raw = 'You have received Tk 1,200.00 from 01811223344. Fee Tk 0.00. Balance Tk 3,400.00. TrxID UPY8192019 at 19/09/2026';
    const result = MfsParser.parse('16268', raw);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'Upay');
    assert.strictEqual(result.trxId, 'UPY8192019');
    assert.strictEqual(result.amount, 1200);
    assert.strictEqual(result.sender, '01811223344');
    assert.strictEqual(result.balance, 3400);
  });

  test('should reject malformed or non-financial SMS', () => {
    const raw = 'Your OTP code for verification is 492019. Do not share this with anyone.';
    const result = MfsParser.parse('GP-INFO', raw);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.provider, 'UNKNOWN');
  });
});
