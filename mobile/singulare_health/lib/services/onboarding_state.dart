import 'package:shared_preferences/shared_preferences.dart';

/// Estado persistido do onboarding.
///
/// Usado para decidir se o app abre direto na Home (paciente ja consentiu)
/// ou se passa pelo fluxo Welcome -> Consent.
class OnboardingState {
  OnboardingState._();

  static const _kConsentGranted = 'singulare.consent.granted_v1';
  static const _kConsentGrantedAt = 'singulare.consent.granted_at';

  /// True se o paciente ja deu consent LGPD nesta instalacao.
  static Future<bool> hasConsented() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kConsentGranted) ?? false;
  }

  /// Registra que o paciente concedeu consent. Armazena timestamp ISO-8601 UTC.
  static Future<void> markConsentGranted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kConsentGranted, true);
    await prefs.setString(
      _kConsentGrantedAt,
      DateTime.now().toUtc().toIso8601String(),
    );
  }

  /// Timestamp do consent (UTC ISO-8601) ou null se nunca concedeu.
  static Future<DateTime?> consentGrantedAt() async {
    final prefs = await SharedPreferences.getInstance();
    final iso = prefs.getString(_kConsentGrantedAt);
    if (iso == null) return null;
    return DateTime.tryParse(iso);
  }

  /// Limpa o consent (usado em "Sair / Revogar consentimento").
  static Future<void> revokeConsent() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kConsentGranted);
    await prefs.remove(_kConsentGrantedAt);
  }
}
