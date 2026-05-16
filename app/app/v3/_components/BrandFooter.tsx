// Footer navy com hairline gold a 20%, logo, disclosure CNPJ/razao social
// e links privacidade/termos/empresa. Disposicao 3 colunas em desktop, stack em mobile.

import Link from 'next/link';
import { Logo3Squares } from './Logo3Squares';
import { Wordmark } from './Wordmark';
import { BRAND_COLORS, BRAND_LEGAL } from './tokens';

export function BrandFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        background: BRAND_COLORS.navy,
        color: BRAND_COLORS.sand,
        borderTop: `1px solid rgba(255, 198, 47, 0.2)`,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '64px clamp(20px, 5vw, 48px) 40px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 48,
        }}
      >
        <div>
          <Link
            href="/v3"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              textDecoration: 'none',
              marginBottom: 18,
            }}
          >
            <Logo3Squares size={28} color={BRAND_COLORS.gold} />
            <Wordmark color={BRAND_COLORS.sand} size={13} />
          </Link>
          <p
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 13,
              lineHeight: 1.65,
              color: 'rgba(244, 239, 230, 0.6)',
              maxWidth: 280,
            }}
          >
            Plataforma SaaS pra clinicas medicas brasileiras. Atendimento via
            WhatsApp, agenda integrada, cobranca e marketing.
          </p>
        </div>

        <div>
          <p
            style={{
              fontFamily: 'var(--font-poppins)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: BRAND_COLORS.gold,
              marginBottom: 16,
            }}
          >
            Empresa
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 13,
            }}
          >
            {[
              { href: '/v3/empresa', label: 'Sobre' },
              { href: '/v3/bem-vindo', label: 'Como funciona' },
              { href: '/v3/profissionais', label: 'Profissionais' },
              { href: '/v3/onboarding', label: 'Comecar' },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    color: 'rgba(244, 239, 230, 0.7)',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p
            style={{
              fontFamily: 'var(--font-poppins)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: BRAND_COLORS.gold,
              marginBottom: 16,
            }}
          >
            Legal
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 13,
            }}
          >
            <li>
              <Link
                href="/privacidade"
                style={{
                  color: 'rgba(244, 239, 230, 0.7)',
                  textDecoration: 'none',
                }}
              >
                Privacidade
              </Link>
            </li>
            <li>
              <Link
                href="/termos"
                style={{
                  color: 'rgba(244, 239, 230, 0.7)',
                  textDecoration: 'none',
                }}
              >
                Termos
              </Link>
            </li>
            <li>
              <a
                href={`mailto:${BRAND_LEGAL.email}`}
                style={{
                  color: 'rgba(244, 239, 230, 0.7)',
                  textDecoration: 'none',
                }}
              >
                {BRAND_LEGAL.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '24px clamp(20px, 5vw, 48px) 48px',
          borderTop: `1px solid rgba(255, 198, 47, 0.12)`,
          fontFamily: 'var(--font-space-grotesk)',
          fontSize: 11,
          lineHeight: 1.7,
          color: 'rgba(244, 239, 230, 0.5)',
        }}
      >
        <p>
          {BRAND_LEGAL.razaoSocial} · CNPJ {BRAND_LEGAL.cnpj} · Sede em{' '}
          {BRAND_LEGAL.cidade} · {BRAND_LEGAL.uf} · Brasil.
        </p>
        <p style={{ marginTop: 6 }}>
          &copy; {year} Singulare. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
