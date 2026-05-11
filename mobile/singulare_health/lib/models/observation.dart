// LOINC subset usado pra mapear HealthKit/Health Connect <-> backend.
class Loinc {
  static const heartRate = '8867-4';
  static const hrvSdnn = '80404-7';
  static const restingHeartRate = '40443-4';
  static const steps = '55423-8';
  static const distanceWalking = '41950-7';
  static const activeEnergy = '41981-2';
  static const sleepDuration = '93832-4';
  static const sleepStage = '93830-8';
  static const bpSystolic = '8480-6';
  static const bpDiastolic = '8462-4';
  static const bodyWeight = '29463-7';
  static const bodyTemperature = '8310-5';
  static const spo2 = '59408-5';
  static const bloodGlucose = '2339-0';
}

class Observation {
  final String loincCode;
  final double? value;
  final String? valueText;
  final DateTime effectiveTime;
  final DateTime? effectivePeriodEnd;
  final String source; // 'apple_health' | 'health_connect'
  final String? metricType; // 'sdnn' | 'rmssd' pra HRV
  final String? sampleUuid;

  Observation({
    required this.loincCode,
    required this.effectiveTime,
    required this.source,
    this.value,
    this.valueText,
    this.effectivePeriodEnd,
    this.metricType,
    this.sampleUuid,
  });

  Map<String, dynamic> toJson() {
    final m = <String, dynamic>{
      'loinc_code': loincCode,
      'effective_time': effectiveTime.toUtc().toIso8601String(),
      'source': source,
    };
    if (value != null) m['value'] = value;
    if (valueText != null) m['value_text'] = valueText;
    if (effectivePeriodEnd != null) {
      m['effective_period_end'] = effectivePeriodEnd!.toUtc().toIso8601String();
    }
    if (metricType != null) m['metric_type'] = metricType;
    if (sampleUuid != null) m['sample_uuid'] = sampleUuid;
    return m;
  }
}

// Conversoes pra unidade canonica SI (alinhadas com docs/health-data-spec.md).
double fahrenheitToCelsius(double f) => (f - 32) * 5 / 9;
double poundsToKg(double lb) => lb * 0.4536;
double mgPerDlToMmolPerL(double mg) => mg / 18.0182;
double fractionToPercent(double f) => f * 100;
