class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://singulare.org',
  );

  static const maxBatchSize = 500;
  static const syncIntervalHours = 6;
  static const maxRetries = 5;
  static const retryBaseDelaySec = 30;

  // Quantos dias retroagir no primeiro sync (backfill)
  static const backfillDays = 30;
}
