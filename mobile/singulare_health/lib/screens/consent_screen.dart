import 'package:flutter/material.dart';
import '../services/health_data_engine.dart';
import '../services/background_sync.dart';
import 'home_screen.dart';

const _accent = Color(0xFF6E56CF);
const _accentDeep = Color(0xFF5746AF);

class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool _loading = false;
  String? _error;

  Future<void> _accept() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final engine = HealthDataEngine();
    final available = await engine.isAvailable();
    if (!available) {
      setState(() {
        _loading = false;
        _error = 'Health Connect nao instalado. Instale via Google Play e abra o app de novo.';
      });
      return;
    }
    final granted = await engine.requestPermissions();
    if (!granted) {
      setState(() {
        _loading = false;
        _error = 'Permissao negada. Sem ela nao conseguimos sincronizar.';
      });
      return;
    }
    await registerPeriodicSync();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Consentimento'),
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.shield_outlined, size: 48, color: _accent),
              const SizedBox(height: 16),
              const Text(
                'Vamos sincronizar com sua saude',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, letterSpacing: -0.3),
              ),
              const SizedBox(height: 12),
              const Text(
                'Pra sua clinica acompanhar voce entre consultas, o Singulare le do seu Apple Health (iOS) ou Health Connect (Android):',
                style: TextStyle(color: Colors.black54, height: 1.45),
              ),
              const SizedBox(height: 16),
              ..._items.map(
                (i) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.check, size: 16, color: _accentDeep),
                      const SizedBox(width: 8),
                      Expanded(child: Text(i, style: const TextStyle(fontSize: 14))),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Os dados sao enviados de forma criptografada para a sua clinica. Apenas profissionais autorizados acessam. Voce pode revogar a permissao a qualquer momento nas configuracoes do sistema.',
                style: TextStyle(color: Colors.black45, fontSize: 12, height: 1.4),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _accept,
                style: FilledButton.styleFrom(
                  backgroundColor: _accent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _loading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Eu autorizo', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13), textAlign: TextAlign.center),
              ],
              const Spacer(),
              const Center(
                child: Text(
                  'Politica completa: singulare.org/privacidade/saude',
                  style: TextStyle(color: Colors.black38, fontSize: 11),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

const _items = <String>[
  'Frequencia cardiaca e variabilidade (HRV)',
  'Pressao arterial, peso, glicemia, temperatura, SpO2',
  'Passos, distancia e energia ativa',
  'Fases do sono',
];
