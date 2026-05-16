// Botao outline — stroke gold sobre fundo navy/transparente, texto gold.
// Variante secundaria pra CTAs co-localizados com o pill solido.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND_COLORS, BRAND_TRACKING } from './tokens';

interface CTAGoldOutlineProps {
  href: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  external?: boolean;
  prefetch?: boolean;
  className?: string;
  icon?: ReactNode;
  /** Cor do texto/stroke. Default gold (#FFC62F). */
  color?: string;
}

const SIZE_TOKENS: Record<NonNullable<CTAGoldOutlineProps['size']>, { padY: string; padX: string; font: string }> = {
  sm: { padY: '9px', padX: '18px', font: '12px' },
  md: { padY: '13px', padX: '26px', font: '13px' },
  lg: { padY: '17px', padX: '34px', font: '14px' },
};

export function CTAGoldOutline({
  href,
  label,
  size = 'md',
  external,
  prefetch,
  className,
  icon,
  color = BRAND_COLORS.gold,
}: CTAGoldOutlineProps) {
  const tokens = SIZE_TOKENS[size];
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    color,
    fontFamily: 'var(--font-poppins)',
    fontWeight: 700,
    fontSize: tokens.font,
    letterSpacing: BRAND_TRACKING.pill,
    textTransform: 'uppercase',
    padding: `${tokens.padY} ${tokens.padX}`,
    borderRadius: 999,
    textDecoration: 'none',
    border: `1px solid ${color}`,
    cursor: 'pointer',
    transition: 'background 0.18s ease, color 0.18s ease',
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
