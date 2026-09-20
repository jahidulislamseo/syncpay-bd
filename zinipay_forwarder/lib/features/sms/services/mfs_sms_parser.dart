import '../../../../core/security/security_utils.dart';
import '../models/sms_transaction.dart';

class ParsedMfsResult {
  final bool success;
  final String provider; // 'bKash','Nagad','Rocket','Upay','DBBL','BRAC','IslamiBank','CityBank','UNKNOWN'
  final String? trxId;
  final double? amount;
  final String? sender;
  final double? balance;
  final String rawText;
  final String? error;

  const ParsedMfsResult({
    required this.success,
    required this.provider,
    this.trxId,
    this.amount,
    this.sender,
    this.balance,
    required this.rawText,
    this.error,
  });

  SmsTransaction toTransaction({int? simSlot, String? carrier, String? source = 'SMS'}) {
    final cleanTrx    = (trxId ?? '').toUpperCase();
    final cleanAmount = amount ?? 0.0;
    final fingerprint = SecurityUtils.generateFingerprint(provider, cleanTrx, cleanAmount);
    return SmsTransaction(
      id:         'trx_${DateTime.now().millisecondsSinceEpoch}_$cleanTrx',
      provider:   provider,
      trxId:      cleanTrx,
      amount:     cleanAmount,
      sender:     sender ?? '',
      rawSms:     rawText,
      receivedAt: DateTime.now(),
      status:     SmsStatus.received,
      fingerprint: fingerprint,
      simSlot:    simSlot,
      carrier:    carrier,
      source:     source,
    );
  }

  /// Human-friendly provider colour
  static int colorFor(String provider) {
    switch (provider) {
      case 'bKash':      return 0xFFE2136E;
      case 'Nagad':      return 0xFFF7941D;
      case 'Rocket':     return 0xFF8C3494;
      case 'Upay':       return 0xFF00A3E0;
      case 'DBBL':       return 0xFF005BAC;
      case 'BRAC':       return 0xFFE31837;
      case 'IslamiBank': return 0xFF006400;
      case 'CityBank':   return 0xFF003087;
      default:           return 0xFF6B7280;
    }
  }
}

class MfsSmsParser {
  // ── bKash ────────────────────────────────────────────────────────────────
  static final _bkashTrx    = RegExp(r'TrxID\s+([A-Z0-9_-]+)',                      caseSensitive: false);
  static final _bkashAmount = RegExp(r'(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)', caseSensitive: false);
  static final _bkashSender = RegExp(r'from\s+([0-9+]+)',                            caseSensitive: false);
  static final _bkashBal    = RegExp(r'Balance\s+Tk\s+([\d,]+\.?\d*)',               caseSensitive: false);

  // ── Nagad ────────────────────────────────────────────────────────────────
  static final _nagadTrx    = RegExp(r'(?:TxnID|TrxID):\s*([A-Z0-9]+)',             caseSensitive: false);
  static final _nagadAmount = RegExp(r'(?:Amount:?\s*Tk|Received Amount:?\s*Tk)\s*([\d,]+\.?\d*)', caseSensitive: false);
  static final _nagadSender = RegExp(r'(?:from|Sender:?)\s*([0-9+]+)',               caseSensitive: false);
  static final _nagadBal    = RegExp(r'Balance:?\s*Tk\s*([\d,]+\.?\d*)',             caseSensitive: false);

  // ── Rocket ───────────────────────────────────────────────────────────────
  static final _rocketTrx    = RegExp(r'(?:TxnId|TrxID|Txn ID):\s*([A-Z0-9]+)',    caseSensitive: false);
  static final _rocketAmount = RegExp(r'Tk\s*([\d,]+\.?\d*)\s*received',             caseSensitive: false);
  static final _rocketSender = RegExp(r'from\s*([0-9+]+)',                           caseSensitive: false);

  // ── Upay ─────────────────────────────────────────────────────────────────
  static final _upayTrx1    = RegExp(r'(?:TrxID|TxnID|Txn ID):\s*([A-Z0-9]+)',     caseSensitive: false);
  static final _upayTrx2    = RegExp(r'(?:TrxID|TxnID)\s+([A-Z0-9]+)',              caseSensitive: false);
  static final _upayAmount1 = RegExp(r'(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)', caseSensitive: false);
  static final _upayAmount2 = RegExp(r'Tk\s*([\d,]+\.?\d*)\s*received',              caseSensitive: false);
  static final _upaySender  = RegExp(r'from\s+([0-9+]+)',                            caseSensitive: false);
  static final _upayBal     = RegExp(r'Balance\s+Tk\s+([\d,]+\.?\d*)',              caseSensitive: false);

  // ── Banks (BDT) ──────────────────────────────────────────────────────────
  static final _bankTrx  = RegExp(r'(?:Ref|TxnRef|TxnID|Ref No):\s*([A-Z0-9-]+)', caseSensitive: false);
  static final _bankBDT  = RegExp(r'BDT\s*([\d,]+\.?\d*)',                          caseSensitive: false);
  static final _bankBal  = RegExp(r'(?:Bal|Avl Bal|Avail Bal|Available Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)', caseSensitive: false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  static double _num(String raw) => double.tryParse(raw.replaceAll(',', '')) ?? 0.0;
  static String? _clean(RegExpMatch? m) => m?.group(1)?.replaceAll(RegExp(r'^\+?88'), '');

  // ── MFS parsers ──────────────────────────────────────────────────────────
  static ParsedMfsResult parseBkash(String text) {
    final t = _bkashTrx.firstMatch(text);
    final a = _bkashAmount.firstMatch(text);
    if (t != null && a != null) {
      return ParsedMfsResult(
        success: true, provider: 'bKash',
        trxId:   t.group(1)!.toUpperCase(),
        amount:  _num(a.group(1)!),
        sender:  _clean(_bkashSender.firstMatch(text)),
        balance: _bkashBal.firstMatch(text) != null ? _num(_bkashBal.firstMatch(text)!.group(1)!) : null,
        rawText: text,
      );
    }
    return ParsedMfsResult(success: false, provider: 'bKash', rawText: text, error: 'Failed bKash parse');
  }

  static ParsedMfsResult parseNagad(String text) {
    final t = _nagadTrx.firstMatch(text);
    final a = _nagadAmount.firstMatch(text);
    if (t != null && a != null) {
      return ParsedMfsResult(
        success: true, provider: 'Nagad',
        trxId:   t.group(1)!.toUpperCase(),
        amount:  _num(a.group(1)!),
        sender:  _clean(_nagadSender.firstMatch(text)),
        balance: _nagadBal.firstMatch(text) != null ? _num(_nagadBal.firstMatch(text)!.group(1)!) : null,
        rawText: text,
      );
    }
    return ParsedMfsResult(success: false, provider: 'Nagad', rawText: text, error: 'Failed Nagad parse');
  }

  static ParsedMfsResult parseRocket(String text) {
    final t = _rocketTrx.firstMatch(text);
    final a = _rocketAmount.firstMatch(text);
    if (t != null && a != null) {
      return ParsedMfsResult(
        success: true, provider: 'Rocket',
        trxId:  t.group(1)!.toUpperCase(),
        amount: _num(a.group(1)!),
        sender: _clean(_rocketSender.firstMatch(text)),
        rawText: text,
      );
    }
    return ParsedMfsResult(success: false, provider: 'Rocket', rawText: text, error: 'Failed Rocket parse');
  }

  static ParsedMfsResult parseUpay(String text) {
    final t = _upayTrx1.firstMatch(text) ?? _upayTrx2.firstMatch(text);
    final a = _upayAmount1.firstMatch(text) ?? _upayAmount2.firstMatch(text);
    if (t != null && a != null) {
      return ParsedMfsResult(
        success: true, provider: 'Upay',
        trxId:   t.group(1)!.toUpperCase(),
        amount:  _num(a.group(1)!),
        sender:  _clean(_upaySender.firstMatch(text)),
        balance: _upayBal.firstMatch(text) != null ? _num(_upayBal.firstMatch(text)!.group(1)!) : null,
        rawText: text,
      );
    }
    return ParsedMfsResult(success: false, provider: 'Upay', rawText: text, error: 'Failed Upay parse');
  }

  // ── Bank parsers ─────────────────────────────────────────────────────────
  static ParsedMfsResult _parseBank(String text, String provider) {
    final t = _bankTrx.firstMatch(text);
    // find first BDT amount that is NOT the balance
    final allBdt = _bankBDT.allMatches(text).toList();
    final bal    = _bankBal.firstMatch(text);
    double? amount;
    if (allBdt.isNotEmpty) {
      // Use the first BDT amount that differs from balance
      for (final m in allBdt) {
        final v = _num(m.group(1)!);
        if (bal == null || v != _num(bal.group(1)!)) { amount = v; break; }
      }
      amount ??= _num(allBdt.first.group(1)!);
    }
    if (t != null && amount != null) {
      return ParsedMfsResult(
        success: true, provider: provider,
        trxId:   t.group(1)!.toUpperCase(),
        amount:  amount,
        balance: bal != null ? _num(bal.group(1)!) : null,
        rawText: text,
      );
    }
    return ParsedMfsResult(success: false, provider: provider, rawText: text, error: 'Failed $provider parse');
  }

  static ParsedMfsResult parseDBBL(String text)       => _parseBank(text, 'DBBL');
  static ParsedMfsResult parseBRAC(String text)        => _parseBank(text, 'BRAC');
  static ParsedMfsResult parseIslamiBank(String text)  => _parseBank(text, 'IslamiBank');
  static ParsedMfsResult parseCityBank(String text)    => _parseBank(text, 'CityBank');

  // ── Universal entrypoint ──────────────────────────────────────────────────
  static ParsedMfsResult parse(String senderAddress, String body) {
    final c = '$senderAddress $body'.toUpperCase();

    // MFS Wallets
    if (c.contains('BKASH')  || c.contains('16247')) return parseBkash(body);
    if (c.contains('NAGAD')  || c.contains('16167')) return parseNagad(body);
    if (c.contains('ROCKET') || c.contains('16216')) return parseRocket(body);
    if (c.contains('UPAY')   || c.contains('16268')) return parseUpay(body);

    // Banks
    if (c.contains('DBBL') || c.contains('DUTCH-BANGLA') || c.contains('DUTCHBANGLA')) return parseDBBL(body);
    if (c.contains('BRAC BANK') || c.contains('BRACBANK'))                               return parseBRAC(body);
    if (c.contains('IBBL') || c.contains('ISLAMI BANK') || c.contains('ISLAMIBANK'))    return parseIslamiBank(body);
    if (c.contains('CITY BANK') || c.contains('CITYBANK') || c.contains('CBTXN'))       return parseCityBank(body);

    // Auto-detect by body keywords
    if (body.contains('bKash') || body.contains('TrxID'))  return parseBkash(body);
    if (body.contains('Nagad') || body.contains('TxnID'))  return parseNagad(body);
    if (body.toLowerCase().contains('upay'))                return parseUpay(body);
    if (body.contains('IBBL'))                              return parseIslamiBank(body);
    if (body.contains('BRAC'))                              return parseBRAC(body);

    return ParsedMfsResult(
      success: false, provider: 'UNKNOWN',
      rawText: body,  error: 'Unrecognized MFS/Bank SMS format',
    );
  }
}
