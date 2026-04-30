'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const AIOrb = dynamic(() => import('./AIOrb').then((m) => m.AIOrb), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: 280,
        height: 280,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 35% 35%, #b39dff, #6E56CF 50%, #4A3399 100%)',
        boxShadow: '0 0 80px rgba(110,86,207,0.5)',
        margin: '0 auto',
      }}
    />
  ),
});

const STATS = [
  { value: 5247, suffix: '+', label: 'Profissionais ativos' },
  { value: 60, suffix: '%', label: 'Menos faltas' },
  { value: 4.9, suffix: '★', label: 'Avaliação média', decimals: 1 },
  { value: 24, suffix: 'h/dia', label: 'Atendimento ininterrupto' },
];

const COMPARISON = [
  { label: 'Tempo de resposta', traditional: 22, singulare: 95, unitT: 'min', unitV: 's' },
  { label: 'Mensagens/hora', traditional: 18, singulare: 240 },
  { label: 'Taxa de no-show', traditional: 28, singulare: 8, unit: '%' },
  { label: 'Disponibilidade', traditional: 8, singulare: 24, unit: 'h/dia' },
];

export function V2Performance() {
  return (
    <section
      id="performance"
      className="v2-section v2-dark"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Glow violeta dramático */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '80%',
          background:
            'radial-gradient(ellipse at center, rgba(110,86,207,0.35), rgba(110,86,207,0) 60%)',
          pointerEvents: 'none',
        }}
      />

      <div className="v2-container" style={{ position: 'relative' }}>
        {/* Chip-style hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '1.5rem',
            marginBottom: 'clamp(3rem, 5vw, 5rem)',
          }}
        >
          <AIOrb size={280} />
          <span className="v2-eyebrow">IA Singulare</span>
          <h2 className="v2-display" style={{ maxWidth: '18ch' }}>
            IA que entende seus pacientes.
            <br />
            <span style={{ color: '#a1a1a6' }}>E faz a clínica voar.</span>
          </h2>
          <p className="v2-lead" style={{ maxWidth: '50ch' }}>
            Treinada em milhões de conversas reais de saúde. Reconhece intenção, contexto e
            emoção. Quando o caso pede, escala pra um humano em 1 segundo.
          </p>
        </motion.div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '2rem',
            marginBottom: 'clamp(3rem, 6vw, 6rem)',
            paddingBlock: 'clamp(2rem, 4vw, 4rem)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {STATS.map((s, i) => (
            <StatCard key={i} {...s} delay={i * 0.1} />
          ))}
        </div>

        {/* Comparison bars */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 className="v2-h2" style={{ marginBottom: '2.5rem', maxWidth: '20ch' }}>
            Singulare vs secretária tradicional.
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {COMPARISON.map((c, i) => (
              <ComparisonRow key={i} {...c} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ChipBadge() {
  return (
    <motion.div
      whileHover={{ rotateY: 8, rotateX: -4 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: 140,
        height: 140,
        borderRadius: 28,
        background: 'linear-gradient(135deg, #6E56CF 0%, #4A3399 50%, #1d1d1f 100%)',
        boxShadow:
          '0 0 80px rgba(110,86,207,0.5), inset 0 1px 0 rgba(255,255,255,0.2), 0 20px 40px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transformStyle: 'preserve-3d',
        perspective: 1200,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 8,
          borderRadius: 22,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      />
      <span
        style={{
          fontSize: 38,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.04em',
          textShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}
      >
        IA
      </span>
    </motion.div>
  );
}

function StatCard({
  value,
  suffix,
  label,
  decimals = 0,
  delay,
}: {
  value: number;
  suffix?: string;
  label: string;
  decimals?: number;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
      style={{ textAlign: 'left' }}
    >
      <div
        style={{
          fontSize: 'clamp(2.5rem, 1.5rem + 3vw, 4rem)',
          fontWeight: 700,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginBottom: '0.5rem',
          background: 'linear-gradient(180deg, #fff 0%, #b39dff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {decimals === 0 ? Math.round(count).toLocaleString('pt-BR') : count.toFixed(decimals)}
        {suffix}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#a1a1a6', fontWeight: 500 }}>{label}</div>
    </motion.div>
  );
}

function ComparisonRow({
  label,
  traditional,
  singulare,
  unit,
  unitT,
  unitV,
}: any) {
  const max = Math.max(traditional, singulare);
  return (
    <div>
      <div
        style={{
          fontSize: '0.875rem',
          color: '#a1a1a6',
          marginBottom: '0.75rem',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <Bar
          label="Tradicional"
          value={traditional}
          unit={unitT || unit}
          width={(traditional / max) * 100}
          color="rgba(255,255,255,0.18)"
          textColor="#a1a1a6"
        />
        <Bar
          label="Singulare"
          value={singulare}
          unit={unitV || unit}
          width={(singulare / max) * 100}
          color="linear-gradient(90deg, #6E56CF, #b39dff)"
          textColor="#fff"
          glow
        />
      </div>
    </div>
  );
}

function Bar({ label, value, unit, width, color, textColor, glow }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ width: 90, fontSize: '0.8125rem', color: textColor, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '100%',
            background: color,
            boxShadow: glow ? '0 0 24px rgba(110,86,207,0.5)' : 'none',
            borderRadius: 8,
          }}
        />
      </div>
      <div
        style={{
          minWidth: 80,
          textAlign: 'right',
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: textColor,
        }}
      >
        {value}
        {unit ? <span style={{ fontSize: '0.75rem', marginLeft: 4, opacity: 0.7 }}>{unit}</span> : null}
      </div>
    </div>
  );
}
