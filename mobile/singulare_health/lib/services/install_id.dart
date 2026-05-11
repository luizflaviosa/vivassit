import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class InstallId {
  static const _key = 'install_id';
  static const _storage = FlutterSecureStorage();

  // UUID estavel por instalacao do app, ANONIMO (nao baseado em IMEI/serial).
  // Persistido no Keychain (iOS) / EncryptedSharedPreferences (Android).
  static Future<String> get() async {
    final existing = await _storage.read(key: _key);
    if (existing != null) return existing;
    final raw = '${DateTime.now().microsecondsSinceEpoch}-${_nonce()}';
    final hash = sha256.convert(utf8.encode(raw)).toString();
    final uuid = '${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}';
    await _storage.write(key: _key, value: uuid);
    return uuid;
  }

  static String _nonce() {
    final n = DateTime.now().microsecondsSinceEpoch;
    return (n ^ (n >> 7)).toRadixString(16);
  }

  static Future<Map<String, String>> deviceInfo() async {
    final info = DeviceInfoPlugin();
    if (Platform.isIOS) {
      final i = await info.iosInfo;
      return {
        'platform': 'ios',
        'os_version': i.systemVersion,
        'device_model': i.utsname.machine,
      };
    } else {
      final a = await info.androidInfo;
      return {
        'platform': 'android',
        'os_version': a.version.release,
        'device_model': '${a.manufacturer} ${a.model}',
      };
    }
  }
}
