import 'package:flutter_test/flutter_test.dart';
import 'package:payflow_agent/features/sms/services/mfs_sms_parser.dart';

void main() {
  group('MFS SMS Parser Engine Test Suite', () {
    test('bKash: Parses standard Send Money and Payment notifications', () {
      const bkashSms =
          'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 8,500.00. TrxID 9J84BL201 at 19/09/2026 09:30';
      final result = MfsSmsParser.parse('bKash', bkashSms);

      expect(result.success, isTrue);
      expect(result.provider, equals('bKash'));
      expect(result.amount, equals(1500.0));
      expect(result.trxId, equals('9J84BL201'));
      expect(result.sender, equals('01712345678'));
    });

    test('bKash: Parses Cash In SMS format', () {
      const cashInSms =
          'Cash In Tk 2,000.00 from 01800000000 successful. Fee Tk 0.00. Balance Tk 12,000.00. TrxID 7KL92019A';
      final result = MfsSmsParser.parse('16247', cashInSms);

      expect(result.success, isTrue);
      expect(result.provider, equals('bKash'));
      expect(result.amount, equals(2000.0));
      expect(result.trxId, equals('7KL92019A'));
      expect(result.sender, equals('01800000000'));
    });

    test('Nagad: Parses Received Amount notification', () {
      const nagadSms =
          'Received Amount: Tk 1,500.00 from 01799887766. TxnID: 71NB482J. Balance: Tk 12,450.00';
      final result = MfsSmsParser.parse('Nagad', nagadSms);

      expect(result.success, isTrue);
      expect(result.provider, equals('Nagad'));
      expect(result.amount, equals(1500.0));
      expect(result.trxId, equals('71NB482J'));
      expect(result.sender, equals('01799887766'));
    });

    test('Nagad: Parses Money Received notification', () {
      const nagadSms2 =
          'Money received. Amount: Tk 350.00. Sender: 01811223344. TxnID: 80K2918A';
      final result = MfsSmsParser.parse('16167', nagadSms2);

      expect(result.success, isTrue);
      expect(result.provider, equals('Nagad'));
      expect(result.amount, equals(350.0));
      expect(result.trxId, equals('80K2918A'));
      expect(result.sender, equals('01811223344'));
    });

    test('Rocket: Parses DBBL transaction notification', () {
      const rocketSms =
          'Tk 500.00 received from 017223344559. TxnId: 29482910. Balance: Tk 2,400.00';
      final result = MfsSmsParser.parse('16216', rocketSms);

      expect(result.success, isTrue);
      expect(result.provider, equals('Rocket'));
      expect(result.amount, equals(500.0));
      expect(result.trxId, equals('29482910'));
      expect(result.sender, equals('017223344559'));
    });

    test('Upay: Parses UCB payment notification', () {
      const upaySms =
          'You have received Tk 750.00 from 01655443322. Fee Tk 0.00. Balance Tk 1,500.00. TrxID UPY982103 at 19/09/2026';
      final result = MfsSmsParser.parse('UPAY', upaySms);

      expect(result.success, isTrue);
      expect(result.provider, equals('Upay'));
      expect(result.amount, equals(750.0));
      expect(result.trxId, equals('UPY982103'));
      expect(result.sender, equals('01655443322'));
    });

    test('Rejects non-financial, OTP, or promotional messages', () {
      const spam1 = 'Your GP internet balance is 500MB. Recharge Tk 29 to activate.';
      final res1 = MfsSmsParser.parse('GP', spam1);
      expect(res1.success, isFalse);

      const spam2 = 'Your ZiniPay verification code is 829102. Do not share this OTP.';
      final res2 = MfsSmsParser.parse('1234', spam2);
      expect(res2.success, isFalse);
    });
  });
}
