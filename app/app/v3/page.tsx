// Landing v3 — Luxury Modular Intelligence v1.0.
// Inspirada em /v8.html mas reescrita em JSX clean com o brand navy/gold/sand.
// Estrutura: hero navy + proof bar + o que faz + planos + depoimentos + FAQ + CTA final.

import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandHeader } from './_components/BrandHeader';
import { BrandFooter } from './_components/BrandFooter';
import { SectionShell } from './_components/SectionShell';
import { EyebrowDash } from './_components/EyebrowDash';
import { CTAGoldPill } from './_components/CTAGoldPill';
import { CTAGoldOutline } from './_components/CTAGoldOutline';
import { Logo3Squares } from './_components/Logo3Squares';
import { Wordmark } from './_components/Wordmark';
import { BRAND_COLORS } from './_components/tokens';

export const metadata: Metadata = {
  title: 'Singulare — Conexoes que transformam o seu consultorio',
  description:
    'IA atende seus pacientes no WhatsApp, agenda consultas, organiza pagamentos e mantem seu CRM em dia. Singulare cuida da operacao pra voce cuidar de quem importa.',
};

export default function V3LandingPage() {
  return (
    <>
      <BrandHeader variant="transparent" />

      <Hero />
      <ProofBar />
      <WhatWeDo />
      <Plans />
      <Testimonials />
      <FAQ />
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
        paddingTop: 'clamp(48px, 10vw, 120px)',
        paddingBottom: 'clamp(72px, 12vw, 160px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* halo gold sutil no canto superior */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-30%',
          right: '-10%',
          width: 540,
          height: 540,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255, 198, 47, 0.16), transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 48px)',
          position: 'relative',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Agente de IA pra clinicas</EyebrowDash>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(38px, 7vw, 84px)',
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            color: BRAND_COLORS.sand,
            maxWidth: 14 + 'ch',
            margin: 0,
          }}
        >
          Conexoes que{' '}
          <span style={{ color: BRAND_COLORS.gold }}>transformam</span> o seu
          consultorio.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 'clamp(16px, 2vw, 19px)',
            lineHeight: 1.6,
            color: 'rgba(244, 239, 230, 0.72)',
            maxWidth: '54ch',
            marginTop: 32,
          }}
        >
          Singulare cuida da agenda, das mensagens, da cobranca e do
          pos-atendimento. Voce ganha presenca total pra quem realmente
          importa.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 48,
            flexWrap: 'wrap',
          }}
        >
          <CTAGoldPill href="/v3/onboarding" label="Conhecer a Singulare" size="lg" />
          <CTAGoldOutline href="#planos" label="Ver planos" size="lg" />
        </div>

        <div
          style={{
            marginTop: 36,
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 13,
            color: 'rgba(244, 239, 230, 0.6)',
          }}
        >
          <span>
            <strong style={{ color: BRAND_COLORS.gold }}>·</strong> 14 dias gratis
          </span>
          <span>
            <strong style={{ color: BRAND_COLORS.gold }}>·</strong> Sem cartao de credito
          </span>
          <span>
            <strong style={{ color: BRAND_COLORS.gold }}>·</strong> Em funcionamento em dias
          </span>
        </div>
      </div>
    </section>
  );
}

function ProofBar() {
  const items = [
    { num: '+5.247', label: 'profissionais ativos' },
    { num: '24h', label: 'sempre disponivel' },
    { num: '−62%', label: 'de faltas registradas' },
    { num: '4,9 estrelas', label: 'NPS medio das clinicas' },
  ];

  return (
    <div
      style={{
        background: BRAND_COLORS.navy,
        borderTop: `1px solid rgba(255, 198, 47, 0.2)`,
        borderBottom: `1px solid rgba(255, 198, 47, 0.2)`,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '32px clamp(20px, 5vw, 48px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 24,
        }}
      >
        {items.map((item) => (
          <div key={item.label}>
            <div
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 28,
                color: BRAND_COLORS.gold,
                letterSpacing: '-0.02em',
              }}
            >
              {item.num}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 12,
                color: 'rgba(244, 239, 230, 0.7)',
                marginTop: 4,
                textTransform: 'lowercase',
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatWeDo() {
  const items = [
    {
      title: 'Atendimento 24h',
      body: 'A IA responde no tom da sua clinica, agenda, confirma e direciona casos sensiveis pra voce.',
    },
    {
      title: 'Agenda integrada',
      body: 'Sincroniza com Google Calendar. Multi-profissional. Bloqueios e folgas respeitados.',
    },
    {
      title: 'Cobranca sem fricao',
      body: 'Link Pix, cartao e boleto direto no WhatsApp. Voce escolhe se cobra antes ou depois.',
    },
    {
      title: 'Pos-atendimento',
      body: 'NPS automatico, solicitacao de avaliacao no Google e re-engajamento de inativos.',
    },
  ];

  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={112}>
      <div style={{ marginBottom: 48 }}>
        <EyebrowDash>Pra comecar</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(32px, 5vw, 56px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.navy,
          maxWidth: '20ch',
          margin: 0,
        }}
      >
        Tudo que sua clinica precisa,{' '}
        <span style={{ color: BRAND_COLORS.gold }}>num lugar so</span>.
      </h2>

      <div
        style={{
          marginTop: 64,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          background: 'rgba(15, 27, 51, 0.12)',
          border: `1px solid rgba(15, 27, 51, 0.12)`,
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {items.map((item) => (
          <div
            key={item.title}
            style={{
              background: BRAND_COLORS.sand,
              padding: 36,
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <Logo3Squares size={24} color={BRAND_COLORS.navy} ariaHidden />
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 19,
                color: BRAND_COLORS.navy,
                marginBottom: 10,
                letterSpacing: '-0.01em',
              }}
            >
              {item.title}
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'rgba(15, 27, 51, 0.7)',
              }}
            >
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function Plans() {
  const plans = [
    {
      name: 'Profissional',
      price: 'R$ 197',
      cadence: '/mes',
      desc: 'Pra quem trabalha de forma independente, com dedicacao total a cada paciente.',
      features: [
        'Agendamento via WhatsApp 24h',
        'Lembretes automaticos',
        'Pix, cartao e boleto',
        'NPS e feedback',
        '1 profissional',
      ],
      ctaHref: '/v3/onboarding',
      ctaLabel: 'Comecar gratis',
      highlight: false,
    },
    {
      name: 'Clinica',
      price: 'R$ 397',
      cadence: '/mes',
      desc: 'Pra equipes de ate 5 profissionais que querem crescer sem perder a qualidade.',
      features: [
        'Tudo do Profissional',
        'Ate 5 profissionais',
        'Multi-canal: WhatsApp + email',
        'Sequencias de follow-up',
        'Suporte prioritario',
      ],
      ctaHref: '/v3/onboarding',
      ctaLabel: 'Comecar gratis',
      highlight: true,
    },
    {
      name: 'Na medida',
      price: 'Sob consulta',
      cadence: '',
      desc: 'Pra redes e clinicas com multiplas unidades ou integracoes especificas.',
      features: [
        'Tudo do Clinica',
        'Profissionais ilimitados',
        'Multiplas unidades',
        'Integracoes personalizadas',
        'Gerente de conta dedicado',
      ],
      ctaHref: 'https://wa.me/5511989390155',
      ctaLabel: 'Falar com a equipe',
      highlight: false,
      external: true,
    },
  ];

  return (
    <SectionShell id="planos" background={BRAND_COLORS.navy} paddingY={120}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <EyebrowDash color={BRAND_COLORS.gold}>Planos</EyebrowDash>
        <h2
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(32px, 5vw, 56px)',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: BRAND_COLORS.sand,
            marginTop: 18,
            maxWidth: '22ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Encontre o ritmo da{' '}
          <span style={{ color: BRAND_COLORS.gold }}>sua clinica</span>.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 16,
            color: 'rgba(244, 239, 230, 0.65)',
            marginTop: 18,
          }}
        >
          Simples, transparente, sem letra miuda.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 24,
        }}
      >
        {plans.map((plan) => {
          const isHi = plan.highlight;
          return (
            <article
              key={plan.name}
              style={{
                position: 'relative',
                background: isHi
                  ? 'rgba(255, 198, 47, 0.06)'
                  : 'rgba(244, 239, 230, 0.04)',
                border: `1px solid ${
                  isHi
                    ? 'rgba(255, 198, 47, 0.55)'
                    : 'rgba(244, 239, 230, 0.18)'
                }`,
                borderRadius: 8,
                padding: 36,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isHi && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: 24,
                    background: BRAND_COLORS.gold,
                    color: BRAND_COLORS.navy,
                    fontFamily: 'var(--font-poppins)',
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    padding: '6px 12px',
                    borderRadius: 999,
                  }}
                >
                  Mais escolhido
                </div>
              )}
              <h3
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: BRAND_COLORS.gold,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}
              >
                {plan.name}
              </h3>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 44,
                  color: BRAND_COLORS.sand,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {plan.price}
                {plan.cadence && (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 400,
                      color: 'rgba(244, 239, 230, 0.5)',
                      marginLeft: 6,
                    }}
                  >
                    {plan.cadence}
                  </span>
                )}
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-space-grotesk)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'rgba(244, 239, 230, 0.7)',
                  marginTop: 14,
                  marginBottom: 24,
                }}
              >
                {plan.desc}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 36px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  fontFamily: 'var(--font-space-grotesk)',
                  fontSize: 14,
                  color: 'rgba(244, 239, 230, 0.85)',
                  flex: 1,
                }}
              >
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 10 }}>
                    <span
                      style={{
                        color: BRAND_COLORS.gold,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      ·
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              {isHi ? (
                <CTAGoldPill
                  href={plan.ctaHref}
                  label={plan.ctaLabel}
                  size="md"
                  external={plan.external}
                />
              ) : (
                <CTAGoldOutline
                  href={plan.ctaHref}
                  label={plan.ctaLabel}
                  size="md"
                  external={plan.external}
                />
              )}
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

function Testimonials() {
  const testimonials = [
    {
      quote:
        'Passei anos saindo das consultas pensando nas ligacoes que precisava fazer. Hoje entro no consultorio e sei que o resto esta em boas maos.',
      name: 'Dra. Paula F.',
      role: 'Fisioterapia · Sao Paulo',
    },
    {
      quote:
        'Um paciente me disse que nunca tinha se sentido tao bem atendido. Foi uma mensagem que eu nem vi, respondida pela Singulare as 22h.',
      name: 'Dr. Ricardo S.',
      role: 'Psicologia · Rio de Janeiro',
    },
    {
      quote:
        'Tinha medo de parecer impessoal. Mas a Singulare aprendeu o nosso jeito e os pacientes nem percebem. So percebem que sao bem atendidos.',
      name: 'Dra. Camila N.',
      role: 'Nutricao · Belo Horizonte',
    },
  ];

  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={120}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <EyebrowDash>Depoimentos</EyebrowDash>
        <h2
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(30px, 4.5vw, 52px)',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: BRAND_COLORS.navy,
            marginTop: 18,
            maxWidth: '22ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          O que muda pra quem ja{' '}
          <span style={{ color: BRAND_COLORS.gold }}>usa a Singulare</span>.
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 24,
        }}
      >
        {testimonials.map((t) => (
          <blockquote
            key={t.name}
            style={{
              margin: 0,
              padding: 32,
              background: '#fff',
              border: `1px solid rgba(15, 27, 51, 0.1)`,
              borderRadius: 6,
            }}
          >
            <div
              style={{
                color: BRAND_COLORS.gold,
                fontSize: 18,
                letterSpacing: '0.15em',
                marginBottom: 16,
              }}
            >
              ★★★★★
            </div>
            <p
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 15,
                lineHeight: 1.6,
                color: BRAND_COLORS.graphite,
                margin: 0,
              }}
            >
              {t.quote}
            </p>
            <footer
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: `1px solid rgba(15, 27, 51, 0.08)`,
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 13,
                color: BRAND_COLORS.navy,
              }}
            >
              {t.name}
              <div
                style={{
                  fontWeight: 400,
                  fontFamily: 'var(--font-space-grotesk)',
                  fontSize: 12,
                  color: 'rgba(15, 27, 51, 0.55)',
                  marginTop: 4,
                }}
              >
                {t.role}
              </div>
            </footer>
          </blockquote>
        ))}
      </div>
    </SectionShell>
  );
}

function FAQ() {
  const faqs = [
    {
      q: 'A IA realmente entende meu fluxo?',
      a: 'A IA aprende o tom da sua clinica nas primeiras conversas. Voce ainda pode editar o prompt no painel pra refinar o jeito de responder.',
    },
    {
      q: 'E se eu quiser assumir uma conversa?',
      a: 'Voce pode pausar a IA a qualquer momento pelo painel. Quando entra, a IA recua automaticamente.',
    },
    {
      q: 'Substitui minha secretaria?',
      a: 'Substitui a parte repetitiva: agendamento, cobranca, lembrete, follow-up. A secretaria humana fica com casos sensiveis e presencial.',
    },
    {
      q: 'Quanto tempo ate estar rodando?',
      a: 'Onboarding em ate 30 minutos. Conectamos seu WhatsApp, configuramos agenda e cobranca. Voce revisa e libera.',
    },
  ];

  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={120}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <EyebrowDash>Perguntas frequentes</EyebrowDash>
        <h2
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(30px, 4.5vw, 52px)',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            color: BRAND_COLORS.navy,
            marginTop: 18,
            maxWidth: '22ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Duvidas comuns,{' '}
          <span style={{ color: BRAND_COLORS.gold }}>respondidas</span>.
        </h2>
      </div>

      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {faqs.map((f) => (
          <details
            key={f.q}
            style={{
              background: '#fff',
              border: `1px solid rgba(15, 27, 51, 0.1)`,
              borderRadius: 6,
              padding: '20px 24px',
            }}
          >
            <summary
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 16,
                color: BRAND_COLORS.navy,
                cursor: 'pointer',
                listStyle: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span>{f.q}</span>
              <span
                aria-hidden
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 400,
                  fontSize: 22,
                  color: BRAND_COLORS.gold,
                  lineHeight: 1,
                }}
              >
                +
              </span>
            </summary>
            <p
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'rgba(15, 27, 51, 0.7)',
                marginTop: 14,
                marginBottom: 0,
              }}
            >
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

function FinalCTA() {
  return (
    <section
      style={{
        background: BRAND_COLORS.navy,
        color: BRAND_COLORS.sand,
        paddingTop: 120,
        paddingBottom: 120,
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 680,
          height: 680,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255, 198, 47, 0.14), transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 clamp(20px, 5vw, 48px)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <Logo3Squares size={36} color={BRAND_COLORS.gold} />
          <Wordmark color={BRAND_COLORS.sand} size={14} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Proximo passo</EyebrowDash>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(34px, 6vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: BRAND_COLORS.sand,
            margin: 0,
          }}
        >
          Sua proxima semana{' '}
          <span style={{ color: BRAND_COLORS.gold }}>pode ser diferente</span>.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 17,
            color: 'rgba(244, 239, 230, 0.7)',
            marginTop: 24,
            marginBottom: 40,
          }}
        >
          Sem pressao, sem jargao tecnico. Comece hoje e veja a diferenca em dias.
        </p>
        <CTAGoldPill href="/v3/onboarding" label="Comecar gratis" size="lg" />
        <p
          style={{
            marginTop: 24,
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 12,
            color: 'rgba(244, 239, 230, 0.5)',
          }}
        >
          14 dias gratis · Sem configuracao tecnica · Cancele quando quiser
        </p>
      </div>
    </section>
  );
}
