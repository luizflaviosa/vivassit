// /v3/empresa — pagina formal Apple-compliant no brand Luxury Modular.
// Razao social, CNPJ, endereco, contato, produtos, compliance LGPD.

import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandHeader } from '../_components/BrandHeader';
import { BrandFooter } from '../_components/BrandFooter';
import { SectionShell } from '../_components/SectionShell';
import { EyebrowDash } from '../_components/EyebrowDash';
import { Logo3Squares } from '../_components/Logo3Squares';
import { BRAND_COLORS, BRAND_LEGAL } from '../_components/tokens';

export const metadata: Metadata = {
  title: 'A Singulare · Empresa, contato e razao social',
  description:
    'Singulare e uma plataforma SaaS B2B que automatiza o atendimento de clinicas medicas brasileiras via WhatsApp e inteligencia artificial. Marca operada por MEDICAL SAO PAULO SERVICOS MEDICOS LTDA (CNPJ 20.247.908/0001-01).',
};

const LEGAL_DETAIL = {
  ...BRAND_LEGAL,
  inscricaoMunicipal: '173294',
  endereco: {
    logradouro: 'Rua Capitao Cassiano Ricardo de Toledo',
    numero: '191',
    complemento: 'Sala 306',
    bairro: 'Chacara Urbana',
    cidade: BRAND_LEGAL.cidade,
    uf: BRAND_LEGAL.uf,
    cep: '13201-840',
    pais: 'Brasil',
  },
  emailLegal: 'paulafranzon@yahoo.com.br',
  fundadoEm: '2014',
};

export default function V3EmpresaPage() {
  return (
    <>
      <BrandHeader />
      <Hero />
      <Sobre />
      <Produtos />
      <RazaoSocial />
      <Contato />
      <Compliance />
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
        <div style={{ marginBottom: 28 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Empresa</EyebrowDash>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(34px, 5.5vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: BRAND_COLORS.sand,
            margin: 0,
            maxWidth: '20ch',
          }}
        >
          Automatizamos o{' '}
          <span style={{ color: BRAND_COLORS.gold }}>consultorio brasileiro</span>{' '}
          — do WhatsApp ao acompanhamento clinico.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 17,
            lineHeight: 1.65,
            color: 'rgba(244, 239, 230, 0.72)',
            marginTop: 28,
            maxWidth: '60ch',
          }}
        >
          Plataforma SaaS B2B desenvolvida pra clinicas medicas. Atendimento por
          agente de IA, agenda integrada, gestao de pagamentos e monitoramento de
          sinais vitais — numa unica operacao, com infraestrutura nacional e em
          conformidade com a LGPD.
        </p>

        <dl
          style={{
            marginTop: 64,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 32,
            paddingTop: 36,
            borderTop: `1px solid rgba(255, 198, 47, 0.2)`,
          }}
        >
          {[
            { label: 'Sede', value: `${LEGAL_DETAIL.endereco.cidade} · ${LEGAL_DETAIL.endereco.uf}` },
            { label: 'Fundada em', value: LEGAL_DETAIL.fundadoEm },
            { label: 'Setor', value: 'Saude · SaaS' },
            { label: 'Atuacao', value: 'Brasil' },
          ].map((stat) => (
            <div key={stat.label}>
              <dt
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: BRAND_COLORS.gold,
                  marginBottom: 12,
                }}
              >
                {stat.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 18,
                  color: BRAND_COLORS.sand,
                  letterSpacing: '-0.01em',
                }}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Sobre() {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <Eyebrow>Sobre</Eyebrow>
      <SectionTitle>O que fazemos</SectionTitle>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 48,
          marginTop: 48,
        }}
        className="v3-empresa-sobre-grid"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 16,
            lineHeight: 1.65,
            color: 'rgba(15, 27, 51, 0.75)',
          }}
        >
          <p>
            A Singulare e uma plataforma SaaS multi-tenant pra o mercado
            brasileiro de saude. Construimos ferramentas que reduzem a carga
            operacional de medicos, dentistas, psicologos, fisioterapeutas e
            nutricionistas — devolvendo horas clinicas que hoje se perdem em
            agenda, lembrete, cobranca e organizacao administrativa.
          </p>
          <p>
            Nosso nucleo e um agente de inteligencia artificial que conversa com
            pacientes diretamente no WhatsApp, agenda consultas, confirma
            comparecimento, dispara cobrancas via Pix e mantem o historico
            sincronizado com o painel da clinica. O agente e treinado com regras
            clinicas customizadas por consultorio e operado sob supervisao
            humana via Chatwoot.
          </p>
          <p>
            Pra acompanhamento clinico continuo — especialmente em cardiologia
            preventiva — o Singulare Health integra dados de Apple Health e
            Health Connect ao prontuario, permitindo que o medico observe sinais
            vitais entre consultas.
          </p>
        </div>

        <aside
          style={{
            background: '#fff',
            border: `1px solid rgba(15, 27, 51, 0.1)`,
            borderRadius: 6,
            padding: 32,
            height: 'fit-content',
          }}
        >
          <p
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
            Em uma frase
          </p>
          <p
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 16,
              lineHeight: 1.55,
              color: BRAND_COLORS.navy,
              margin: 0,
            }}
          >
            Tornamos o consultorio autonomo em operacao, sem desumaniza-lo no
            atendimento.
          </p>
        </aside>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .v3-empresa-sobre-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </SectionShell>
  );
}

function Produtos() {
  const items = [
    {
      kicker: 'Plataforma web',
      name: 'Singulare Painel',
      desc: 'Agenda, prontuario, financeiro, CRM de pacientes e supervisao do agente IA. Multi-usuario, multi-clinica.',
    },
    {
      kicker: 'Agente IA',
      name: 'Singulare WhatsApp',
      desc: 'Atendimento conversacional 24/7 no WhatsApp. Agendamento, confirmacao, cobranca e suporte clinico basico.',
    },
    {
      kicker: 'App iOS',
      name: 'Singulare Health',
      desc: 'Aplicativo pra pacientes em programas de RPM. Coleta dados de Apple Health e transmite ao medico responsavel.',
    },
  ];

  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <Eyebrow>Produtos</Eyebrow>
      <SectionTitle>O que oferecemos</SectionTitle>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          background: 'rgba(15, 27, 51, 0.12)',
          border: `1px solid rgba(15, 27, 51, 0.12)`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {items.map((item) => (
          <div
            key={item.name}
            style={{
              background: '#fff',
              padding: 32,
            }}
          >
            <p
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
              {item.kicker}
            </p>
            <h3
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 22,
                color: BRAND_COLORS.navy,
                marginBottom: 12,
                letterSpacing: '-0.015em',
              }}
            >
              {item.name}
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
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function RazaoSocial() {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <Eyebrow>Razao social</Eyebrow>
      <SectionTitle>Quem opera a Singulare</SectionTitle>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 48,
        }}
        className="v3-empresa-razao-grid"
      >
        <div
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 16,
            lineHeight: 1.65,
            color: 'rgba(15, 27, 51, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <p>
            <strong style={{ color: BRAND_COLORS.navy, fontWeight: 700 }}>
              Singulare
            </strong>{' '}
            e uma marca operada por{' '}
            <strong style={{ color: BRAND_COLORS.navy, fontWeight: 700 }}>
              {LEGAL_DETAIL.razaoSocial}
            </strong>
            , pessoa juridica de direito privado, regularmente inscrita no CNPJ
            sob o nº{' '}
            <strong style={{ color: BRAND_COLORS.navy, fontWeight: 700 }}>
              {LEGAL_DETAIL.cnpj}
            </strong>
            , com sede em {LEGAL_DETAIL.endereco.cidade} ({LEGAL_DETAIL.endereco.uf}).
          </p>
          <p>
            Toda relacao contratual, faturamento e responsabilidade tecnica por
            dados de saude (LGPD, Lei 13.709/2018) e assumida pela referida
            pessoa juridica. Apple App Store, Google Play, gateways de pagamento
            e demais terceiros institucionais identificam a empresa pela razao
            social acima.
          </p>
        </div>

        <div
          style={{
            background: '#fff',
            border: `1px solid rgba(15, 27, 51, 0.1)`,
            borderRadius: 6,
            padding: 32,
            height: 'fit-content',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-poppins)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: BRAND_COLORS.gold,
              marginBottom: 18,
            }}
          >
            Dados cadastrais
          </p>
          <dl
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              margin: 0,
            }}
          >
            <Field label="Razao social" value={LEGAL_DETAIL.razaoSocial} />
            <Field label="CNPJ" value={LEGAL_DETAIL.cnpj} />
            <Field label="Inscricao municipal" value={LEGAL_DETAIL.inscricaoMunicipal} />
            <Field
              label="Sede"
              value={`${LEGAL_DETAIL.endereco.cidade} · ${LEGAL_DETAIL.endereco.uf} · ${LEGAL_DETAIL.endereco.pais}`}
            />
          </dl>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .v3-empresa-razao-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </SectionShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(15, 27, 51, 0.08)',
      }}
    >
      <dt
        style={{
          fontFamily: 'var(--font-space-grotesk)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(15, 27, 51, 0.55)',
          fontWeight: 500,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontFamily: 'var(--font-space-grotesk)',
          fontSize: 14,
          color: BRAND_COLORS.navy,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function Contato() {
  const e = LEGAL_DETAIL.endereco;
  const enderecoCompleto = `${e.logradouro}, ${e.numero}, ${e.complemento} — ${e.bairro}, ${e.cidade} · ${e.uf} · CEP ${e.cep} · ${e.pais}`;
  const cards = [
    {
      label: 'Endereco da sede',
      value: enderecoCompleto,
      href: `https://maps.google.com/?q=${encodeURIComponent(enderecoCompleto)}`,
      hrefLabel: 'Abrir no Google Maps',
    },
    {
      label: 'Telefone',
      value: LEGAL_DETAIL.telefone,
      href: `tel:+55${LEGAL_DETAIL.telefone.replace(/\D/g, '')}`,
      hrefLabel: 'Ligar',
    },
    {
      label: 'Email comercial',
      value: LEGAL_DETAIL.email,
      href: `mailto:${LEGAL_DETAIL.email}`,
      hrefLabel: 'Enviar mensagem',
    },
    {
      label: 'Email responsavel legal',
      value: LEGAL_DETAIL.emailLegal,
      href: `mailto:${LEGAL_DETAIL.emailLegal}`,
      hrefLabel: 'Enviar mensagem',
    },
    {
      label: 'Suporte clinicas',
      value: 'Via painel da plataforma',
      href: '/painel',
      hrefLabel: 'Acessar painel',
    },
    {
      label: 'Imprensa',
      value: LEGAL_DETAIL.email,
      href: `mailto:${LEGAL_DETAIL.email}?subject=Imprensa`,
      hrefLabel: 'Solicitar pauta',
    },
  ];

  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <Eyebrow>Contato</Eyebrow>
      <SectionTitle>Como falar com a Singulare</SectionTitle>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: '#fff',
              border: `1px solid rgba(15, 27, 51, 0.1)`,
              borderRadius: 6,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 18,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-poppins)',
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: BRAND_COLORS.gold,
                  marginBottom: 10,
                }}
              >
                {card.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-space-grotesk)',
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: BRAND_COLORS.navy,
                  margin: 0,
                }}
              >
                {card.value}
              </p>
            </div>
            <a
              href={card.href}
              style={{
                fontFamily: 'var(--font-poppins)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: BRAND_COLORS.navy,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {card.hrefLabel} <span aria-hidden>→</span>
            </a>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function Compliance() {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <Eyebrow>Compliance</Eyebrow>
      <SectionTitle>Como tratamos dados de saude</SectionTitle>

      <div
        style={{
          marginTop: 48,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 48,
        }}
        className="v3-empresa-compliance-grid"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 16,
            lineHeight: 1.65,
            color: 'rgba(15, 27, 51, 0.75)',
          }}
        >
          <p>
            A Singulare processa dados pessoais e dados pessoais sensiveis de
            saude com base na Lei nº 13.709/2018 (LGPD) e em sintonia com a
            Resolucao CFM nº 2.314/2022. Atuamos como operador ou controlador
            conjunto, conforme o contexto, mantendo contratos de tratamento de
            dados com os profissionais clientes.
          </p>
          <p>
            Aplicativos da familia Singulare em App Store e Google Play seguem
            as politicas dessas lojas — em especial os requisitos de HealthKit,
            Health Connect e transparencia de uso de dados.
          </p>
          <p>
            O usuario pode, a qualquer momento, revogar o consentimento,
            solicitar acesso aos seus dados ou requerer eliminacao completa por
            meio do{' '}
            <a
              href={`mailto:${LEGAL_DETAIL.email}`}
              style={{
                color: BRAND_COLORS.navy,
                fontWeight: 700,
              }}
            >
              {LEGAL_DETAIL.email}
            </a>
            .
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {[
            {
              href: '/privacidade',
              title: 'Politica de Privacidade',
              desc: 'Como coletamos, tratamos e armazenamos dados pessoais.',
            },
            {
              href: '/termos',
              title: 'Termos de Uso',
              desc: 'Condicoes contratuais para clinicas e profissionais.',
            },
            {
              href: '/privacidade#saude',
              title: 'Politica especifica — Singulare Health',
              desc: 'Tratamento de dados clinicos via Apple Health e Health Connect.',
            },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                background: '#fff',
                border: `1px solid rgba(15, 27, 51, 0.1)`,
                borderRadius: 6,
                padding: 20,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 18,
                textDecoration: 'none',
                color: BRAND_COLORS.navy,
              }}
            >
              <div>
                <h4
                  style={{
                    fontFamily: 'var(--font-poppins)',
                    fontWeight: 700,
                    fontSize: 14,
                    color: BRAND_COLORS.navy,
                    margin: 0,
                  }}
                >
                  {link.title}
                </h4>
                <p
                  style={{
                    fontFamily: 'var(--font-space-grotesk)',
                    fontSize: 13,
                    color: 'rgba(15, 27, 51, 0.65)',
                    margin: '6px 0 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  {link.desc}
                </p>
              </div>
              <span aria-hidden style={{ color: BRAND_COLORS.gold }}>
                →
              </span>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .v3-empresa-compliance-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </SectionShell>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <EyebrowDash>{children}</EyebrowDash>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-poppins)',
        fontWeight: 700,
        fontSize: 'clamp(30px, 4vw, 44px)',
        lineHeight: 1.1,
        letterSpacing: '-0.025em',
        color: BRAND_COLORS.navy,
        margin: 0,
        maxWidth: '22ch',
      }}
    >
      {children}
    </h2>
  );
}
