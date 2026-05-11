import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// Servico de armazenamento do token de coleta da clinica.
// Token vem do link https://singulare.org/saude/<uuid>.
class TokenService {
  static const _key = 'health_collection_token';
  static const _storage = FlutterSecureStorage(
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<void> save(String token) => _storage.write(key: _key, value: token);

  static Future<String?> read() => _storage.read(key: _key);

  static Future<void> clear() => _storage.delete(key: _key);

  // Extrai UUID v4 de uma URL do tipo https://singulare.org/saude/<uuid>.
  static String? extractFromUrl(String? input) {
    if (input == null || input.trim().isEmpty) return null;
    final m = RegExp(r'([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})').firstMatch(input);
    return m?.group(1)?.toLowerCase();
  }
}
