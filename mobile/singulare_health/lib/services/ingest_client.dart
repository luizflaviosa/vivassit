import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import '../config.dart';
import '../models/observation.dart';
import 'install_id.dart';

class IngestResult {
  final int totalSent;
  final int accepted;
  final int rejected;
  final int outliers;
  const IngestResult(this.totalSent, this.accepted, this.rejected, this.outliers);

  static const empty = IngestResult(0, 0, 0, 0);
}

class IngestClient {
  // Envia batches via /api/saude/<token>/ingest (mesmo endpoint da pagina web).
  static Future<IngestResult> sendBatches({
    required String token,
    required List<Observation> observations,
  }) async {
    if (observations.isEmpty) return IngestResult.empty;

    final dev = await InstallId.deviceInfo();
    final pkg = await PackageInfo.fromPlatform();

    var totalSent = 0, totalAccepted = 0, totalRejected = 0, totalOutliers = 0;

    for (var i = 0; i < observations.length; i += AppConfig.maxBatchSize) {
      final chunk = observations.sublist(
        i,
        min(i + AppConfig.maxBatchSize, observations.length),
      );
      final body = {
        'device': {
          'platform': dev['platform'],
          'os_version': dev['os_version'],
          'app_version': pkg.version,
          'device_model': dev['device_model'],
        },
        'observations': chunk.map((o) => o.toJson()).toList(),
      };

      final res = await _sendWithRetry(token, body);
      totalSent += chunk.length;
      totalAccepted += (res['accepted'] as int? ?? 0);
      totalRejected += (res['rejected'] as int? ?? 0);
      totalOutliers += (res['outliers'] as int? ?? 0);
    }

    return IngestResult(totalSent, totalAccepted, totalRejected, totalOutliers);
  }

  static Future<Map<String, dynamic>> _sendWithRetry(String token, Map<String, dynamic> body) async {
    final url = Uri.parse('${AppConfig.apiBaseUrl}/api/saude/$token/ingest');
    var attempt = 0;
    while (true) {
      try {
        final res = await http.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(body),
        ).timeout(const Duration(seconds: 30));
        if (res.statusCode == 200) {
          return jsonDecode(res.body) as Map<String, dynamic>;
        }
        if (res.statusCode == 400 || res.statusCode == 401 || res.statusCode == 403 || res.statusCode == 404) {
          throw Exception('non_retryable: ${res.statusCode} ${res.body}');
        }
        throw Exception('retryable: ${res.statusCode}');
      } catch (e) {
        attempt++;
        if (e.toString().contains('non_retryable')) rethrow;
        if (attempt >= AppConfig.maxRetries) rethrow;
        final delaySec = AppConfig.retryBaseDelaySec * (1 << (attempt - 1));
        await Future.delayed(Duration(seconds: delaySec));
      }
    }
  }
}
