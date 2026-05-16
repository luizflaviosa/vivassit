// Botao pill solido — fundo gold, texto navy uppercase tracking wide.
// Variante visual principal de CTA. Funciona como Link (next/link) ou anchor externo.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND_COLORS, BRAND_TRACKING } from './tokens';

interface CTAGoldPillProps {
  href: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  external?: boolean;
  prefetch?: boolean;
  className?: string;
  icon?: ReactNode;
}

const SIZE_TOKENS: Record<NonNullable<CTAGoldPillProps['size']>, { padY: string; padX: string; font: string }> = {
  sm: { padY: '10px', padX: '20px', font: '12px' },
  md: { padY: '14px', padX: '28px', font: '13px' },
  lg: { padY: '18px', padX: '36px', font: '14px' },
};

export function CTAGoldPill({
  href,
  label,
  size = 'md',
  external,
  prefetch,
  className,
  icon,
}: CTAGoldPillProps) {
  const tokens = SIZE_TOKENS[size];
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: BRAND_COLORS.gold,
    color: BRAND_COLORS.navy,
    fontFamily: 'var(--font-poppins)',
    fontWeight: 700,
    fontSize: tokens.font,
    letterSpacing: BRAND_TRACKING.pill,
    textTransform: 'uppercase',
    padding: `${tokens.padY} ${tokens.padX}`,
    borderRadius: 999,
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
    boxShadow: '0 6px 20px rgba(255, 198, 47, 0.22)',
    whiteSpace: 'nowrap',
  };

  const content = (
    <>
      <span>{label}</span>
      {icon}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={baseStyle}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} className={className} style={baseStyle}>
      {content}
    </Link>
  );
}
