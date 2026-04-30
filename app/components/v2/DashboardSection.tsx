'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const DashboardMockup = dynamic(
  () => import('./DashboardMockup').then((m) => m.DashboardMockup),
  { ssr: false }
);

const RealDashboardMockup = dynamic(
  () => import('./RealDashboardMockup').then((m) => m.RealDashboardMockup),
  { ssr: false }
);

function useRealScreenshotAvailable(src: string) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    fetch(src, { method: 'HEAD' })
      .then((r) => setAvailable(r.ok))
      .catch(() => setAvailable(false));
  }, [src]);
  return available;
}

function DashboardSwitcher({ y, scale }: { y: any; scale: any }) {
  const real = useRealScreenshotAvailable('/v2/painel/home.png');
  return (
    <motion.div
      style={{
        y,
        scale,
        display: 'flex',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {real ? <RealDashboardMockup /> : <DashboardMockup />}
    </motion.div>
  );
}

export function V2DashboardSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-12%']);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1, 0.98]);

  return (
    <section
      ref={ref}
      style={{
        padding: 'var(--v2-section-py) 0',
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, #fafaf7 0%, #f5f3ff 50%, #fafaf7 100%)',
      }}
    >
      <div className="v2-container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
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
            maxWidth: 720,
            margin: '0 auto clamp(3rem, 5vw, 5rem)',
          }}
        >
          <span className="v2-eyebrow">Painel da clínica</span>
          <h2 className="v2-display" style={{ maxWidth: '20ch' }}>
            Tudo o que importa.{' '}
            <span className="v2-italic">Numa única tela.</span>
          </h2>
          <p className="v2-lead" style={{ maxWidth: '52ch' }}>
            Agenda do dia, receita, taxa de confirmação, no-show, ações da IA em tempo real.
            Você passa 5 minutos por dia. Ela cuida do resto.
          </p>
        </motion.div>

        <DashboardSwitcher y={y} scale={scale} />

        {/* Stats abaixo do dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          style={{
            marginTop: 'clamp(3rem, 5vw, 4rem)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            maxWidth: 920,
            margin: 'clamp(3rem, 5vw, 4rem) auto 0',
          }}
        >
          {[
            { value: '5min', label: 'Tempo diário gerenciando' },
            { value: '0', label: 'Sistemas paralelos' },
            { value: '24/7', label: 'IA monitorando' },
            { value: '100%', label: 'Visibilidade ao vivo' },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(10px)',
                borderRadius: 16,
                padding: '1rem 1.25rem',
                border: '1px solid rgba(0,0,0,0.05)',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(1.5rem, 1rem + 1.5vw, 2rem)',
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                  color: '#6E56CF',
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#71717a', marginTop: 6 }}>
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
