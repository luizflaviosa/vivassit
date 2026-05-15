import 'package:flutter/material.dart';

import '../config.dart';
import '../services/onboarding_state.dart';
import '../services/rook_service.dart';
import '../theme.dart';
import '../widgets/primary_button.dart';
import '../widgets/status_card.dart';
import 'welcome_screen.dart';

enum _SyncState { idle, requesting, syncing, success, error }

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  _SyncState _state = _SyncState.idle;
  String? _errorMessage;
  DateTime? _lastSyncAt;

  Future<void> _activate() async {
    setState(() {
      _state = _SyncState.requesting;
      _errorMessage = null;
    });

    try {
      await RookService.instance.initialize();
      await RookService.instance.bindUser(RookConfig.defaultUserId);
      await RookService.instance.requestPermissions();
      final granted = await RookService.instance.hasPermissions();
      if (!granted) {
        setState(() {
          _state = _SyncState.error;
          _errorMessage =
              'Permissoes negadas. Abra Ajustes > Saude > Singulare Health para liberar o acesso.';
        });
        return;
      }

      setState(() => _state = _SyncState.syncing);

      final result = await RookService.instance.syncAllData();
      await RookService.instance.enableBackgroundSync();

      setState(() {
        _state = result.allOk ? _SyncState.success : _SyncState.error;
        _lastSyncAt = DateTime.now();
        if (!result.allOk) {
          _errorMessage =
              'Sincronizacao parcial. Tente novamente em alguns minutos.';
        }
      });
    } catch (e) {
      setState(() {
        _state = _SyncState.error;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _revokeConsent() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => _ConfirmDialog(
        title: 'Revogar consentimento?',
        message:
            'Voce sera levado de volta ao inicio e o app deixara de coletar dados ate uma nova autorizacao.',
        confirmLabel: 'Revogar',
      ),
    );
    if (confirm != true || !mounted) return;
    await OnboardingState.revokeConsent();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const WelcomeScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Singulare Health'),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_horiz_rounded),
            tooltip: 'Mais',
            onPressed: () => _showSheet(context),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            SingulareTokens.space24,
            SingulareTokens.space8,
            SingulareTokens.space24,
            SingulareTokens.space32,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _Header(),
              const SizedBox(height: SingulareTokens.space32),
              _statusCard(),
              if (_errorMessage != null) ...[
                const SizedBox(height: SingulareTokens.space12),
                _ErrorBanner(message: _errorMessage!),
              ],
              const SizedBox(height: SingulareTokens.space24),
              if (_state == _SyncState.success) const _MetricsPreview(),
              const Spacer(),
              _primaryAction(),
              const SizedBox(height: SingulareTokens.space12),
              Text(
                'Paciente vinculado: ${RookConfig.defaultUserId}',
                textAlign: TextAlign.center,
                style: SingulareTokens.caption,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: SingulareTokens.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(SingulareTokens.radiusXl),
        ),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            SingulareTokens.space16,
            SingulareTokens.space8,
            SingulareTokens.space16,
            SingulareTokens.space24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: SingulareTokens.hairlineStrong,
                  borderRadius: BorderRadius.circular(SingulareTokens.radiusFull),
                ),
              ),
              const SizedBox(height: SingulareTokens.space20),
              _SheetTile(
                icon: Icons.refresh_rounded,
                label: 'Sincronizar agora',
                onTap: () {
                  Navigator.of(context).pop();
                  _activate();
                },
              ),
              _SheetTile(
                icon: Icons.lock_outline_rounded,
                label: 'Revogar consentimento',
                tone: StatusTone.danger,
                onTap: () {
                  Navigator.of(context).pop();
                  _revokeConsent();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusCard() {
    switch (_state) {
      case _SyncState.idle:
        return const StatusCard(
          icon: Icons.pause_circle_outline_rounded,
          title: 'Aguardando ativacao',
          subtitle: 'Toque no botao para iniciar o monitoramento.',
          tone: StatusTone.neutral,
        );
      case _SyncState.requesting:
        return const StatusCard(
          icon: Icons.lock_open_rounded,
          title: 'Aguardando permissao',
          subtitle: 'Autorize o acesso no Apple Health.',
          tone: StatusTone.accent,
          animate: true,
        );
      case _SyncState.syncing:
        return const StatusCard(
          icon: Icons.sync_rounded,
          title: 'Sincronizando',
          subtitle: 'Transmitindo dados para o Singulare.',
          tone: StatusTone.accent,
          animate: true,
        );
      case _SyncState.success:
        return StatusCard(
          icon: Icons.check_circle_outline_rounded,
          title: 'Monitoramento ativo',
          subtitle: _lastSyncAt != null
              ? 'Ultima sincronizacao: ${_fmt(_lastSyncAt!)}'
              : 'Sincronizacao em segundo plano ativa.',
          tone: StatusTone.success,
        );
      case _SyncState.error:
        return const StatusCard(
          icon: Icons.error_outline_rounded,
          title: 'Atencao',
          subtitle: 'Algo deu errado. Verifique a mensagem abaixo.',
          tone: StatusTone.danger,
        );
    }
  }

  Widget _primaryAction() {
    final busy =
        _state == _SyncState.requesting || _state == _SyncState.syncing;

    if (_state == _SyncState.success) {
      return PrimaryButton(
        label: 'Sincronizar agora',
        icon: Icons.refresh_rounded,
        variant: PrimaryButtonVariant.ghost,
        onTap: _activate,
      );
    }

    final isInitial = _state == _SyncState.idle;
    return PrimaryButton(
      label: busy
          ? 'Sincronizando...'
          : isInitial
              ? 'Ativar Monitoramento Medico'
              : 'Tentar novamente',
      icon: isInitial ? Icons.favorite_rounded : null,
      busy: busy,
      variant: isInitial
          ? PrimaryButtonVariant.accent
          : PrimaryButtonVariant.dark,
      onTap: busy ? null : _activate,
    );
  }

  static String _fmt(DateTime dt) {
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${dt.day}/${dt.month} as $hh:$mm';
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Monitoramento contínuo',
          style: SingulareTokens.micro.copyWith(
            color: SingulareTokens.accent,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: SingulareTokens.space8),
        Text('Sua equipe medica\nacompanhando seu coracao.',
            style: SingulareTokens.display),
      ],
    );
  }
}

class _MetricsPreview extends StatelessWidget {
  const _MetricsPreview();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SingulareTokens.space20),
      decoration: BoxDecoration(
        color: SingulareTokens.surface,
        borderRadius: BorderRadius.circular(SingulareTokens.radiusLg),
        border: Border.all(color: SingulareTokens.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Sinais transmitidos', style: SingulareTokens.heading),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: SingulareTokens.space8,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: SingulareTokens.successSoft,
                  borderRadius: BorderRadius.circular(SingulareTokens.radiusFull),
                ),
                child: Text(
                  'em dia',
                  style: SingulareTokens.micro.copyWith(
                    color: SingulareTokens.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SingulareTokens.space16),
          const _MetricRow(label: 'Frequencia cardiaca', value: 'enviada'),
          const _MetricRow(label: 'HRV', value: 'enviada'),
          const _MetricRow(label: 'SpO2 / VO2 max', value: 'enviada'),
          const _MetricRow(label: 'Atividade e sono', value: 'enviada'),
        ],
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  final String label;
  final String value;
  const _MetricRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: SingulareTokens.space8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: SingulareTokens.body),
          Row(
            children: [
              Icon(
                Icons.check_rounded,
                size: 14,
                color: SingulareTokens.success,
              ),
              const SizedBox(width: 4),
              Text(
                value,
                style: SingulareTokens.caption.copyWith(
                  color: SingulareTokens.success,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SingulareTokens.space16,
        vertical: SingulareTokens.space12,
      ),
      decoration: BoxDecoration(
        color: SingulareTokens.dangerSoft,
        borderRadius: BorderRadius.circular(SingulareTokens.radiusMd),
        border: Border.all(color: SingulareTokens.danger.withOpacity(0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.error_outline_rounded,
            size: 18,
            color: SingulareTokens.danger,
          ),
          const SizedBox(width: SingulareTokens.space12),
          Expanded(
            child: Text(
              message,
              style: SingulareTokens.caption.copyWith(
                color: const Color(0xFF7A1F2E),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SheetTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final StatusTone tone;
  final VoidCallback onTap;

  const _SheetTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.tone = StatusTone.neutral,
  });

  @override
  Widget build(BuildContext context) {
    final color = tone == StatusTone.danger
        ? SingulareTokens.danger
        : SingulareTokens.textPrimary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(SingulareTokens.radiusMd),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: SingulareTokens.space12,
          vertical: SingulareTokens.space12,
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: SingulareTokens.space16),
            Text(
              label,
              style: SingulareTokens.bodyStrong.copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConfirmDialog extends StatelessWidget {
  final String title;
  final String message;
  final String confirmLabel;

  const _ConfirmDialog({
    required this.title,
    required this.message,
    required this.confirmLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: SingulareTokens.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(SingulareTokens.radiusLg),
      ),
      child: Padding(
        padding: const EdgeInsets.all(SingulareTokens.space24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: SingulareTokens.title),
            const SizedBox(height: SingulareTokens.space12),
            Text(message, style: SingulareTokens.body),
            const SizedBox(height: SingulareTokens.space24),
            Row(
              children: [
                Expanded(
                  child: PrimaryButton(
                    label: 'Cancelar',
                    variant: PrimaryButtonVariant.ghost,
                    onTap: () => Navigator.of(context).pop(false),
                  ),
                ),
                const SizedBox(width: SingulareTokens.space12),
                Expanded(
                  child: PrimaryButton(
                    label: confirmLabel,
                    onTap: () => Navigator.of(context).pop(true),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
