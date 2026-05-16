// Eyebrow no padrao "— PRA COMECAR" em uppercase tracking 0.28em.
// O traco antes ja vem incluido no children, mas a gente reforca via prefix.

import type { ReactNode } from 'react';
import { BRAND_COLORS, BRAND_TRACKING } from './tokens';

interface EyebrowDashProps {
  children: ReactNode;
  color?: string;
  className?: string;
  withDash?: boolean;
}

export function EyebrowDash({
  children,
  color = BRAND_COLORS.navy,
  className,
  withDash = true,
}: EyebrowDashProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-poppins)',
        fontWeight: 700,
        fontSize: '12px',
        letterSpacing: BRAND_TRACKING.eyebrow,
        textTransform: 'uppercase',
        color,
        display: 'inline-block',
        lineHeight: 1.2,
      }}
    >
      {withDash ? '— ' : ''}
      {children}
    </span>
  );
}
