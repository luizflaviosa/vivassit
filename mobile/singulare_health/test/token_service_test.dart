import 'package:flutter_test/flutter_test.dart';
import 'package:singulare_health/services/token_service.dart';

void main() {
  group('TokenService.extractFromUrl', () {
    test('extrai uuid de URL singulare.org/saude/<uuid>', () {
      final t = TokenService.extractFromUrl('https://singulare.org/saude/f8b3250a-a1b9-48e8-8ee4-37d03cbf68f7');
      expect(t, 'f8b3250a-a1b9-48e8-8ee4-37d03cbf68f7');
    });

    test('extrai uuid mesmo sem https', () {
      final t = TokenService.extractFromUrl('singulare.org/saude/F8B3250A-A1B9-48E8-8EE4-37D03CBF68F7');
      expect(t, 'f8b3250a-a1b9-48e8-8ee4-37d03cbf68f7');
    });

    test('extrai uuid solto', () {
      final t = TokenService.extractFromUrl('f8b3250a-a1b9-48e8-8ee4-37d03cbf68f7');
      expect(t, 'f8b3250a-a1b9-48e8-8ee4-37d03cbf68f7');
    });

    test('retorna null pra entrada vazia ou invalida', () {
      expect(TokenService.extractFromUrl(null), null);
      expect(TokenService.extractFromUrl(''), null);
      expect(TokenService.extractFromUrl('lorem ipsum'), null);
    });
  });
}
