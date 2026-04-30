'use client';

import { motion } from 'framer-motion';
import {
  MessageCircle,
  FileSearch,
  Mic,
  UserCheck,
  CalendarCheck,
  Receipt,
} from 'lucide-react';

// 5 diferenciais REAIS do Singulare — direto do workflow N8N e arquitetura
const HIGHLIGHTS = [
  {
    icon: MessageCircle,
    eyebrow: 'WhatsApp real',
    title: 'Não é chatbot.',
    italic: 'É WhatsApp de verdade.',
    description:
      'Roda em cima do WhatsApp do seu paciente — não API oficial. Conversa indistinguível de humano. Sem balão "Mensagem automática".',
    span: 'large',
    visual: 'whatsapp',
  },
  {
    icon: FileSearch,
    eyebrow: 'Análise por IA',
    title: 'Lê os exames.',
    italic: 'E manda pro médico.',
    description:
      'Paciente envia PDF de hemograma. Um sub-agente especialista lê, gera laudo estruturado e arquiva no prontuário.',
    visual: 'exam',
  },
  {
    icon: Mic,
    eyebrow: 'Voz humana',
    title: 'Responde em áudio.',
    italic: 'Em português perfeito.',
    description:
      'Áudio chega → transcrição → resposta sintetizada com voz humana (ElevenLabs). Mantém o ritmo da conversa.',
    visual: 'voice',
  },
  {
    icon: UserCheck,
    eyebrow: 'Agente off automático',
    title: 'Você responde,',
    italic: 'a IA recua sozinha.',
    description:
      'Quando você (ou sua secretária) digita uma mensagem, a IA detecta na hora e marca a conversa como agente-off. Zero conflito.',
  },
  {
    icon: CalendarCheck,
    eyebrow: 'Confirmação D-1',
    title: 'Confirma no dia anterior.',
    italic: 'Você nem precisa pedir.',
    description:
      'Cron diário lista a agenda de amanhã, dispara mensagem de confirmação no WhatsApp e atualiza o status. Faltas caem 60%.',
  },
  {
    icon: Receipt,
    eyebrow: 'Fiscal automatizado',
    title: 'NFS-e no Pix confirmado.',
    italic: 'Sem você levantar um dedo.',
    description:
      'Asaas confirma pagamento → Singulare emite NFS-e → envia PDF pro paciente no mesmo chat. Tudo em <30 segundos.',
  },
];

export function V2Highlights() {
  return (
    <section
      id="highlights"
      style={{ padding: 'var(--v2-section-py) 0', position: 'relative' }}
    >
      <div className="v2-container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            marginBottom: 'clamp(3rem, 5vw, 5rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            maxWidth: 720,
          }}
        >
          <span className="v2-eyebrow">Diferenciais reais</span>
          <h2 className="v2-display">
            Não é mais um SaaS de agenda.{' '}
            <span className="v2-italic">É infraestrutura.</span>
          </h2>
          <p className="v2-lead" style={{ maxWidth: 580 }}>
            Construído desde o zero pra clínicas brasileiras. Cada peça resolve uma dor
            que você conhece — e que sistema genérico não resolve.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1 } },
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '1.25rem',
          }}
          className="v2-grid"
        >
          {HIGHLIGHTS.map((h, i) => {
            const isHero = i === 0;
            const isWide = i === 1;
            return (
              <HighlightCard
                key={i}
                {...h}
                style={{
                  gridColumn: isHero ? 'span 6' : isWide ? 'span 4' : 'span 2',
                }}
                wideClass={isHero ? 'v2-card-hero' : isWide ? 'v2-card-wide' : 'v2-card-narrow'}
              />
            );
          })}
        </motion.div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.v2-grid) {
            grid-template-columns: 1fr !important;
          }
          :global(.v2-grid > *) {
            grid-column: span 1 !important;
          }
        }
      `}</style>
    </section>
  );
}

function HighlightCard({
  icon: Icon,
  eyebrow,
  title,
  italic,
  description,
  visual,
  style,
  wideClass,
}: any) {
  const isHero = wideClass === 'v2-card-hero';
  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
      }}
      whileHover={{ y: -3, transition: { duration: 0.32 } }}
      style={{
        ...style,
        background: '#fff',
        borderRadius: 'var(--v2-radius-card)',
        padding: isHero ? 'clamp(2rem, 4vw, 3rem)' : 'clamp(1.5rem, 2vw, 1.875rem)',
        display: 'flex',
        flexDirection: isHero ? 'row' : 'column',
        gap: isHero ? '2.5rem' : '1.25rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)',
        border: '1px solid rgba(0,0,0,0.04)',
        position: 'relative',
        overflow: 'hidden',
        alignItems: isHero ? 'center' : 'flex-start',
        flexWrap: 'wrap' as const,
      }}
    >
      <div
        style={{
          flex: isHero ? '1 1 360px' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: 'var(--v2-accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--v2-accent)',
          }}
        >
          <Icon size={22} strokeWidth={1.75} />
        </div>

        <span className="v2-eyebrow" style={{ fontSize: '0.6875rem' }}>
          {eyebrow}
        </span>

        <h3 className={isHero ? 'v2-h2' : 'v2-h3'}>
          {title}
          <br />
          <span className="v2-italic" style={{ fontSize: '0.9em' }}>{italic}</span>
        </h3>

        <p
          className="v2-lead"
          style={{
            fontSize: isHero ? '1rem' : '0.9375rem',
            lineHeight: 1.55,
            maxWidth: isHero ? 480 : 'none',
          }}
        >
          {description}
        </p>
      </div>

      {visual === 'whatsapp' && isHero && <WhatsappVisual />}
      {visual === 'exam' && <ExamVisual />}
      {visual === 'voice' && <VoiceVisual />}
    </motion.article>
  );
}

function WhatsappVisual() {
  return (
    <div
      style={{
        flex: '1 1 320px',
        minHeight: 280,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#ECE5DD',
          borderRadius: 16,
          padding: '1rem',
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <FakeBubble side="in">Doutora atende segunda?</FakeBubble>
        <FakeBubble side="out">
          Olá! A Dra. Paula atende quinta e sexta. Quinta às 15h funciona?
        </FakeBubble>
        <FakeBubble side="in">Sim! 🙌</FakeBubble>
        <FakeBubble side="out" highlight>
          Confirmado ✓ Quinta às 15h. Pix enviado.
        </FakeBubble>
      </div>
    </div>
  );
}

function ExamVisual() {
  return (
    <div
      style={{
        marginTop: 'auto',
        background: '#fafaf7',
        border: '1px solid rgba(0,0,0,0.05)',
        borderRadius: 12,
        padding: '0.875rem',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        color: '#52525b',
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>Hemoglobina</span>
        <span style={{ color: '#16a34a', fontWeight: 600 }}>14.2 g/dL ✓</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>Glicemia</span>
        <span style={{ color: '#f59e0b', fontWeight: 600 }}>108 mg/dL ⚠</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>Colesterol</span>
        <span style={{ color: '#16a34a', fontWeight: 600 }}>180 mg/dL ✓</span>
      </div>
    </div>
  );
}

function VoiceVisual() {
  return (
    <div
      style={{
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0.875rem',
        background: 'linear-gradient(135deg, #DCF8C6, #c4ecaa)',
        borderRadius: 12,
        borderLeft: '3px solid #6E56CF',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#075E54',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M8 5v14l11-7z" fill="#fff" />
        </svg>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
        {[0.4, 0.7, 1, 0.85, 0.6, 0.9, 0.5, 0.75, 1, 0.55, 0.7, 0.4, 0.6, 0.9, 0.45].map(
          (h, i) => (
            <motion.div
              key={i}
              animate={{ scaleY: [h, h * 0.6, h] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.05, ease: 'easeInOut' }}
              style={{
                flex: 1,
                background: '#075E54',
                borderRadius: 1.5,
                height: '100%',
                transformOrigin: 'center',
              }}
            />
          )
        )}
      </div>
      <span style={{ fontSize: '0.75rem', color: '#075E54', fontWeight: 600 }}>0:14</span>
    </div>
  );
}

function FakeBubble({
  children,
  side,
  highlight,
}: {
  children: React.ReactNode;
  side: 'in' | 'out';
  highlight?: boolean;
}) {
  const isOut = side === 'out';
  return (
    <div
      style={{
        alignSelf: isOut ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        background: isOut ? '#DCF8C6' : '#fff',
        padding: '8px 12px',
        borderRadius: 12,
        borderTopRightRadius: isOut ? 4 : 12,
        borderTopLeftRadius: isOut ? 12 : 4,
        fontSize: 13,
        lineHeight: 1.4,
        color: '#1d1d1f',
        boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
        ...(highlight && { borderLeft: '3px solid #6E56CF' }),
      }}
    >
      {children}
    </div>
  );
}
