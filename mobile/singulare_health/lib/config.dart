import 'package:rook_sdk_apple_health/rook_sdk_apple_health.dart';

/// Credenciais e parametros do ambiente ROOK.
///
/// Valores de sandbox. Em producao, sobrescrever via `--dart-define`:
///   flutter run --dart-define=ROOK_CLIENT_UUID=... --dart-define=ROOK_SECRET=...
class RookConfig {
  static const String clientUUID = String.fromEnvironment(
    'ROOK_CLIENT_UUID',
    defaultValue: 'b1717749-896e-4dd3-8191-150f6bc166f8',
  );

  static const String secretKey = String.fromEnvironment(
    'ROOK_SECRET',
    defaultValue: '0gCITss03CnDhIyIO5rz5iFeX1uJw8J6CeN7',
  );

  static const RookEnvironment environment = RookEnvironment.sandbox;

  /// User ID padrao para teste inicial (singulare-pat-57).
  /// Em producao, deve ser sobrescrito por tenant_member.user_id real.
  static const String defaultUserId = String.fromEnvironment(
    'ROOK_USER_ID',
    defaultValue: 'singulare-pat-57',
  );

  /// Habilita logs nativos do SDK em modo debug.
  static const bool enableNativeLogs = bool.fromEnvironment(
    'ROOK_NATIVE_LOGS',
    defaultValue: true,
  );

  /// Sincronizacao passiva no background (BGTaskScheduler).
  static const bool enableBackgroundSync = true;
}
