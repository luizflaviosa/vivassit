// /v3/bem-vindo — Q&A com as 12 duvidas mais comuns. Layout 2 colunas em
// desktop (intro + accordion), accordion full em mobile.

import type { Metadata } from 'next';
import { BrandHeader } from '../_components/BrandHeader';
import { BrandFooter } from '../_components/BrandFooter';
import { SectionShell } from '../_components/SectionShell';
import { EyebrowDash } from '../_components/EyebrowDash';
import { CTAGoldPill } from '../_components/CTAGoldPill';
import { BRAND_COLORS } from '../_components/tokens';

export const metadata: Metadata = {
  title: 'Como funciona · Singulare',
  description:
    'As 12 perguntas mais comuns sobre a Singulare. Como a IA atende, como pausar, cobranca, LGPD, suporte e mais.',
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Como pausar a IA num atendimento que quero assumir?',
    a: 'No painel de conversas (Chatwoot), abra a conversa e clique em "Atribuir a mim". A IA pausa automaticamente quando voce entra. Pra retomar, basta sair da conversa ou marcar como resolvida.',
  },
  {
    q: 'Como ver o historico de conversa de um paciente?',
    a: 'No painel, va em Pacientes, busque pelo nome ou telefone e clique no card. O historico completo aparece na lateral direita, com mensagens e agendamentos anteriores.',
  },
  {
    q: 'Posso alterar o tom/jeito que a IA fala?',
    a: 'Sim. Em Configuracoes → Assistente IA voce edita o prompt base e adiciona instrucoes especificas. Alteracoes entram em vigor na proxima mensagem recebida.',
  },
  {
    q: 'E se a IA agendar errado?',
    a: 'Se houve confusao, va ate a agenda no painel, edite o horario ou cancele. A IA notifica o paciente automaticamente. Se virar padrao, ajuste as regras no prompt — ou nos avise pra investigar.',
  },
  {
    q: 'Como ajusto meus horarios de atendimento?',
    a: 'Va em Configuracoes → Agenda. Voce define dias da semana, horarios de inicio e fim, duracao da consulta e intervalos. A IA passa a respeitar isso na hora de oferecer encaixes.',
  },
  {
    q: 'Como funciona a cobranca via WhatsApp?',
    a: 'Quando a consulta e confirmada, a IA gera um link Asaas (Pix, cartao ou boleto) e envia automaticamente. Voce escolhe se cobra antes ou depois da consulta — e pode pedir so uma porcentagem como reserva.',
  },
  {
    q: 'E se o paciente quiser cancelar a consulta?',
    a: 'O proprio paciente avisa pelo WhatsApp. A IA confirma o cancelamento, libera o horario na agenda e avisa voce. Se a cobranca foi feita antes, a politica de reembolso e a que voce definiu.',
  },
  {
    q: 'A IA atende fora do horario?',
    a: 'Sim. A IA esta ativa 24/7 pra agendar, responder duvidas operacionais e enviar lembretes. Fora do seu horario comercial, ela oferece encaixes so dentro dos dias e horarios configurados.',
  },
  {
    q: 'Como pedir suporte humano da Singulare?',
    a: 'Responde no WhatsApp (11) 98939-0155 — nosso time responde de seg a sex, 9h as 18h. Pra urgencias fora do horario, deixe mensagem que retornamos rapido.',
  },
  {
    q: 'Como cancelar minha assinatura?',
    a: 'Em Configuracoes → Assinatura, no painel, tem o botao de cancelar. Voce mantem o acesso ate o fim do ciclo ja pago, e os dados ficam guardados por 90 dias caso queira voltar.',
  },
  {
    q: 'Meus dados estao seguros? (LGPD)',
    a: 'Sim. Estamos em conformidade com a LGPD: dados sao criptografados, armazenados no Brasil (Supabase) e nunca compartilhados sem autorizacao. Voce e o controlador dos dados dos seus pacientes.',
  },
  {
    q: 'A IA pode dar diagnostico medico?',
    a: 'Nao. A IA nunca da diagnosticos, prescreve medicamentos ou interpreta exames. Se o paciente pedir, ela orienta a buscar avaliacao profissional e oferece um agendamento com voce.',
  },
];

export default function V3BemVindoPage() {
  return (
    <>
      <BrandHeader />
      <Hero />
      <FaqSection />
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
        paddingBottom: 80,
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
          <EyebrowDash color={BRAND_COLORS.gold}>Como funciona</EyebrowDash>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-poppins)',
            fontWeight: 700,
            fontSize: 'clamp(34px, 6vw, 64px)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: BRAND_COLORS.sand,
            margin: 0,
            maxWidth: '20ch',
          }}
        >
          Tudo que voce precisa saber{' '}
          <span style={{ color: BRAND_COLORS.gold }}>pra comecar</span>.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-space-grotesk)',
            fontSize: 17,
            lineHeight: 1.65,
            color: 'rgba(244, 239, 230, 0.72)',
            marginTop: 24,
            maxWidth: '60ch',
          }}
        >
          As duvidas mais comuns sobre a Singulare — como a IA atende, como
          pausar uma conversa, como funciona a cobranca, LGPD, suporte e mais.
        </p>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <SectionShell background={BRAND_COLORS.sand} paddingY={104}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
          gap: 56,
        }}
        className="v3-bem-vindo-grid"
      >
        <div>
          <div style={{ marginBottom: 18 }}>
            <EyebrowDash>Q&amp;A</EyebrowDash>
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-poppins)',
              fontWeight: 700,
              fontSize: 'clamp(28px, 3.5vw, 40px)',
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              color: BRAND_COLORS.navy,
              margin: 0,
              maxWidth: '14ch',
            }}
          >
            12 situacoes que aparecem todo dia.
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-space-grotesk)',
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(15, 27, 51, 0.6)',
              marginTop: 18,
              maxWidth: '34ch',
            }}
          >
            Toque em qualquer pergunta pra abrir a resposta. Algo nao
            respondido? Manda no WhatsApp do suporte.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {FAQS.map((faq) => (
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
                <span style={{ flex: 1 }}>{faq.q}</span>
                <span
                  aria-hidden
                  style={{
                    fontFamily: 'var(--font-poppins)',
                    fontWeight: 400,
                    fontSize: 22,
                    color: BRAND_COLORS.gold,
                    lineHeight: 1,
                    flexShrink: 0,
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
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .v3-bem-vindo-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </SectionShell>
  );
}

function FinalCTA() {
  return (
    <SectionShell background={BRAND_COLORS.navy} paddingY={96}>
      <div
        style={{
          textAlign: 'center',
          color: BRAND_COLORS.sand,
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <EyebrowDash color={BRAND_COLORS.gold}>Pronto pra comecar</EyebrowDash>
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
          Onboarding em ate{' '}
          <span style={{ color: BRAND_COLORS.gold }}>30 minutos</span>.
        </h2>
        <div style={{ marginTop: 32 }}>
          <CTAGoldPill href="/v3/onboarding" label="Comecar gratis" size="lg" />
        </div>
      </div>
    </SectionShell>
  );
}
