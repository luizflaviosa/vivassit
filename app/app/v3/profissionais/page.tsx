// /v3/profissionais — landing B2B pro profissional individual.
// Grid de profissoes que a Singulare atende + CTA pro onboarding.

import type { Metadata } from 'next';
import Link from 'next/link';
import { PROFESSIONAL_TYPES } from '@/lib/types';
import { BrandHeader } from '../_components/BrandHeader';
import { BrandFooter } from '../_components/BrandFooter';
import { SectionShell } from '../_components/SectionShell';
import { EyebrowDash } from '../_components/EyebrowDash';
import { CTAGoldPill } from '../_components/CTAGoldPill';
import { CTAGoldOutline } from '../_components/CTAGoldOutline';
import { Logo3Squares } from '../_components/Logo3Squares';
import { BRAND_COLORS } from '../_components/tokens';

export const metadata: Metadata = {
  title: 'Singulare pra profissionais de saude',
  description:
    'Singulare opera o atendimento, agenda, cobranca e marketing de profissionais de saude brasileiros: medicos, dentistas, psicologos, fisios, nutris e mais.',
};

const PILARES = [
  {
    title: 'Voce define o tom',
    body: 'A IA aprende o jeito do seu consultorio. Voce edita o prompt direto no painel.',
  },
  {
    title: 'Voce pausa quando quiser',
    body: 'Atribui a conversa pra voce e a IA recua. Quando sair, ela retoma.',
  },
  {
    title: 'Voce mantem o controle',
    body: 'Agenda, prontuario, cobranca e relatorios sao seus. A IA so opera, nao decide clinicamente.',
  },
];

export default function V3ProfissionaisPage() {
  return (
    <>
      <BrandHeader />
      <Hero />
      <Profissoes />
      <Pilares />
      <FinalCTA />
      <BrandFooter />
    </>
  );
}

function Hero() {
  return (
    <section
      style={{
        background: BRAND_COLORS.navy,
        color: BRAND_COLORS.sand,
        paddingTop: 96,
        paddingBottom: 96,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 48px)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Profissionais</EyebrowDash>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(36px, 6vw, 68px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: BRAND_COLORS.sand,
            margin: 0,
            maxWidth: '18ch',
          }}
        >
          Singulare pra quem{' '}
          <span style={{ color: BRAND_COLORS.gold }}>cuida de pessoas</span>.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 17,
            lineHeight: 1.65,
            color: 'rgba(244, 239, 230, 0.72)',
            marginTop: 24,
            maxWidth: '54ch',
          }}
        >
          Da medicina a estetica, passando por psicologia, fisioterapia,
          nutricao e mais. A Singulare opera no tom do seu consultorio, sem
          desumaniza-lo.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 14,
            marginTop: 40,
            flexWrap: 'wrap',
          }}
        >
          <CTAGoldPill href="/v3/onboarding" label="Comecar gratis" size="md" />
          <CTAGoldOutline href="/v3/bem-vindo" label="Como funciona" size="md" />
        </div>
      </div>
    </section>
  );
}

function Profissoes() {
  const profissoes = Object.entries(PROFESSIONAL_TYPES).filter(
    ([key]) => key !== 'outro',
  );

  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <div style={{ marginBottom: 18 }}>
        <EyebrowDash>Especialidades atendidas</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 44px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.navy,
          margin: 0,
          maxWidth: '22ch',
        }}
      >
        Cada profissao tem seu fluxo. A IA{' '}
        <span style={{ color: BRAND_COLORS.gold }}>aprende o seu</span>.
      </h2>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {profissoes.map(([key, label]) => (
          <Link
            key={key}
            href={`/profissionais/sao-paulo/${key}`}
            style={{
              background: '#fff',
              border: `1px solid rgba(15, 27, 51, 0.1)`,
              borderRadius: 6,
              padding: '20px 22px',
              textDecoration: 'none',
              color: BRAND_COLORS.navy,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              transition: 'border-color 0.18s ease',
            }}
          >
            <Logo3Squares size={20} color={BRAND_COLORS.gold} ariaHidden />
            <span
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 14,
                color: BRAND_COLORS.navy,
                letterSpacing: '-0.005em',
              }}
            >
              {label as string}
            </span>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

function Pilares() {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <div style={{ marginBottom: 18 }}>
        <EyebrowDash>Pilares</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 44px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.navy,
          margin: 0,
          maxWidth: '22ch',
        }}
      >
        Tres principios que a{' '}
        <span style={{ color: BRAND_COLORS.gold }}>Singulare nao quebra</span>.
      </h2>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {PILARES.map((p, idx) => (
          <article
            key={p.title}
            style={{
              background: '#fff',
              border: `1px solid rgba(15, 27, 51, 0.1)`,
              borderRadius: 6,
              padding: 28,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: BRAND_COLORS.gold,
                marginBottom: 14,
              }}
            >
              0{idx + 1}
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 18,
                color: BRAND_COLORS.navy,
                margin: 0,
                marginBottom: 10,
                letterSpacing: '-0.01em',
              }}
            >
              {p.title}
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'rgba(15, 27, 51, 0.7)',
                margin: 0,
              }}
            >
              {p.body}
            </p>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

function FinalCTA() {
  return (
    <SectionShell background={BRAND_COLORS.navy} paddingY={96}>
      <div style={{ textAlign: 'center', color: BRAND_COLORS.sand }}>
        <div style={{ marginBottom: 18 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Vamos comecar</EyebrowDash>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 4vw, 44px)',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: BRAND_COLORS.sand,
            margin: 0,
            maxWidth: '22ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Voce cuida das pessoas. A{' '}
          <span style={{ color: BRAND_COLORS.gold }}>Singulare cuida do resto</span>.
        </h2>
        <div style={{ marginTop: 32 }}>
          <CTAGoldPill href="/v3/onboarding" label="Comecar agora" size="lg" />
        </div>
      </div>
    </SectionShell>
  );
}
