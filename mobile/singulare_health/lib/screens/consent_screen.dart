import 'package:flutter/material.dart';

import '../services/onboarding_state.dart';
import '../theme.dart';
import '../widgets/primary_button.dart';
import 'home_screen.dart';

/// Tela de consent LGPD.
///
/// Apresenta de forma transparente:
///   1. Que dados sao lidos (cardiologico, fisiologico, atividade, sono)
///   2. Quem recebe (sua equipe medica via clinica parceira)
///   3. Como revogar (a qualquer momento)
class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool _accepted = false;
  bool _busy = false;

  Future<void> _continue() async {
    if (!_accepted) return;
    setState(() => _busy = true);
    await OnboardingState.markConsentGranted();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => const HomeScreen(),
        transitionsBuilder: (_, animation, __, child) => FadeTransition(
          opacity: animation,
          child: child,
        ),
        transitionDuration: SingulareTokens.medium,
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Privacidade'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            SingulareTokens.space24,
            SingulareTokens.space8,
            SingulareTokens.space24,
            SingulareTokens.space32,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Antes de continuar', style: SingulareTokens.display),
              const SizedBox(height: SingulareTokens.space12),
              Text(
                'Leia com atencao o que voce esta autorizando. Voce pode revisar e revogar este consentimento a qualquer momento.',
                style: SingulareTokens.body,
              ),
              const SizedBox(height: SingulareTokens.space32),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: const [
                    _ConsentBlock(
                      label: '1',
                      title: 'Quais dados sao lidos',
                      body:
                          'Frequencia cardiaca (min/max/medio/repouso), variabilidade (HRV), oxigenacao do sangue (SpO2), VO2 max, frequencia respiratoria, passos, calorias, distancia e sono — todos via Apple Health.',
                    ),
                    SizedBox(height: SingulareTokens.space16),
                    _ConsentBlock(
                      label: '2',
                      title: 'Quem recebe',
                      body:
                          'Apenas a equipe medica da clinica parceira que solicitou seu acompanhamento. Os dados sao armazenados em servidores compativeis com LGPD e nunca compartilhados com terceiros sem nova autorizacao explicita.',
                    ),
                    SizedBox(height: SingulareTokens.space16),
                    _ConsentBlock(
                      label: '3',
                      title: 'Como revogar',
                      body:
                          'A qualquer momento voce pode (a) revogar dentro do app na tela inicial, (b) revogar pelo Apple Health em Ajustes > Saude > Acesso e Dispositivos > Singulare Health, ou (c) solicitar a remocao completa dos dados pelo dpo@singulare.org.',
                    ),
                    SizedBox(height: SingulareTokens.space16),
                    _ConsentBlock(
                      label: '4',
                      title: 'Por quanto tempo',
                      body:
                          'Retencao maxima de 24 meses, conforme principio de minimizacao da LGPD. Apos esse periodo os dados sao apagados automaticamente, exceto os registros incluidos formalmente no seu prontuario medico.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SingulareTokens.space20),
              _ConsentCheckbox(
                value: _accepted,
                onChanged: (v) => setState(() => _accepted = v),
              ),
              const SizedBox(height: SingulareTokens.space20),
              PrimaryButton(
                label: 'Concordar e continuar',
                icon: Icons.check_rounded,
                busy: _busy,
                onTap: _accepted ? _continue : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConsentBlock extends StatelessWidget {
  final String label;
  final String title;
  final String body;

  const _ConsentBlock({
    required this.label,
    required this.title,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SingulareTokens.space20),
      decoration: BoxDecoration(
        color: SingulareTokens.surface,
        borderRadius: BorderRadius.circular(SingulareTokens.radiusLg),
        border: Border.all(color: SingulareTokens.hairline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: SingulareTokens.accentSoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: SingulareTokens.bodyStrong.copyWith(
                color: SingulareTokens.accent,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: SingulareTokens.space16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: SingulareTokens.bodyStrong),
                const SizedBox(height: SingulareTokens.space8),
                Text(body, style: SingulareTokens.body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsentCheckbox extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ConsentCheckbox({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      behavior: HitTestBehavior.opaque,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AnimatedContainer(
            duration: SingulareTokens.short,
            curve: SingulareTokens.easeOut,
            width: 24,
            height: 24,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: value ? SingulareTokens.accent : SingulareTokens.surface,
              borderRadius: BorderRadius.circular(SingulareTokens.radiusSm - 4),
              border: Border.all(
                color: value
                    ? SingulareTokens.accent
                    : SingulareTokens.hairlineStrong,
                width: 1.5,
              ),
            ),
            child: value
                ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                : null,
          ),
          const SizedBox(width: SingulareTokens.space12),
          Expanded(
            child: Text(
              'Li e concordo com o tratamento dos meus dados de saude conforme descrito acima e na Politica de Privacidade Singulare.',
              style: SingulareTokens.body.copyWith(
                color: SingulareTokens.textPrimary,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
