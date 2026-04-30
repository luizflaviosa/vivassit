'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { PhoneMockup } from './PhoneMockup';

export function V2Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const phoneY = useTransform(scrollYProgress, [0, 1], ['0%', '-18%']);
  const phoneScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);

  return (
    <section
      id="hero"
      ref={ref}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        textAlign: 'center',
        paddingTop: 'clamp(7rem, 10vw, 11rem)',
        paddingBottom: 'clamp(3rem, 5vw, 5rem)',
        overflow: 'hidden',
      }}
    >
      {/* Atmosfera multicamada */}
      <Atmosphere />

      <div
        className="v2-container"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(1.5rem, 3vw, 2.5rem)',
        }}
      >
        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 9999,
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#52525b',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
            }}
          />
          IA conversacional ao vivo
          <span style={{ color: '#d4d4d8' }}>·</span>
          <span style={{ color: '#71717a' }}>+5.247 profissionais</span>
        </motion.div>

        <motion.h1
          className="v2-h1"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{ maxWidth: '14ch' }}
        >
          Seu consultório,
          <br />
          <span className="v2-italic">no piloto automático.</span>
        </motion.h1>

        <motion.p
          className="v2-lead"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
          style={{ maxWidth: '46ch' }}
        >
          Para dentistas, médicos, psicólogos, fisios, nutris e mais.
          Uma IA atende no WhatsApp, agenda, organiza pagamentos e mantém
          seu CRM em dia. Quando o caso pede toque humano, uma assistente real assume.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.34 }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <a href="/onboarding" className="v2-btn-primary">
            Começar grátis
            <ArrowRight size={16} />
          </a>
          <a href="#highlights" className="v2-btn-link">
            Ver funcionalidades →
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{
            display: 'flex',
            gap: '1.5rem',
            fontSize: '0.8125rem',
            color: '#71717a',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Pill>7 dias grátis</Pill>
          <Pill>Sem cartão</Pill>
          <Pill>Cancele quando quiser</Pill>
        </motion.div>

        {/* Phone mockup com parallax */}
        <motion.div
          initial={{ opacity: 0, y: 80, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          style={{
            y: phoneY,
            scale: phoneScale,
            perspective: 1200,
            marginTop: 'clamp(1.5rem, 3vw, 3rem)',
            position: 'relative',
          }}
        >
          {/* Glow violeta atrás do phone */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '-15% -25%',
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(110,86,207,0.35), rgba(110,86,207,0) 70%)',
              filter: 'blur(40px)',
              zIndex: -1,
              pointerEvents: 'none',
            }}
          />
          <div style={{ transform: 'rotateX(2deg)', transformStyle: 'preserve-3d' }}>
            <PhoneMockup scale={1} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Check size={14} strokeWidth={2.5} color="#16a34a" />
      {children}
    </span>
  );
}

function Atmosphere() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Glow violeta principal */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(110,86,207,0.18), rgba(110,86,207,0) 60%)',
          filter: 'blur(40px)',
        }}
      />
      {/* Glow rosa secundário */}
      <div
        style={{
          position: 'absolute',
          top: 360,
          right: '-10%',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(244,114,182,0.10), rgba(244,114,182,0) 60%)',
          filter: 'blur(40px)',
        }}
      />
      {/* Dot grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.35,
          backgroundImage: 'radial-gradient(circle, rgba(10,10,10,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, #000 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, #000 30%, transparent 100%)',
        }}
      />
    </div>
  );
}
