import 'package:workmanager/workmanager.dart';
import '../config.dart';
import '../models/observation.dart';
import 'health_data_engine.dart';
import 'ingest_client.dart';
import 'sync_cache.dart';
import 'token_service.dart';

const _taskTag = 'singulare-cardio-sync';

@pragma('vm:entry-point')
void backgroundCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task != _taskTag) return true;
    try {
      final token = await TokenService.read();
      if (token == null) return false;
      await runSync(token: token);
      return true;
    } catch (_) {
      return false; // WorkManager re-tenta com exponential backoff
    }
  });
}

Future<void> registerPeriodicSync() async {
  await Workmanager().registerPeriodicTask(
    _taskTag,
    _taskTag,
    frequency: Duration(hours: AppConfig.syncIntervalHours),
    constraints: Constraints(networkType: NetworkType.connected),
    backoffPolicy: BackoffPolicy.exponential,
    backoffPolicyDelay: Duration(seconds: AppConfig.retryBaseDelaySec),
    existingWorkPolicy: ExistingWorkPolicy.keep,
  );
}

Future<void> cancelPeriodicSync() async {
  await Workmanager().cancelByUniqueName(_taskTag);
}

Future<IngestResult> runSync({required String token}) async {
  final engine = HealthDataEngine();
  final cache = SyncCache();

  final codes = [
    Loinc.heartRate, Loinc.hrvSdnn, Loinc.restingHeartRate,
    Loinc.steps, Loinc.distanceWalking, Loinc.activeEnergy,
    Loinc.sleepStage, Loinc.spo2,
    Loinc.bpSystolic, Loinc.bpDiastolic,
    Loinc.bodyWeight, Loinc.bodyTemperature, Loinc.bloodGlucose,
  ];
  final since = await cache.getOldestSyncOrDefault(codes, Duration(days: AppConfig.backfillDays));
  final obs = await engine.readSince(since);
  if (obs.isEmpty) return IngestResult.empty;

  final result = await IngestClient.sendBatches(token: token, observations: obs);

  // Atualiza last_sync_at por LOINC com o mais recente que vimos
  final latestByCode = <String, DateTime>{};
  for (final o in obs) {
    final cur = latestByCode[o.loincCode];
    if (cur == null || o.effectiveTime.isAfter(cur)) {
      latestByCode[o.loincCode] = o.effectiveTime;
    }
  }
  for (final entry in latestByCode.entries) {
    await cache.setLastSync(entry.key, entry.value);
  }

  return result;
}
