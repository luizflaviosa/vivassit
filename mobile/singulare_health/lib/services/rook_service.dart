import 'dart:developer' as developer;

import 'package:rook_sdk_apple_health/rook_sdk_apple_health.dart';
import 'package:rook_sdk_core/rook_sdk_core.dart';

import '../config.dart';

/// Encapsula o ciclo de vida do ROOK SDK v4 (todos os managers estaticos):
///   1. Configuracao + init via AHRookConfigurationManager
///   2. Binding do usuario (updateUserID)
///   3. Permissoes HealthKit via AHRookHealthPermissionsManager
///   4. Sync manual via AHRookSyncManager (sumarios + eventos)
///   5. Sync passiva via AHRookBackgroundSync (BGTaskScheduler)
class RookService {
  RookService._();
  static final RookService instance = RookService._();

  bool _initialized = false;
  bool _userBound = false;

  Future<void> initialize() async {
    if (_initialized) return;

    final config = RookConfiguration(
      clientUUID: RookConfig.clientUUID,
      secret: RookConfig.secretKey,
      environment: RookConfig.environment,
      enableBackgroundSync: RookConfig.enableBackgroundSync,
    );

    await AHRookConfigurationManager.setConfiguration(config);

    if (RookConfig.enableNativeLogs) {
      await AHRookConfigurationManager.enableNativeLogs();
    }

    await AHRookConfigurationManager.initRook();
    _initialized = true;
    _log('SDK inicializado (env=${RookConfig.environment.name})');
  }

  Future<void> bindUser(String userId) async {
    if (!_initialized) {
      throw StateError('Chame initialize() antes de bindUser().');
    }
    await AHRookConfigurationManager.updateUserID(userId);
    _userBound = true;
    _log('User bound: $userId');
  }

  Future<void> requestPermissions() async {
    _ensureReady();
    await AHRookHealthPermissionsManager.requestPermissions();
    _log('Permissoes HealthKit solicitadas');
  }

  /// HealthKit nao expoe estado real de permissoes de leitura por design da Apple,
  /// mas o SDK ROOK rastreia internamente se o request ja foi feito.
  Future<bool> hasPermissions() async {
    _ensureReady();
    final state = await AHRookConfigurationManager.getDiagnosticState();
    return state.permissions != DiagnosticStatePermissions.notRequested;
  }

  Future<void> enableBackgroundSync() async {
    _ensureReady();
    if (!RookConfig.enableBackgroundSync) return;
    await AHRookBackgroundSync.enableBackground(
      enableNativeLogs: RookConfig.enableNativeLogs,
    );
    _log('Background sync habilitado (BGTaskScheduler ativo)');
  }

  /// Sincroniza dados de ontem agora. Util pos-onboarding.
  /// Sumarios (sleep, physical, body) + eventos cardiacos (heartRate, oxygenation, bloodPressure).
  Future<RookSyncResult> syncAllData() async {
    _ensureReady();
    final yesterday = DateTime.now().subtract(const Duration(days: 1));

    var summariesOk = false;
    var eventsOk = false;

    try {
      await AHRookSyncManager.sync(date: yesterday);
      summariesOk = true;
      _log('Data transmitted successfully: yesterday summaries');
    } catch (e, st) {
      _log(
        'Error enqueuing data: yesterday summaries -> $e',
        error: e,
        stack: st,
      );
    }

    try {
      await AHRookSyncManager.syncEvents(yesterday, AHEventSyncType.heartRate);
      await AHRookSyncManager.syncEvents(
        yesterday,
        AHEventSyncType.oxygenation,
      );
      await AHRookSyncManager.syncEvents(
        yesterday,
        AHEventSyncType.bloodPressure,
      );
      eventsOk = true;
      _log('Data transmitted successfully: cardiac events');
    } catch (e, st) {
      _log(
        'Error enqueuing data: cardiac events -> $e',
        error: e,
        stack: st,
      );
    }

    return RookSyncResult(summariesOk: summariesOk, eventsOk: eventsOk);
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
    developer.log(
      message,
      name: 'singulare_health',
      error: error,
      stackTrace: stack,
    );
  }
}

class RookSyncResult {
  final bool summariesOk;
  final bool eventsOk;

  const RookSyncResult({required this.summariesOk, required this.eventsOk});

  bool get allOk => summariesOk && eventsOk;
}
