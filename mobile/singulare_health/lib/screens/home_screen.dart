import 'package:flutter/material.dart';
import '../services/background_sync.dart';
import '../services/ingest_client.dart';
import '../services/token_service.dart';
import 'welcome_screen.dart';

const _accent = Color(0xFF6E56CF);
const _accentDeep = Color(0xFF5746AF);

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _syncing = false;
  IngestResult? _lastResult;
  DateTime? _lastSyncAt;
  String? _error;

  Future<void> _syncNow() async {
    setState(() {
      _syncing = true;
      _error = null;
    });
    try {
      final token = await TokenService.read();
      if (token == null) throw Exception('sem_token');
      final r = await runSync(token: token);
      setState(() {
        _lastResult = r;
        _lastSyncAt = DateTime.now();
      });
    } catch (e) {
      setState(() => _error = 'Erro: $e');
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _disconnect() async {
    await cancelPeriodicSync();
    await TokenService.clear();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const WelcomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Singulare Saude'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Desconectar',
            onPressed: _disconnect,
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              const Icon(Icons.favorite, size: 64, color: _accent),
              const SizedBox(height: 16),
              const Text(
                'Monitoramento ativo',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, letterSpacing: -0.3),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _lastSyncAt == null
                    ? 'Sua clinica recebe seus dados automaticamente a cada 6h.'
                    : 'Ultima sincronizacao: ${_fmt(_lastSyncAt!)}',
                style: const TextStyle(color: Colors.black54),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              if (_lastResult != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F3FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      _row('Enviadas', _lastResult!.totalSent),
                      _row('Aceitas', _lastResult!.accepted),
                      if (_lastResult!.outliers > 0) _row('Anormais (avisar medico)', _lastResult!.outliers),
                      if (_lastResult!.rejected > 0) _row('Descartadas', _lastResult!.rejected),
                    ],
                  ),
                ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _syncing ? null : _syncNow,
                icon: _syncing
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.sync, size: 18),
                label: Text(_syncing ? 'Sincronizando...' : 'Sincronizar agora'),
                style: FilledButton.styleFrom(
                  backgroundColor: _accent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13), textAlign: TextAlign.center),
              ],
              const Spacer(),
              const Center(
                child: Text(
                  'Privacidade: singulare.org/privacidade/saude',
                  style: TextStyle(color: Colors.black38, fontSize: 11),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Colors.black54)),
          Text('$value', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: _accentDeep)),
        ],
      ),
    );
  }

  String _fmt(DateTime d) {
    final pad = (int n) => n.toString().padLeft(2, '0');
    return '${pad(d.day)}/${pad(d.month)} ${pad(d.hour)}:${pad(d.minute)}';
  }
}
