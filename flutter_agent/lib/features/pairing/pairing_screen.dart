import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/localization/app_localizations.dart';
import '../dashboard/providers/agent_provider.dart';
import '../permissions/permission_screen.dart';

class PairingScreen extends ConsumerStatefulWidget {
  const PairingScreen({super.key});

  @override
  ConsumerState<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends ConsumerState<PairingScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isManual = false;
  bool _isScanning = false;

  late final TextEditingController _merchantIdCtrl;
  late final TextEditingController _businessNameCtrl;
  late final TextEditingController _tokenCtrl;
  late final TextEditingController _backendUrlCtrl;
  late String _deviceId;

  @override
  void initState() {
    super.initState();
    final vault = ref.read(localVaultProvider);
    _deviceId = vault.deviceId;
    _merchantIdCtrl = TextEditingController(text: vault.merchantId);
    _businessNameCtrl = TextEditingController(text: vault.merchantName);
    _tokenCtrl = TextEditingController(text: vault.deviceToken);
    _backendUrlCtrl = TextEditingController(text: vault.backendUrl);
  }

  @override
  void dispose() {
    _merchantIdCtrl.dispose();
    _businessNameCtrl.dispose();
    _tokenCtrl.dispose();
    _backendUrlCtrl.dispose();
    super.dispose();
  }

  void _simulateQrScan() async {
    setState(() => _isScanning = true);
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    _merchantIdCtrl.text = 'MER_001';
    _businessNameCtrl.text = 'ABC Store BD';
    _tokenCtrl.text = 'token_phone_primary';
    _backendUrlCtrl.text = 'http://10.0.2.2:4000';

    setState(() => _isScanning = false);

    _submitPairing();
  }

  Future<void> _submitPairing() async {
    if (_formKey.currentState?.validate() ?? false) {
      await ref.read(agentProvider.notifier).updatePairingConfig(
            backendUrl: _backendUrlCtrl.text.trim(),
            deviceToken: _tokenCtrl.text.trim(),
            merchantId: _merchantIdCtrl.text.trim(),
            merchantName: _businessNameCtrl.text.trim(),
          );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Device Connected Successfully'),
          backgroundColor: Color(0xFF10B981),
        ),
      );

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const PermissionScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final agentState = ref.watch(agentProvider);
    final loc = AppLocalizations(agentState.language);

    return Scaffold(
      appBar: AppBar(
        title: Text(loc.tr('connect_your_device')),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 12),
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6366F1).withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.qr_code_scanner,
                      size: 48,
                      color: Color(0xFF6366F1),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  loc.tr('connect_your_device'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  loc.tr('connect_device_desc'),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                ),
                const SizedBox(height: 24),

                // Device ID Readonly card
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        loc.tr('device_id'),
                        style: const TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                      Text(
                        _deviceId,
                        style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // QR Scanner Button
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _isScanning ? null : _simulateQrScan,
                  icon: _isScanning
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.qr_code),
                  label: Text(_isScanning ? 'Scanning QR...' : loc.tr('scan_qr_code')),
                ),
                const SizedBox(height: 16),

                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    setState(() => _isManual = !_isManual);
                  },
                  child: Text(_isManual ? 'Hide Manual Config' : loc.tr('enter_pairing_code')),
                ),

                if (_isManual) ...[
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _merchantIdCtrl,
                    decoration: InputDecoration(
                      labelText: loc.tr('merchant_id'),
                      prefixIcon: const Icon(Icons.business),
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _businessNameCtrl,
                    decoration: InputDecoration(
                      labelText: loc.tr('business_name'),
                      prefixIcon: const Icon(Icons.store),
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _tokenCtrl,
                    decoration: InputDecoration(
                      labelText: loc.tr('pairing_token'),
                      prefixIcon: const Icon(Icons.vpn_key),
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _backendUrlCtrl,
                    decoration: InputDecoration(
                      labelText: loc.tr('backend_url'),
                      prefixIcon: const Icon(Icons.link),
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: _submitPairing,
                    child: Text(loc.tr('connect_device_btn')),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
