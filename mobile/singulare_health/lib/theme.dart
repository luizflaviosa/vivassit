import 'package:flutter/material.dart';

/// Design tokens Singulare.
///
/// Referencias visuais: Apple Health, Linear, Vercel.
/// Regra 60/30/10: 60% neutros, 30% near-black, 10% accent violet.
class SingulareTokens {
  SingulareTokens._();

  // ---------- Cores ----------
  // Accent — violet Singulare
  static const Color accent = Color(0xFF6E56CF);
  static const Color accentSoft = Color(0x196E56CF); // 10% opacity para fundos sutis

  // Neutros (60%)
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFFAFAFA);
  static const Color surfaceSunken = Color(0xFFF4F4F5);

  // Conteudo (30%)
  static const Color textPrimary = Color(0xFF0A0A0A);
  static const Color textSecondary = Color(0xA60A0A0A); // 65%
  static const Color textTertiary = Color(0x730A0A0A); // 45%
  static const Color textDisabled = Color(0x4D0A0A0A); // 30%

  // Hairlines (border 6%)
  static const Color hairline = Color(0x0F0A0A0A);
  static const Color hairlineStrong = Color(0x1A0A0A0A);

  // Estados semanticos (uso parcimonioso)
  static const Color success = Color(0xFF0EA672);
  static const Color successSoft = Color(0x1F0EA672);
  static const Color warning = Color(0xFFB8860B);
  static const Color danger = Color(0xFFD0344C);
  static const Color dangerSoft = Color(0xFFFEF2F2);

  // ---------- Tipografia ----------
  static const String fontFamily = '.SF Pro Text'; // iOS default fallback

  static const TextStyle display = TextStyle(
    fontSize: 28,
    height: 1.2,
    letterSpacing: -0.6,
    fontWeight: FontWeight.w600,
    color: textPrimary,
  );

  static const TextStyle title = TextStyle(
    fontSize: 22,
    height: 1.25,
    letterSpacing: -0.4,
    fontWeight: FontWeight.w600,
    color: textPrimary,
  );

  static const TextStyle heading = TextStyle(
    fontSize: 17,
    height: 1.35,
    letterSpacing: -0.2,
    fontWeight: FontWeight.w600,
    color: textPrimary,
  );

  static const TextStyle body = TextStyle(
    fontSize: 15,
    height: 1.5,
    letterSpacing: -0.1,
    fontWeight: FontWeight.w400,
    color: textSecondary,
  );

  static const TextStyle bodyStrong = TextStyle(
    fontSize: 15,
    height: 1.5,
    letterSpacing: -0.1,
    fontWeight: FontWeight.w500,
    color: textPrimary,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 13,
    height: 1.4,
    letterSpacing: 0,
    fontWeight: FontWeight.w400,
    color: textTertiary,
  );

  static const TextStyle micro = TextStyle(
    fontSize: 11,
    height: 1.35,
    letterSpacing: 0.4,
    fontWeight: FontWeight.w500,
    color: textTertiary,
  );

  // ---------- Spacing (8pt grid) ----------
  static const double space4 = 4;
  static const double space8 = 8;
  static const double space12 = 12;
  static const double space16 = 16;
  static const double space20 = 20;
  static const double space24 = 24;
  static const double space32 = 32;
  static const double space48 = 48;
  static const double space64 = 64;

  // ---------- Radius ----------
  static const double radiusSm = 10;
  static const double radiusMd = 14;
  static const double radiusLg = 18;
  static const double radiusXl = 24;
  static const double radiusFull = 999;

  // ---------- Shadows ----------
  static const List<BoxShadow> elevation1 = [
    BoxShadow(
      color: Color(0x0F0A0A0A),
      blurRadius: 16,
      offset: Offset(0, 4),
      spreadRadius: -4,
    ),
  ];

  static const List<BoxShadow> elevationAccent = [
    BoxShadow(
      color: Color(0x336E56CF),
      blurRadius: 24,
      offset: Offset(0, 8),
      spreadRadius: -8,
    ),
  ];

  // ---------- Durations ----------
  static const Duration micro_ = Duration(milliseconds: 120);
  static const Duration short = Duration(milliseconds: 220);
  static const Duration medium = Duration(milliseconds: 360);
  static const Duration long = Duration(milliseconds: 600);

  // ---------- Curves ----------
  static const Curve easeOut = Curves.easeOutCubic;
  static const Curve easeInOut = Curves.easeInOutCubic;
}

/// Theme global Material 3 com tokens Singulare.
ThemeData singulareTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: SingulareTokens.surfaceMuted,
    colorScheme: ColorScheme.fromSeed(
      seedColor: SingulareTokens.accent,
      brightness: Brightness.light,
      surface: SingulareTokens.surface,
      onSurface: SingulareTokens.textPrimary,
    ),
    textTheme: const TextTheme(
      displaySmall: SingulareTokens.display,
      titleLarge: SingulareTokens.title,
      titleMedium: SingulareTokens.heading,
      bodyLarge: SingulareTokens.bodyStrong,
      bodyMedium: SingulareTokens.body,
      bodySmall: SingulareTokens.caption,
      labelSmall: SingulareTokens.micro,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      foregroundColor: SingulareTokens.textPrimary,
      titleTextStyle: SingulareTokens.heading,
      centerTitle: false,
    ),
    splashFactory: NoSplash.splashFactory,
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
  );
}
