import 'dart:io';
import 'package:health/health.dart';
import '../models/observation.dart';

// Le dados do Apple HealthKit (iOS) ou Health Connect (Android)
// e mapeia pra LOINC + unidade canonica SI.
// Spec completa: ../../../docs/health-data-spec.md
class HealthDataEngine {
  final Health _health = Health();

  // Tipos pedidos no onboarding. Cada um requer permissao no Info.plist
  // (iOS, generico via NSHealthShareUsageDescription) ou
  // android.permission.health.READ_* no Manifest.
  static const _types = <HealthDataType>[
    HealthDataType.HEART_RATE,
    HealthDataType.HEART_RATE_VARIABILITY_SDNN, // iOS
    HealthDataType.HEART_RATE_VARIABILITY_RMSSD, // Android
    HealthDataType.RESTING_HEART_RATE,
    HealthDataType.STEPS,
    HealthDataType.DISTANCE_WALKING_RUNNING,
    HealthDataType.ACTIVE_ENERGY_BURNED,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.SLEEP_AWAKE,
    HealthDataType.SLEEP_DEEP,
    HealthDataType.SLEEP_LIGHT,
    HealthDataType.SLEEP_REM,
    HealthDataType.BLOOD_OXYGEN,
    HealthDataType.BLOOD_PRESSURE_SYSTOLIC,
    HealthDataType.BLOOD_PRESSURE_DIASTOLIC,
    HealthDataType.WEIGHT,
    HealthDataType.BODY_TEMPERATURE,
    HealthDataType.BLOOD_GLUCOSE,
  ];

  Future<bool> isAvailable() async {
    if (Platform.isIOS) return true; // HealthKit sempre disponivel em iOS
    final status = await Health().getHealthConnectSdkStatus();
    return status == HealthConnectSdkStatus.sdkAvailable;
  }

  Future<bool> requestPermissions() async {
    final perms = _types.map((_) => HealthDataAccess.READ).toList();
    return _health.requestAuthorization(_types, permissions: perms);
  }

  Future<bool> hasPermissions() async {
    final perms = _types.map((_) => HealthDataAccess.READ).toList();
    final has = await _health.hasPermissions(_types, permissions: perms);
    return has ?? false;
  }

  // Le todos os data points entre [from, now] e mapeia pra Observation.
  Future<List<Observation>> readSince(DateTime from) async {
    final now = DateTime.now();
    final data = await _health.getHealthDataFromTypes(
      startTime: from,
      endTime: now,
      types: _types,
    );
    final source = Platform.isIOS ? 'apple_health' : 'health_connect';
    final result = <Observation>[];
    for (final p in data) {
      final obs = _map(p, source);
      if (obs != null) result.add(obs);
    }
    return result;
  }

  Observation? _map(HealthDataPoint p, String source) {
    final loinc = _loincFor(p.type);
    if (loinc == null) return null;

    double? value;
    String? valueText;
    String? metricType;

    if (p.value is NumericHealthValue) {
      value = (p.value as NumericHealthValue).numericValue.toDouble();
    } else if (p.value is AudiogramHealthValue) {
      // skip
      return null;
    } else {
      valueText = p.value.toString();
    }

    // Conversoes pra unidade canonica
    if (p.type == HealthDataType.BLOOD_OXYGEN && value != null && value <= 1.0) {
      // iOS retorna 0.0-1.0
      value = fractionToPercent(value);
    }

    // HRV: distingue SDNN (iOS) de RMSSD (Android)
    if (p.type == HealthDataType.HEART_RATE_VARIABILITY_SDNN) {
      metricType = 'sdnn';
    } else if (p.type == HealthDataType.HEART_RATE_VARIABILITY_RMSSD) {
      metricType = 'rmssd';
    }

    // Sleep stages: gravar value_text com a etapa
    if (loinc == Loinc.sleepStage) {
      valueText = _sleepStageText(p.type);
      value = null;
    }

    return Observation(
      loincCode: loinc,
      value: value,
      valueText: valueText,
      effectiveTime: p.dateFrom,
      effectivePeriodEnd: p.dateTo != p.dateFrom ? p.dateTo : null,
      source: source,
      metricType: metricType,
      sampleUuid: p.uuid,
    );
  }

  String? _loincFor(HealthDataType t) {
    switch (t) {
      case HealthDataType.HEART_RATE:
        return Loinc.heartRate;
      case HealthDataType.HEART_RATE_VARIABILITY_SDNN:
      case HealthDataType.HEART_RATE_VARIABILITY_RMSSD:
        return Loinc.hrvSdnn; // mesmo LOINC, qualifier vem em metric_type
      case HealthDataType.RESTING_HEART_RATE:
        return Loinc.restingHeartRate;
      case HealthDataType.STEPS:
        return Loinc.steps;
      case HealthDataType.DISTANCE_WALKING_RUNNING:
        return Loinc.distanceWalking;
      case HealthDataType.ACTIVE_ENERGY_BURNED:
        return Loinc.activeEnergy;
      case HealthDataType.SLEEP_ASLEEP:
      case HealthDataType.SLEEP_AWAKE:
      case HealthDataType.SLEEP_DEEP:
      case HealthDataType.SLEEP_LIGHT:
      case HealthDataType.SLEEP_REM:
        return Loinc.sleepStage;
      case HealthDataType.BLOOD_OXYGEN:
        return Loinc.spo2;
      case HealthDataType.BLOOD_PRESSURE_SYSTOLIC:
        return Loinc.bpSystolic;
      case HealthDataType.BLOOD_PRESSURE_DIASTOLIC:
        return Loinc.bpDiastolic;
      case HealthDataType.WEIGHT:
        return Loinc.bodyWeight;
      case HealthDataType.BODY_TEMPERATURE:
        return Loinc.bodyTemperature;
      case HealthDataType.BLOOD_GLUCOSE:
        return Loinc.bloodGlucose;
      default:
        return null;
    }
  }

  String _sleepStageText(HealthDataType t) {
    switch (t) {
      case HealthDataType.SLEEP_AWAKE:
        return 'awake';
      case HealthDataType.SLEEP_LIGHT:
        return 'light';
      case HealthDataType.SLEEP_DEEP:
        return 'deep';
      case HealthDataType.SLEEP_REM:
        return 'rem';
      case HealthDataType.SLEEP_ASLEEP:
        return 'asleep_unspecified';
      default:
        return 'unknown';
    }
  }
}
