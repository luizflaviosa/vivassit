// Header navy fixo no topo — Logo + Wordmark + nav opcional + CTA gold.
// Mobile: nav some, fica so logo + CTA compacto.

import Link from 'next/link';
import { Logo3Squares } from './Logo3Squares';
import { Wordmark } from './Wordmark';
import { CTAGoldPill } from './CTAGoldPill';
import { BRAND_COLORS } from './tokens';

interface BrandHeaderProps {
  /** Mostra links de navegacao (default true). Desabilita em paginas com fluxo focado (onboarding/conectar). */
  showNav?: boolean;
  /** Mostra CTA "Comecar" no canto direito. */
  showCTA?: boolean;
  /** Variante: 'transparent' deixa o header sem background (usado em hero navy). */
  variant?: 'solid' | 'transparent';
}

const NAV_LINKS = [
  { href: '/v3/empresa', label: 'Empresa' },
  { href: '/v3/profissionais', label: 'Profissionais' },
  { href: '/v3/bem-vindo', label: 'Como funciona' },
];

export function BrandHeader({
  showNav = true,
  showCTA = true,
  variant = 'solid',
}: BrandHeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        background: variant === 'solid' ? BRAND_COLORS.navy : 'transparent',
        borderBottom:
          variant === 'solid'
            ? `1px solid rgba(255, 198, 47, 0.12)`
            : 'none',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '18px clamp(20px, 5vw, 48px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <Link
          href="/v3"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
          }}
          aria-label="Singulare — Inicio"
        >
          <Logo3Squares size={32} color={BRAND_COLORS.gold} />
          <Wordmark color={BRAND_COLORS.sand} size={14} />
        </Link>

        {showNav && (
          <nav
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 36,
            }}
            className="v3-nav-desktop"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: 'var(--font-space-grotesk)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: BRAND_COLORS.sand,
                  textDecoration: 'none',
                  opacity: 0.85,
                  transition: 'opacity 0.18s ease',
                  letterSpacing: '0.01em',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {showCTA && (
          <CTAGoldPill
            href="/v3/onboarding"
            label="Comecar"
            size="sm"
          />
        )}
      </div>

      {/* mostrar a nav so a partir de 720px */}
      <style>{`
        @media (min-width: 720px) {
          .v3-nav-desktop { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}
