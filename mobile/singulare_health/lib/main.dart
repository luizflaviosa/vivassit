import 'package:flutter/material.dart';
import 'package:workmanager/workmanager.dart';
import 'screens/welcome_screen.dart';
import 'screens/home_screen.dart';
import 'services/background_sync.dart';
import 'services/token_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Workmanager().initialize(
    backgroundCallbackDispatcher,
    isInDebugMode: false,
  );
  runApp(const SingulareHealthApp());
}

class SingulareHealthApp extends StatelessWidget {
  const SingulareHealthApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Singulare Saude',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6E56CF)),
        useMaterial3: true,
      ),
      home: const _Bootstrap(),
    );
  }
}

class _Bootstrap extends StatefulWidget {
  const _Bootstrap();

  @override
  State<_Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends State<_Bootstrap> {
  bool _checking = true;
  String? _token;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    final t = await TokenService.read();
    if (!mounted) return;
    setState(() {
      _token = t;
      _checking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_token == null) return const WelcomeScreen();
    return const HomeScreen();
  }
}
