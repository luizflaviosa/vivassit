import 'package:flutter/material.dart';

import 'config.dart';
import 'screens/home_screen.dart';
import 'screens/welcome_screen.dart';
import 'services/onboarding_state.dart';
import 'services/rook_service.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializa o ROOK antes do runApp pra que o SDK ja esteja pronto
  // quando o usuario tocar "Ativar Monitoramento Medico".
  await RookService.instance.initialize();
  await RookService.instance.bindUser(RookConfig.defaultUserId);

  runApp(const SingulareHealthApp());
}

class SingulareHealthApp extends StatelessWidget {
  const SingulareHealthApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Singulare Health',
      debugShowCheckedModeBanner: false,
      theme: singulareTheme(),
      home: const _Bootstrap(),
    );
  }
}

/// Decide a tela inicial:
///   - Sem consent gravado: WelcomeScreen
///   - Consent ja registrado: HomeScreen
class _Bootstrap extends StatefulWidget {
  const _Bootstrap();

  @override
  State<_Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends State<_Bootstrap> {
  Future<bool>? _consentFuture;

  @override
  void initState() {
    super.initState();
    _consentFuture = OnboardingState.hasConsented();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _consentFuture,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(
            body: Center(child: _Splash()),
          );
        }
        final consented = snapshot.data ?? false;
        return AnimatedSwitcher(
          duration: SingulareTokens.medium,
          switchInCurve: SingulareTokens.easeOut,
          child: consented ? const HomeScreen() : const WelcomeScreen(),
        );
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: SingulareTokens.accent,
            borderRadius: BorderRadius.circular(SingulareTokens.radiusMd),
            boxShadow: SingulareTokens.elevationAccent,
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(height: SingulareTokens.space24),
        const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(SingulareTokens.accent),
          ),
        ),
      ],
    );
  }
}
