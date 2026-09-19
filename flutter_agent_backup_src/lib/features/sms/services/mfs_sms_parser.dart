import '../../../../core/security/security_utils.dart';
import '../models/sms_transaction.dart';

class ParsedMfsResult {
  final bool success;
  final String provider; // 'bKash', 'Nagad', 'Rocket', 'Upay', 'UNKNOWN'
  final String? trxId;
  final double? amount;
  final String? sender;
  final String rawText;
  final String? error;

  const ParsedMfsResult({
    required this.success,
    required this.provider,
    this.trxId,
    this.amount,
    this.sender,
    required this.rawText,
    this.error,
  });

  SmsTransaction toTransaction() {
    final cleanProvider = provider;
    final cleanTrx = (trxId ?? '').toUpperCase();
    final cleanAmount = amount ?? 0.0;
    final fingerprint = SecurityUtils.generateFingerprint(cleanProvider, cleanTrx, cleanAmount);
    return SmsTransaction(
      id: 'trx_${DateTime.now().millisecondsSinceEpoch}_$cleanTrx',
      provider: cleanProvider,
      trxId: cleanTrx,
      amount: cleanAmount,
      sender: sender ?? '',
      rawSms: rawText,
      receivedAt: DateTime.now(),
      status: SmsStatus.received,
      fingerprint: fingerprint,
    );
  }
}

class MfsSmsParser {
  static final RegExp _bkashTrx = RegExp(r'TrxID\s+([A-Z0-9_-]+)', caseSensitive: false);
  static final RegExp _bkashAmount = RegExp(r'(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)', caseSensitive: false);
  static final RegExp _bkashSender = RegExp(r'from\s+([0-9+]+)', caseSensitive: false);

  static final RegExp _nagadTrx = RegExp(r'(?:TxnID|TrxID):\s*([A-Z0-9]+)', caseSensitive: false);
  static final RegExp _nagadAmount = RegExp(r'(?:Amount:?\s*Tk|Received Amount:?\s*Tk)\s*([\d,]+\.?\d*)', caseSensitive: false);
  static final RegExp _nagadSender = RegExp(r'(?:from|Sender:?)\s*([0-9+]+)', caseSensitive: false);

  static final RegExp _rocketTrx = RegExp(r'(?:TxnId|TrxID|Txn ID):\s*([A-Z0-9]+)', caseSensitive: false);
  static final RegExp _rocketAmount = RegExp(r'Tk\s*([\d,]+\.?\d*)\s*received', caseSensitive: false);
  static final RegExp _rocketSender = RegExp(r'from\s*([0-9+]+)', caseSensitive: false);

  static final RegExp _upayTrx1 = RegExp(r'(?:TrxID|TxnID|Txn ID):\s*([A-Z0-9]+)', caseSensitive: false);
  static final RegExp _upayTrx2 = RegExp(r'(?:TrxID|TxnID)\s+([A-Z0-9]+)', caseSensitive: false);
  static final RegExp _upayAmount1 = RegExp(r'(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)', caseSensitive: false);
  static final RegExp _upayAmount2 = RegExp(r'Tk\s*([\d,]+\.?\d*)\s*received', caseSensitive: false);
  static final RegExp _upaySender = RegExp(r'from\s+([0-9+]+)', caseSensitive: false);

  static ParsedMfsResult parseBkash(String text) {
    final trxMatch = _bkashTrx.firstMatch(text);
    final amountMatch = _bkashAmount.firstMatch(text);
    final senderMatch = _bkashSender.firstMatch(text);

    if (trxMatch != null && amountMatch != null) {
      final amount = double.tryParse(amountMatch.group(1)!.replaceAll(',', '')) ?? 0.0;
      final sender = senderMatch != null ? senderMatch.group(1)!.replaceAll(RegExp(r'^\+?88'), '') : null;
      return ParsedMfsResult(
        success: true,
        provider: 'bKash',
        trxId: trxMatch.group(1)!.toUpperCase(),
        amount: amount,
        sender: sender,
        rawText: text,
      );
    }

    return ParsedMfsResult(
      success: false,
      provider: 'bKash',
      rawText: text,
      error: 'Failed to extract bKash TrxID or Amount',
    );
  }

  static ParsedMfsResult parseNagad(String text) {
    final trxMatch = _nagadTrx.firstMatch(text);
    final amountMatch = _nagadAmount.firstMatch(text);
    final senderMatch = _nagadSender.firstMatch(text);

    if (trxMatch != null && amountMatch != null) {
      final amount = double.tryParse(amountMatch.group(1)!.replaceAll(',', '')) ?? 0.0;
      final sender = senderMatch != null ? senderMatch.group(1)!.replaceAll(RegExp(r'^\+?88'), '') : null;
      return ParsedMfsResult(
        success: true,
        provider: 'Nagad',
        trxId: trxMatch.group(1)!.toUpperCase(),
        amount: amount,
        sender: sender,
        rawText: text,
      );
    }

    return ParsedMfsResult(
      success: false,
      provider: 'Nagad',
      rawText: text,
      error: 'Failed to extract Nagad TxnID or Amount',
    );
  }

  static ParsedMfsResult parseRocket(String text) {
    final trxMatch = _rocketTrx.firstMatch(text);
    final amountMatch = _rocketAmount.firstMatch(text);
    final senderMatch = _rocketSender.firstMatch(text);

    if (trxMatch != null && amountMatch != null) {
      final amount = double.tryParse(amountMatch.group(1)!.replaceAll(',', '')) ?? 0.0;
      final sender = senderMatch != null ? senderMatch.group(1)!.replaceAll(RegExp(r'^\+?88'), '') : null;
      return ParsedMfsResult(
        success: true,
        provider: 'Rocket',
        trxId: trxMatch.group(1)!.toUpperCase(),
        amount: amount,
        sender: sender,
        rawText: text,
      );
    }

    return ParsedMfsResult(
      success: false,
      provider: 'Rocket',
      rawText: text,
      error: 'Failed to extract Rocket TxnId or Amount',
    );
  }

  static ParsedMfsResult parseUpay(String text) {
    final trxMatch = _upayTrx1.firstMatch(text) ?? _upayTrx2.firstMatch(text);
    final amountMatch = _upayAmount1.firstMatch(text) ?? _upayAmount2.firstMatch(text);
    final senderMatch = _upaySender.firstMatch(text);

    if (trxMatch != null && amountMatch != null) {
      final amount = double.tryParse(amountMatch.group(1)!.replaceAll(',', '')) ?? 0.0;
      final sender = senderMatch != null ? senderMatch.group(1)!.replaceAll(RegExp(r'^\+?88'), '') : null;
      return ParsedMfsResult(
        success: true,
        provider: 'Upay',
        trxId: trxMatch.group(1)!.toUpperCase(),
        amount: amount,
        sender: sender,
        rawText: text,
      );
    }

    return ParsedMfsResult(
      success: false,
      provider: 'Upay',
      rawText: text,
      error: 'Failed to extract Upay TrxID or Amount',
    );
  }

  /// Universal parse entrypoint matching backend MfsParser logic
  static ParsedMfsResult parse(String senderAddress, String body) {
    final combined = '$senderAddress $body'.toUpperCase();

    if (combined.contains('BKASH') || combined.contains('16247')) {
      return parseBkash(body);
    }

    if (combined.contains('NAGAD') || combined.contains('16167')) {
      return parseNagad(body);
    }

    if (combined.contains('ROCKET') || combined.contains('16216') || combined.contains('DBBL')) {
      return parseRocket(body);
    }

    if (combined.contains('UPAY') || combined.contains('16268')) {
      return parseUpay(body);
    }

    // Auto-detect by keywords in body
    if (body.contains('bKash') || body.contains('TrxID')) {
      return parseBkash(body);
    }
    if (body.contains('Nagad') || body.contains('TxnID')) {
      return parseNagad(body);
    }
    if (body.toLowerCase().contains('upay')) {
      return parseUpay(body);
    }

    return ParsedMfsResult(
      success: false,
      provider: 'UNKNOWN',
      rawText: body,
      error: 'Unrecognized MFS SMS format',
    );
  }
}
