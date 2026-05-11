import 'dart:developer' as developer;

import 'package:rook_sdk_apple_health/rook_sdk_apple_health.dart';

import '../config.dart';

/// Encapsula o ciclo de vida do ROOK SDK:
///   1. Configuracao + init
///   2. Binding do usuario (updateUserID)
///   3. Permissoes HealthKit
///   4. Sincronizacao manual e passiva (background)
///   5. Resumos + eventos cardiacos
class RookService {
  RookService._();
  static final RookService instance = RookService._();

  bool _initialized = false;
  bool _userBound = false;

  final AHRookConfigurationManager _configManager =
      AHRookConfigurationManager();
  final AHRookHealthPermissionsManager _permissionsManager =
      AHRookHealthPermissionsManager();
  final AHRookSummaryManager _summaryManager = AHRookSummaryManager();
  final AHRookEventManager _eventManager = AHRookEventManager();

  /// Configura o SDK + ativa logs nativos. Deve ser chamado uma unica vez,
  /// idealmente no `main()` antes do `runApp`.
  Future<void> initialize() async {
    if (_initialized) return;

    final config = RookConfiguration(
      RookConfig.clientUUID,
      RookConfig.secretKey,
      RookConfig.environment,
    );

    _configManager.setConfiguration(config);

    if (RookConfig.enableNativeLogs) {
      await _configManager.enableNativeLogs();
    }

    await _configManager.initRook();
    _initialized = true;
    _log('SDK inicializado (env=${RookConfig.environment.name})');
  }

  /// Binda o paciente no ROOK. Idempotente para o mesmo `userId`.
  Future<void> bindUser(String userId) async {
    if (!_initialized) {
      throw StateError('Chame initialize() antes de bindUser().');
    }
    await _configManager.updateUserID(userId);
    _userBound = true;
    _log('User bound: $userId');
  }

  /// Solicita permissoes HealthKit (cardiologicas + fisiologicas + atividade + sono).
  /// O ROOK pede permissao para todos os tipos suportados em uma unica sheet do iOS.
  Future<void> requestPermissions() async {
    _ensureReady();
    await _permissionsManager.requestPermissions();
    _log('Permissoes HealthKit solicitadas');
  }

  /// Verifica se todas as permissoes estao concedidas.
  Future<bool> hasPermissions() async {
    _ensureReady();
    return _permissionsManager.checkPermissions();
  }

  /// Habilita sincronizacao passiva (BGTaskScheduler iOS).
  /// O SDK enfileira resumos diarios e eventos cardiacos automaticamente.
  Future<void> enableBackgroundSync() async {
    _ensureReady();
    if (!RookConfig.enableBackgroundSync) return;

    // Sumarios (resumos diarios: passos, calorias, sono, cardio agregado)
    await _summaryManager.scheduleYesterdaySummariesAndroidWorker();
    await _summaryManager.syncYesterdaySummaries();

    // Eventos cardiacos (heart rate, HRV, oxygen sat - granular)
    await _eventManager.scheduleYesterdayEventsAndroidWorker();
    await _eventManager.syncYesterdayEvents();

    _log('Background sync habilitado (BGTaskScheduler ativo)');
  }

  /// Sincroniza todos os dados disponiveis agora. Util pos-onboarding.
  Future<RookSyncResult> syncAllData() async {
    _ensureReady();

    var summariesOk = false;
    var eventsOk = false;

    try {
      await _summaryManager.syncYesterdaySummaries();
      summariesOk = true;
      _log('Data transmitted successfully: yesterday summaries');
    } catch (e, st) {
      _log('Error enqueuing data: yesterday summaries -> $e', error: e, stack: st);
    }

    try {
      await _eventManager.syncYesterdayEvents();
      eventsOk = true;
      _log('Data transmitted successfully: yesterday events');
    } catch (e, st) {
      _log('Error enqueuing data: yesterday events -> $e', error: e, stack: st);
    }

    return RookSyncResult(
      summariesOk: summariesOk,
      eventsOk: eventsOk,
    );
  }

  void _ensureReady() {
    if (!_initialized) {
      throw StateError('Chame initialize() primeiro.');
    }
    if (!_userBound) {
      throw StateError('Chame bindUser() antes de operacoes de saude.');
    }
  }

  void _log(String message, {Object? error, StackTrace? stack}) {
    developer.log(message, name: 'singulare_health', error: error, stackTrace: stack);
  }
}

class RookSyncResult {
  final bool summariesOk;
  final bool eventsOk;

  const RookSyncResult({required this.summariesOk, required this.eventsOk});

  bool get allOk => summariesOk && eventsOk;
}
