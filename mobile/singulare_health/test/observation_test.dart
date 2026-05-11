import 'package:flutter_test/flutter_test.dart';
import 'package:singulare_health/models/observation.dart';

void main() {
  group('Unit conversions', () {
    test('Fahrenheit 98.6 = 37 Celsius', () {
      expect(fahrenheitToCelsius(98.6), closeTo(37.0, 0.01));
    });

    test('Pounds 150 lb = 68.04 kg', () {
      expect(poundsToKg(150), closeTo(68.04, 0.05));
    });

    test('Glucose 90 mg/dL = 5.00 mmol/L', () {
      expect(mgPerDlToMmolPerL(90), closeTo(5.0, 0.01));
    });

    test('SpO2 fraction 0.98 = 98%', () {
      expect(fractionToPercent(0.98), closeTo(98.0, 0.01));
    });
  });

  group('Observation.toJson', () {
    test('numeric obs sem metric_type', () {
      final obs = Observation(
        loincCode: Loinc.heartRate,
        value: 72,
        effectiveTime: DateTime.parse('2026-05-10T14:00:00Z'),
        source: 'apple_health',
      );
      final j = obs.toJson();
      expect(j['loinc_code'], '8867-4');
      expect(j['value'], 72);
      expect(j['source'], 'apple_health');
      expect(j['effective_time'], '2026-05-10T14:00:00.000Z');
      expect(j.containsKey('metric_type'), false);
    });

    test('HRV SDNN inclui metric_type', () {
      final obs = Observation(
        loincCode: Loinc.hrvSdnn,
        value: 45,
        effectiveTime: DateTime.parse('2026-05-10T14:00:00Z'),
        source: 'apple_health',
        metricType: 'sdnn',
      );
      expect(obs.toJson()['metric_type'], 'sdnn');
    });

    test('Sleep stage usa value_text', () {
      final obs = Observation(
        loincCode: Loinc.sleepStage,
        valueText: 'deep',
        effectiveTime: DateTime.parse('2026-05-10T03:00:00Z'),
        effectivePeriodEnd: DateTime.parse('2026-05-10T03:30:00Z'),
        source: 'health_connect',
      );
      final j = obs.toJson();
      expect(j['value_text'], 'deep');
      expect(j['effective_period_end'], '2026-05-10T03:30:00.000Z');
      expect(j.containsKey('value'), false);
    });
  });
}
