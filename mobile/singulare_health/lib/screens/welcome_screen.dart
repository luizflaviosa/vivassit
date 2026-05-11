import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:app_links/app_links.dart';
import '../config.dart';
import '../services/token_service.dart';
import 'consent_screen.dart';

const _accent = Color(0xFF6E56CF);
const _accentDeep = Color(0xFF5746AF);

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final _linkCtrl = TextEditingController();
  bool _validating = false;
  String? _error;
  final _appLinks = AppLinks();

  @override
  void initState() {
    super.initState();
    _listenIncomingLinks();
    _checkInitial();
  }

  Future<void> _checkInitial() async {
    final initial = await _appLinks.getInitialAppLink();
    if (initial != null) _tryToken(initial.toString());
  }

  void _listenIncomingLinks() {
    _appLinks.uriLinkStream.listen((uri) {
      _tryToken(uri.toString());
    });
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text ?? '';
    if (text.isNotEmpty) {
      _linkCtrl.text = text;
      _tryToken(text);
    }
  }

  Future<void> _tryToken(String input) async {
    final token = TokenService.extractFromUrl(input) ?? input.trim();
    if (!RegExp(r'^[0-9a-f-]{36}$').hasMatch(token)) {
      setState(() => _error = 'Link invalido. Verifique e tente de novo.');
      return;
    }
    setState(() {
      _validating = true;
      _error = null;
    });
    try {
      final res = await http.get(Uri.parse('${AppConfig.apiBaseUrl}/api/saude/$token'));
      if (res.statusCode != 200) {
        setState(() => _error = 'Link nao encontrado ou expirado.');
        return;
      }
      final j = jsonDecode(res.body) as Map<String, dynamic>;
      if (j['success'] != true) {
        setState(() => _error = 'Link invalido.');
        return;
      }
      await TokenService.save(token);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const ConsentScreen()),
      );
    } catch (e) {
      setState(() => _error = 'Erro de conexao. Tente novamente.');
    } finally {
      if (mounted) setState(() => _validating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.favorite, size: 56, color: _accent),
              const SizedBox(height: 20),
              const Text(
                'Singulare Saude',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, letterSpacing: -0.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Cole o link que sua clinica te enviou no WhatsApp.',
                style: TextStyle(color: Colors.black54),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _linkCtrl,
                keyboardType: TextInputType.url,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Link da clinica',
                  hintText: 'singulare.org/saude/...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _validating ? null : () => _tryToken(_linkCtrl.text),
                style: FilledButton.styleFrom(
                  backgroundColor: _accent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _validating
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Continuar', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _validating ? null : _pasteFromClipboard,
                child: const Text('Colar da area de transferencia', style: TextStyle(color: _accentDeep)),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
