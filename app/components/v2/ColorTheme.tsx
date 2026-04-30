'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const THEMES = [
  {
    name: 'Violeta',
    color: '#6E56CF',
    bgFrom: '#fafaf7',
    bgTo: '#f0ebff',
    target: 'Psicologia & Terapia',
    desc: 'Calmo, acolhedor, profundo.',
  },
  {
    name: 'Carbono',
    color: '#1d1d1f',
    bgFrom: '#fafaf7',
    bgTo: '#e5e5e7',
    target: 'Clínicas Premium',
    desc: 'Minimalista, técnico, autoritário.',
  },
  {
    name: 'Coral',
    color: '#ff6b6b',
    bgFrom: '#fafaf7',
    bgTo: '#fff0ed',
    target: 'Nutrição & Wellness',
    desc: 'Vibrante, energético, fresco.',
  },
  {
    name: 'Floresta',
    color: '#3a8a5e',
    bgFrom: '#fafaf7',
    bgTo: '#ecfdf5',
    target: 'Fisio & Integrativas',
    desc: 'Natural, equilibrado, vital.',
  },
];

export function V2ColorTheme() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Mapeia 0-1 do scroll → tema 0-3
  const themeIndex = useTransform(scrollYProgress, [0.15, 0.4, 0.6, 0.85], [0, 1, 2, 3]);

  // Cores interpoladas
  const bgColor = useTransform(
    scrollYProgress,
    [0.15, 0.4, 0.6, 0.85],
    [THEMES[0].bgTo, THEMES[1].bgTo, THEMES[2].bgTo, THEMES[3].bgTo]
  );
  const accentColor = useTransform(
    scrollYProgress,
    [0.15, 0.4, 0.6, 0.85],
    [THEMES[0].color, THEMES[1].color, THEMES[2].color, THEMES[3].color]
  );

  return (
    <motion.section
      ref={ref}
      style={{
        background: bgColor,
        position: 'relative',
        padding: 'var(--v2-section-py) 0',
        transition: 'background 600ms cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}
    >
      <div className="v2-container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '0.875rem',
            marginBottom: 'clamp(3rem, 5vw, 5rem)',
          }}
        >
          <span className="v2-eyebrow">Identidade da sua clínica</span>
          <h2 className="v2-display" style={{ maxWidth: '20ch' }}>
            Quatro temas. Uma marca.{' '}
            <span className="v2-italic">A sua.</span>
          </h2>
          <p className="v2-lead" style={{ maxWidth: '50ch' }}>
            O Singulare se adapta à identidade da sua especialidade. Role pra ver os 4 temas
            disponíveis pro painel + mensagens automatizadas.
          </p>
        </motion.div>

        {/* Sticky orb que muda de cor */}
        <div
          style={{
            position: 'sticky',
            top: 80,
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '4rem',
            zIndex: 1,
          }}
        >
          <motion.div
            style={{
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: accentColor,
              boxShadow: '0 30px 80px rgba(0,0,0,0.15)',
              filter: 'saturate(1.2)',
            }}
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        {/* Grid de temas — desce conforme scroll */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(8rem, 15vw, 14rem)',
            paddingBottom: '4rem',
          }}
        >
          {THEMES.map((theme, i) => (
            <ThemeBlock key={theme.name} theme={theme} index={i} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function ThemeBlock({ theme, index }: { theme: (typeof THEMES)[0]; index: number }) {
  const isEven = index % 2 === 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-200px' }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: isEven ? 'row' : 'row-reverse',
        alignItems: 'center',
        gap: '3rem',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {/* Texto */}
      <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: theme.color,
              boxShadow: `0 0 12px ${theme.color}66`,
            }}
          />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: theme.color,
            }}
          >
            {theme.name}
          </span>
        </div>
        <h3 className="v2-h2" style={{ maxWidth: '14ch' }}>
          {theme.target}.{' '}
          <span className="v2-italic" style={{ fontSize: '0.9em' }}>
            {theme.desc}
          </span>
        </h3>
      </div>

      {/* Card preview do tema */}
      <div style={{ flex: '1 1 320px', display: 'flex', justifyContent: 'center' }}>
        <ThemePreviewCard theme={theme} />
      </div>
    </motion.div>
  );
}

function ThemePreviewCard({ theme }: { theme: (typeof THEMES)[0] }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '1.25rem',
        width: '100%',
        maxWidth: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        border: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header com avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.color}, ${theme.color}dd)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          S
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Clínica Singulare</div>
          <div style={{ fontSize: 11, color: '#71717a' }}>online</div>
        </div>
      </div>

      {/* Mensagem com accent do tema */}
      <div
        style={{
          background: '#DCF8C6',
          padding: '8px 12px',
          borderRadius: 12,
          borderTopLeftRadius: 4,
          fontSize: 13,
          color: '#1d1d1f',
          borderLeft: `3px solid ${theme.color}`,
        }}
      >
        Confirmado ✓ Consulta agendada
      </div>

      {/* Mini metric */}
      <div
        style={{
          display: 'flex',
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            background: `${theme.color}10`,
            border: `1px solid ${theme.color}30`,
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Receita
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: theme.color, letterSpacing: '-0.02em' }}>
            R$ 2.240
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: '#fafaf7',
            border: '1px solid rgba(0,0,0,0.05)',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Hoje
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#18181b', letterSpacing: '-0.02em' }}>
            8 consultas
          </div>
        </div>
      </div>

      {/* Botão CTA */}
      <button
        style={{
          background: theme.color,
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: `0 4px 12px ${theme.color}40`,
        }}
      >
        Confirmar consulta
      </button>
    </div>
  );
}
