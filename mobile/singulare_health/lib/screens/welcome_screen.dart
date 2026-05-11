import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/primary_button.dart';
import 'consent_screen.dart';

/// Tela inicial — apresenta o que o app faz em 3 movimentos rapidos.
///
/// Hierarquia visual (F-pattern):
///   1. Logo/Brand mark (top)
///   2. Headline + sub
///   3. Lista de beneficios com icones (color-coded)
///   4. CTA principal na thumb zone
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            SingulareTokens.space24,
            SingulareTokens.space24,
            SingulareTokens.space24,
            SingulareTokens.space32,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _BrandMark(),
              const SizedBox(height: SingulareTokens.space48),
              Text('Acompanhamento cardiologico continuo.',
                  style: SingulareTokens.display),
              const SizedBox(height: SingulareTokens.space16),
              Text(
                'O Singulare le seus dados do Apple Health e envia para sua equipe medica entre consultas. Voce nao precisa fazer nada — a sincronizacao acontece sozinha.',
                style: SingulareTokens.body,
              ),
              const SizedBox(height: SingulareTokens.space48),
              const _FeatureRow(
                icon: Icons.favorite_border_rounded,
                tone: _FeatureTone.accent,
                title: 'Coracao em foco',
                subtitle:
                    'Frequencia cardiaca, HRV, oxigenacao e atividade — coletados de forma passiva.',
              ),
              const SizedBox(height: SingulareTokens.space20),
              const _FeatureRow(
                icon: Icons.lock_outline_rounded,
                tone: _FeatureTone.neutral,
                title: 'Voce controla',
                subtitle:
                    'Conformidade com a LGPD. Voce pode revogar o acesso a qualquer momento.',
              ),
              const SizedBox(height: SingulareTokens.space20),
              const _FeatureRow(
                icon: Icons.cloud_sync_outlined,
                tone: _FeatureTone.success,
                title: 'Sem abrir o app',
                subtitle:
                    'Sincronizacao em segundo plano. Sua clinica recebe os dados automaticamente.',
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Comecar',
                icon: Icons.arrow_forward_rounded,
                onTap: () {
                  Navigator.of(context).push(
                    PageRouteBuilder(
                      pageBuilder: (_, __, ___) => const ConsentScreen(),
                      transitionsBuilder: _slideUp,
                      transitionDuration: SingulareTokens.medium,
                    ),
                  );
                },
              ),
              const SizedBox(height: SingulareTokens.space12),
              Text(
                'Ao continuar, voce concorda com a Politica de Privacidade Singulare.',
                textAlign: TextAlign.center,
                style: SingulareTokens.caption,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Widget _slideUp(BuildContext _, Animation<double> animation, Animation<double> __, Widget child) {
  return FadeTransition(
    opacity: animation,
    child: SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.04),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: SingulareTokens.easeOut)),
      child: child,
    ),
  );
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: SingulareTokens.accent,
            borderRadius: BorderRadius.circular(SingulareTokens.radiusSm),
            boxShadow: SingulareTokens.elevationAccent,
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 18),
        ),
        const SizedBox(width: SingulareTokens.space12),
        Text('Singulare Health', style: SingulareTokens.heading),
      ],
    );
  }
}

enum _FeatureTone { neutral, accent, success }

class _FeatureRow extends StatelessWidget {
  final IconData icon;
  final _FeatureTone tone;
  final String title;
  final String subtitle;

  const _FeatureRow({
    required this.icon,
    required this.tone,
    required this.title,
    required this.subtitle,
  });

  Color get _color {
    switch (tone) {
      case _FeatureTone.neutral:
        return SingulareTokens.textPrimary;
      case _FeatureTone.accent:
        return SingulareTokens.accent;
      case _FeatureTone.success:
        return SingulareTokens.success;
    }
  }

  Color get _bg {
    switch (tone) {
      case _FeatureTone.neutral:
        return SingulareTokens.surfaceSunken;
      case _FeatureTone.accent:
        return SingulareTokens.accentSoft;
      case _FeatureTone.success:
        return SingulareTokens.successSoft;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: _bg,
            borderRadius: BorderRadius.circular(SingulareTokens.radiusSm),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 18, color: _color),
        ),
        const SizedBox(width: SingulareTokens.space16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: SingulareTokens.bodyStrong),
              const SizedBox(height: SingulareTokens.space4),
              Text(subtitle, style: SingulareTokens.caption),
            ],
          ),
        ),
      ],
    );
  }
}
