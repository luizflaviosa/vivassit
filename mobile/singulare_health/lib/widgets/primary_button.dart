import 'package:flutter/material.dart';

import '../theme.dart';

/// Botao primario Singulare.
///
/// Variants:
///   - dark (default): preenchimento near-black, texto branco. Para CTAs principais.
///   - accent: preenchimento violet com glow sutil. Para o "peak moment" final.
///   - ghost: borda hairline, sem fill. Para acoes secundarias.
enum PrimaryButtonVariant { dark, accent, ghost }

class PrimaryButton extends StatefulWidget {
  final String label;
  final VoidCallback? onTap;
  final bool busy;
  final IconData? icon;
  final PrimaryButtonVariant variant;

  const PrimaryButton({
    super.key,
    required this.label,
    required this.onTap,
    this.busy = false,
    this.icon,
    this.variant = PrimaryButtonVariant.dark,
  });

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onTap == null || widget.busy;
    final bg = _bg(disabled);
    final fg = _fg();
    final border = _border();
    final shadows = !disabled && widget.variant == PrimaryButtonVariant.accent
        ? SingulareTokens.elevationAccent
        : const <BoxShadow>[];

    return GestureDetector(
      onTapDown: disabled ? null : (_) => setState(() => _pressed = true),
      onTapCancel: disabled ? null : () => setState(() => _pressed = false),
      onTapUp: disabled ? null : (_) => setState(() => _pressed = false),
      onTap: disabled ? null : widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.985 : 1,
        duration: SingulareTokens.micro_,
        curve: SingulareTokens.easeOut,
        child: AnimatedContainer(
          duration: SingulareTokens.short,
          height: 56,
          decoration: BoxDecoration(
            color: bg,
            border: border,
            borderRadius: BorderRadius.circular(SingulareTokens.radiusMd),
            boxShadow: shadows,
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Hairline inner highlight (sutil dimensao)
              if (widget.variant != PrimaryButtonVariant.ghost)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Container(
                      margin: const EdgeInsets.all(1),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(
                          SingulareTokens.radiusMd - 1,
                        ),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withOpacity(0.08),
                            Colors.white.withOpacity(0),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (widget.busy) ...[
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(fg),
                      ),
                    ),
                    const SizedBox(width: SingulareTokens.space12),
                  ] else if (widget.icon != null) ...[
                    Icon(widget.icon, size: 18, color: fg),
                    const SizedBox(width: SingulareTokens.space8),
                  ],
                  Text(
                    widget.label,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: fg,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _bg(bool disabled) {
    switch (widget.variant) {
      case PrimaryButtonVariant.dark:
        return disabled
            ? SingulareTokens.textPrimary.withOpacity(0.45)
            : SingulareTokens.textPrimary;
      case PrimaryButtonVariant.accent:
        return disabled
            ? SingulareTokens.accent.withOpacity(0.45)
            : SingulareTokens.accent;
      case PrimaryButtonVariant.ghost:
        return SingulareTokens.surface;
    }
  }

  Color _fg() {
    switch (widget.variant) {
      case PrimaryButtonVariant.dark:
      case PrimaryButtonVariant.accent:
        return Colors.white;
      case PrimaryButtonVariant.ghost:
        return SingulareTokens.textPrimary;
    }
  }

  BoxBorder? _border() {
    if (widget.variant == PrimaryButtonVariant.ghost) {
      return Border.all(color: SingulareTokens.hairlineStrong);
    }
    return null;
  }
}
