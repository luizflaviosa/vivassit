// /v3/secretaria-ia/[especialidade]/[cidade] — template programatico
// no brand Luxury Modular. Mantem mesmas combinacoes da rota original
// (especialidades x cidades de @/lib/seo-data) mas com visual navy/gold.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  SEO_ESPECIALIDADES,
  CITIES,
  findSeoEspecialidade,
  findCity,
} from '@/lib/seo-data';
import { BrandHeader } from '../../../_components/BrandHeader';
import { BrandFooter } from '../../../_components/BrandFooter';
import { SectionShell } from '../../../_components/SectionShell';
import { EyebrowDash } from '../../../_components/EyebrowDash';
import { CTAGoldPill } from '../../../_components/CTAGoldPill';
import { CTAGoldOutline } from '../../../_components/CTAGoldOutline';
import { Logo3Squares } from '../../../_components/Logo3Squares';
import { BRAND_COLORS } from '../../../_components/tokens';

interface Props {
  params: { especialidade: string; cidade: string };
}

export async function generateStaticParams() {
  const out: Array<{ especialidade: string; cidade: string }> = [];
  for (const e of SEO_ESPECIALIDADES) {
    for (const c of CITIES) {
      out.push({ especialidade: e.slug, cidade: c.slug });
    }
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const esp = findSeoEspecialidade(params.especialidade);
  const cid = findCity(params.cidade);
  if (!esp || !cid) return {};
  return {
    title: `Secretaria IA pra ${esp.name} em ${cid.name}`,
    description: `Atendimento via WhatsApp pra ${esp.plural.toLowerCase()} em ${cid.name}. Agenda, cobranca, lembretes e marketing — operando 24/7. Visual Luxury Modular.`,
    robots: { index: false, follow: true },
  };
}

const FEATURES = [
  {
    title: 'Atendimento (IA + humano)',
    items: [
      'IA conversa no tom do consultorio',
      'Escalacao automatica pra humano',
      'Memoria do paciente',
      'Atendimento 24/7 sem turnover',
    ],
  },
  {
    title: 'Agenda integrada',
    items: [
      'Sincroniza com Google Calendar',
      'Multi-profissional',
      'Agendamento online pelo paciente',
      'Bloqueios e folgas',
    ],
  },
  {
    title: 'Cobranca e financeiro',
    items: [
      'Link Pix, cartao e boleto',
      'Cobranca no dia ou apos atendimento',
      'Conciliacao bancaria basica',
      'Cobranca ativa via IA',
    ],
  },
  {
    title: 'Nota fiscal',
    items: [
      'Solicitacao automatica ao contador',
      'Acompanha emissao',
      'Envia NF ao paciente',
    ],
  },
  {
    title: 'Lembretes inteligentes',
    items: [
      'Confirmacao D-1',
      'Lembrete na hora',
      'Follow-up pos-atendimento',
      'Re-engajamento de inativos',
    ],
  },
  {
    title: 'Marketing e crescimento',
    items: [
      'NPS automatico',
      'Avaliacao Google apos NPS alto',
      'Campanhas em massa via WhatsApp',
      'Indicacoes: link unico por paciente',
    ],
  },
  {
    title: 'Saude remota (RPM)',
    items: [
      'App Apple Saude / Google Fit',
      'Sinais vitais continuos',
      'Alertas no painel',
      'Painel longitudinal',
    ],
  },
  {
    title: 'Painel e relatorios',
    items: [
      'Visao diaria das operacoes',
      'Metricas: faturamento, no-show, NPS',
      'Historico do paciente',
      'Exames e documentos centralizados',
    ],
  },
];

export default async function V3SecretariaIaPage({ params }: Props) {
  const esp = findSeoEspecialidade(params.especialidade);
  const cid = findCity(params.cidade);
  if (!esp || !cid) notFound();

  const audience = esp.audience;
  const audiencePlural = audience === 'cliente' ? 'clientes' : 'pacientes';
  const especialidadeLower = esp.name.toLowerCase();

  return (
    <>
      <BrandHeader />

      <Hero esp={esp} cid={cid} especialidadeLower={especialidadeLower} />
      <UseCases esp={esp} />
      <HowItWorks esp={esp} audience={audience} />
      <FeaturesGrid esp={esp} especialidadeLower={especialidadeLower} />
      <SocialProof
        esp={esp}
        cid={cid}
        audiencePlural={audiencePlural}
        especialidadeLower={especialidadeLower}
      />
      <FaqLocal
        esp={esp}
        cid={cid}
        audiencePlural={audiencePlural}
        especialidadeLower={especialidadeLower}
      />
      <FinalCTA especialidadeLower={especialidadeLower} />

      <BrandFooter />
    </>
  );
}

function Breadcrumb({ esp, cid }: { esp: { name: string }; cid: { name: string } }) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        gap: 8,
        fontFamily: 'var(--font-space-grotesk)',
        fontSize: 12,
        color: 'rgba(244, 239, 230, 0.6)',
        marginBottom: 28,
      }}
    >
      <Link
        href="/v3"
        style={{ color: 'rgba(244, 239, 230, 0.65)', textDecoration: 'none' }}
      >
        Inicio
      </Link>
      <span>·</span>
      <span>Secretaria IA</span>
      <span>·</span>
      <span style={{ color: BRAND_COLORS.gold }}>{esp.name}</span>
      <span>·</span>
      <span style={{ color: BRAND_COLORS.sand }}>{cid.name}</span>
    </nav>
  );
}

function Hero({
  esp,
  cid,
  especialidadeLower,
}: {
  esp: { name: string };
  cid: { name: string; state: string };
  especialidadeLower: string;
}) {
  return (
    <section
      style={{
        background: BRAND_COLORS.navy,
        color: BRAND_COLORS.sand,
        paddingTop: 80,
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
        <Breadcrumb esp={esp} cid={cid} />

        <div style={{ marginBottom: 24 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Pra {especialidadeLower}</EyebrowDash>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(34px, 5vw, 60px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: BRAND_COLORS.sand,
            margin: 0,
            maxWidth: '22ch',
          }}
        >
          Secretaria IA pra {esp.name} em{' '}
          <span style={{ color: BRAND_COLORS.gold }}>{cid.name}</span>.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 17,
            lineHeight: 1.65,
            color: 'rgba(244, 239, 230, 0.72)',
            marginTop: 24,
            maxWidth: '56ch',
          }}
        >
          Atendimento via WhatsApp, agenda integrada, cobranca e marketing —
          operando 24/7 pro seu consultorio de {especialidadeLower} em{' '}
          {cid.name}/{cid.state}. Sem aumentar custo fixo.
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
          <CTAGoldOutline href="/v3/bem-vindo" label="Ver como funciona" size="md" />
        </div>
      </div>
    </section>
  );
}

function UseCases({ esp }: { esp: { useCases: ReadonlyArray<string>; name: string; article: 'o' | 'a' } }) {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={96}>
      <div style={{ marginBottom: 18 }}>
        <EyebrowDash>Casos de uso</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.navy,
          margin: 0,
          maxWidth: '22ch',
        }}
      >
        Pra {esp.article === 'a' ? 'a' : 'o'} {esp.name.toLowerCase()}, a{' '}
        <span style={{ color: BRAND_COLORS.gold }}>Singulare assume</span>:
      </h2>

      <div
        style={{
          marginTop: 40,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {esp.useCases.map((uc) => (
          <div
            key={uc}
            style={{
              background: '#fff',
              border: `1px solid rgba(15, 27, 51, 0.1)`,
              borderRadius: 6,
              padding: 24,
            }}
          >
            <Logo3Squares size={20} color={BRAND_COLORS.gold} ariaHidden />
            <p
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 15,
                lineHeight: 1.55,
                color: BRAND_COLORS.navy,
                margin: '14px 0 0 0',
              }}
            >
              {uc}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function HowItWorks({
  esp,
  audience,
}: {
  esp: { plural: string; appointmentTerm: string };
  audience: 'paciente' | 'cliente';
}) {
  const steps = [
    {
      n: '01',
      title: `${audience === 'cliente' ? 'Cliente' : 'Paciente'} chama no WhatsApp`,
      body: 'A IA responde em segundos, entende o motivo do contato e direciona — agendamento, duvida, cobranca ou urgencia.',
    },
    {
      n: '02',
      title: 'Agenda, cobra e confirma',
      body: `Marca o ${esp.appointmentTerm === 'sessao' ? 'horario' : 'atendimento'} no Google Calendar, envia link de pagamento e confirma D-1.`,
    },
    {
      n: '03',
      title: 'Voce atende — so a decisao profissional',
      body: 'Presencial, caso complexo, decisao profissional: ficam com voce. Operacional a IA cuida.',
    },
    {
      n: '04',
      title: 'Pos-atendimento automatizado',
      body: 'NPS, solicitacao de avaliacao Google, lembrete de retorno e re-engajamento de inativos rodam sozinhos.',
    },
  ];

  return (
    <SectionShell background={BRAND_COLORS.navy} paddingY={96}>
      <div style={{ marginBottom: 18 }}>
        <EyebrowDash color={BRAND_COLORS.gold}>Como funciona</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.sand,
          margin: 0,
          maxWidth: '22ch',
        }}
      >
        Quatro passos. Sem voce abrir o{' '}
        <span style={{ color: BRAND_COLORS.gold }}>celular</span>.
      </h2>

      <ol
        style={{
          marginTop: 48,
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        {steps.map((step) => (
          <li
            key={step.n}
            style={{
              background: 'rgba(244, 239, 230, 0.05)',
              border: `1px solid rgba(244, 239, 230, 0.15)`,
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
                color: BRAND_COLORS.gold,
                marginBottom: 14,
              }}
            >
              {step.n}
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 17,
                color: BRAND_COLORS.sand,
                margin: 0,
                marginBottom: 8,
                letterSpacing: '-0.01em',
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'rgba(244, 239, 230, 0.7)',
                margin: 0,
              }}
            >
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function FeaturesGrid({
  esp,
  especialidadeLower,
}: {
  esp: { article: 'o' | 'a' };
  especialidadeLower: string;
}) {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <div style={{ marginBottom: 18 }}>
        <EyebrowDash>Funcionalidades</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.navy,
          margin: 0,
          maxWidth: '22ch',
        }}
      >
        Oito frentes,{' '}
        <span style={{ color: BRAND_COLORS.gold }}>uma plataforma</span>.
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-space-grotesk)',
          fontSize: 15,
          color: 'rgba(15, 27, 51, 0.65)',
          marginTop: 14,
          maxWidth: '60ch',
        }}
      >
        Tudo que {esp.article === 'a' ? 'a' : 'o'} {especialidadeLower} precisa
        pra atender, cobrar, fidelizar e crescer no WhatsApp.
      </p>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 1,
          background: 'rgba(15, 27, 51, 0.12)',
          border: `1px solid rgba(15, 27, 51, 0.12)`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {FEATURES.map((cat) => (
          <div
            key={cat.title}
            style={{
              background: '#fff',
              padding: 28,
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 14,
                color: BRAND_COLORS.gold,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              {cat.title}
            </h3>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontFamily: 'var(--font-space-grotesk)',
                fontSize: 13,
                lineHeight: 1.55,
                color: BRAND_COLORS.navy,
              }}
            >
              {cat.items.map((item) => (
                <li key={item} style={{ display: 'flex', gap: 10 }}>
                  <span
                    style={{ color: BRAND_COLORS.gold, flexShrink: 0 }}
                    aria-hidden
                  >
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function SocialProof({
  esp,
  cid,
  audiencePlural,
  especialidadeLower,
}: {
  esp: { plural: string };
  cid: { name: string; state: string };
  audiencePlural: string;
  especialidadeLower: string;
}) {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={96}>
      <div style={{ marginBottom: 18 }}>
        <EyebrowDash>Prova local</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(26px, 3.5vw, 36px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.navy,
          margin: 0,
          maxWidth: '24ch',
        }}
      >
        {esp.plural} em {cid.name} ja{' '}
        <span style={{ color: BRAND_COLORS.gold }}>usam</span>.
      </h2>
      <div
        style={{
          marginTop: 36,
          background: '#fff',
          border: `1px solid rgba(15, 27, 51, 0.1)`,
          borderRadius: 6,
          padding: 32,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 16,
            lineHeight: 1.65,
            color: BRAND_COLORS.navy,
            margin: 0,
          }}
        >
          Consultorios de {especialidadeLower} em {cid.name}/{cid.state} tem
          rodado a Singulare com queda media de no-show entre 20% e 40%,
          recuperacao de {audiencePlural} inativos via campanhas em massa e NPS
          medio acima de 9. Cada caso tem numeros proprios — sem promessa
          generica.
        </p>
      </div>
    </SectionShell>
  );
}

function FaqLocal({
  esp,
  cid,
  audiencePlural,
  especialidadeLower,
}: {
  esp: { plural: string; useCases: ReadonlyArray<string> };
  cid: { name: string };
  audiencePlural: string;
  especialidadeLower: string;
}) {
  const faqs = [
    {
      q: `A IA funciona pra ${especialidadeLower}?`,
      a: `Sim. A Singulare foi treinada com fluxos reais de ${esp.plural.toLowerCase()}, incluindo ${esp.useCases.slice(0, 2).join(' e ')}. A IA aprende o tom do consultorio nas primeiras conversas e respeita o vocabulario da profissao.`,
    },
    {
      q: `Substituiu minha secretaria em ${cid.name}?`,
      a: 'Substitui a parte repetitiva: agendamento, confirmacao, cobranca, follow-up. Em clinicas com mais de um profissional, a secretaria humana foca em casos sensiveis. Em consultorio solo, a IA assume praticamente 100% do operacional.',
    },
    {
      q: 'Como funciona a cobranca?',
      a: 'Link de pagamento direto no WhatsApp (Pix, cartao, boleto). Cobranca automatica no dia ou pos-atendimento. Inadimplencia tem cobranca ativa via IA, com tom configuravel.',
    },
    {
      q: 'Quanto tempo ate estar rodando?',
      a: `Onboarding guiado em ate 30 minutos. Conectamos seu WhatsApp, importamos ${audiencePlural} se voce ja tiver base, configuramos agenda e cobranca. Voce revisa o tom da IA e libera.`,
    },
  ];

  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <div style={{ marginBottom: 18 }}>
        <EyebrowDash>Perguntas frequentes</EyebrowDash>
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-poppins)',
          fontWeight: 700,
          fontSize: 'clamp(26px, 3.5vw, 36px)',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: BRAND_COLORS.navy,
          margin: 0,
          maxWidth: '22ch',
        }}
      >
        Duvidas comuns,{' '}
        <span style={{ color: BRAND_COLORS.gold }}>respondidas</span>.
      </h2>

      <div
        style={{
          marginTop: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxWidth: 760,
        }}
      >
        {faqs.map((faq) => (
          <details
            key={faq.q}
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
                fontSize: 15,
                color: BRAND_COLORS.navy,
                cursor: 'pointer',
                listStyle: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span>{faq.q}</span>
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
                marginTop: 12,
                marginBottom: 0,
              }}
            >
              {faq.a}
            </p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

function FinalCTA({ especialidadeLower }: { especialidadeLower: string }) {
  return (
    <SectionShell background={BRAND_COLORS.navy} paddingY={104}>
      <div style={{ textAlign: 'center', color: BRAND_COLORS.sand }}>
        <div style={{ marginBottom: 18 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Proximo passo</EyebrowDash>
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
            maxWidth: '24ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Pronto pra ter uma{' '}
          <span style={{ color: BRAND_COLORS.gold }}>secretaria IA</span> no seu
          consultorio de {especialidadeLower}?
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 15,
            color: 'rgba(244, 239, 230, 0.7)',
            marginTop: 20,
          }}
        >
          Comece gratis. Sem cartao, sem fidelidade.
        </p>
        <div style={{ marginTop: 28 }}>
          <CTAGoldPill href="/v3/onboarding" label="Comecar gratis" size="lg" />
        </div>
      </div>
    </SectionShell>
  );
}
