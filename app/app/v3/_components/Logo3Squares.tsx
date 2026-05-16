// Marca grafica Luxury Modular Intelligence — 3 quadrados sobrepostos.
// Cada quadrado representa um pilar (atendimento, agenda, inteligencia)
// e a sobreposicao sugere modularidade. Default gold sobre navy.

import { BRAND_COLORS } from './tokens';

interface Logo3SquaresProps {
  size?: number;
  color?: string;
  className?: string;
  ariaHidden?: boolean;
}

export function Logo3Squares({
  size = 36,
  color = BRAND_COLORS.gold,
  className,
  ariaHidden = false,
}: Logo3SquaresProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role={ariaHidden ? undefined : 'img'}
      aria-hidden={ariaHidden || undefined}
      aria-label={ariaHidden ? undefined : 'Singulare'}
      className={className}
    >
      {/* Quadrado mais ao fundo */}
      <rect
        x="6"
        y="6"
        width="22"
        height="22"
        rx="1.5"
        stroke={color}
        strokeWidth="1.6"
        opacity="0.55"
      />
      {/* Quadrado intermediario */}
      <rect
        x="13"
        y="13"
        width="22"
        height="22"
        rx="1.5"
        stroke={color}
        strokeWidth="1.6"
        opacity="0.8"
      />
      {/* Quadrado em primeiro plano */}
      <rect
        x="20"
        y="20"
        width="22"
        height="22"
        rx="1.5"
        stroke={color}
        strokeWidth="1.6"
      />
    </svg>
  );
}
