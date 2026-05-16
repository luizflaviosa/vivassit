// Wordmark "SINGULARE" — Poppins Bold uppercase, tracking 0.32em.
// Sempre acompanha o Logo3Squares no header.

import { BRAND_COLORS, BRAND_TRACKING } from './tokens';

interface WordmarkProps {
  color?: string;
  size?: number;
  className?: string;
}

export function Wordmark({
  color = BRAND_COLORS.sand,
  size = 15,
  className,
}: WordmarkProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-poppins)',
        fontWeight: 700,
        fontSize: size,
        letterSpacing: BRAND_TRACKING.wordmark,
        color,
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      Singulare
    </span>
  );
}
