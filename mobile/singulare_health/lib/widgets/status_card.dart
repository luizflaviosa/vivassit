import 'package:flutter/material.dart';

import '../theme.dart';

/// Card de status com hairline + icone tinted + (opcional) anel pulsante.
///
/// O `tone` controla a paleta semantica do card sem precisar passar cor manual.
enum StatusTone { neutral, accent, success, danger }

class StatusCard extends StatefulWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final StatusTone tone;
  final bool animate;

  const StatusCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.tone = StatusTone.neutral,
    this.animate = false,
  });

  @override
  State<StatusCard> createState() => _StatusCardState();
}

class _StatusCardState extends State<StatusCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );
    if (widget.animate) _pulse.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant StatusCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animate && !_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    } else if (!widget.animate && _pulse.isAnimating) {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Color get _toneColor {
    switch (widget.tone) {
      case StatusTone.neutral:
        return SingulareTokens.textTertiary;
      case StatusTone.accent:
        return SingulareTokens.accent;
      case StatusTone.success:
        return SingulareTokens.success;
      case StatusTone.danger:
        return SingulareTokens.danger;
    }
  }

  Color get _toneSoftBg {
    switch (widget.tone) {
      case StatusTone.neutral:
        return SingulareTokens.surfaceSunken;
      case StatusTone.accent:
        return SingulareTokens.accentSoft;
      case StatusTone.success:
        return SingulareTokens.successSoft;
      case StatusTone.danger:
        return SingulareTokens.dangerSoft;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SingulareTokens.space20),
      decoration: BoxDecoration(
        color: SingulareTokens.surface,
        borderRadius: BorderRadius.circular(SingulareTokens.radiusLg),
        border: Border.all(color: SingulareTokens.hairline),
        boxShadow: SingulareTokens.elevation1,
      ),
      child: Row(
        children: [
          _IconBubble(
            icon: widget.icon,
            color: _toneColor,
            background: _toneSoftBg,
            pulse: _pulse,
            animate: widget.animate,
          ),
          const SizedBox(width: SingulareTokens.space16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.title,
                  style: SingulareTokens.heading.copyWith(color: _toneColor),
                ),
                const SizedBox(height: SingulareTokens.space4),
                Text(widget.subtitle, style: SingulareTokens.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IconBubble extends StatelessWidget {
  final IconData icon;
  final Color color;
  final Color background;
  final Animation<double> pulse;
  final bool animate;

  const _IconBubble({
    required this.icon,
    required this.color,
    required this.background,
    required this.pulse,
    required this.animate,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulse,
      builder: (context, child) {
        final scale = animate ? 1 + (pulse.value * 0.06) : 1.0;
        return Stack(
          alignment: Alignment.center,
          children: [
            if (animate)
              Container(
                width: 56 + (pulse.value * 16),
                height: 56 + (pulse.value * 16),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color.withOpacity(0.10 * (1 - pulse.value)),
                ),
              ),
            Transform.scale(
              scale: scale,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: background,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 22),
              ),
            ),
          ],
        );
      },
    );
  }
}
