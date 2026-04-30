'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Dra. Ana Carolina',
    specialty: 'Psicologia',
    clinic: 'Consultório próprio',
    avatar:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&auto=format&fit=crop&q=80',
    text: 'Atendo 100% pelo WhatsApp. A IA cuida de agenda e cobrança, eu foco nas sessões. Mudou minha vida.',
    metric: '+47 pacientes',
    metricLabel: 'em 4 meses',
  },
  {
    name: 'Dr. Roberto Silva',
    specialty: 'Odontologia',
    clinic: 'Clínica OrtoSorriso',
    avatar:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&auto=format&fit=crop&q=80',
    text: 'Minhas consultas aumentaram 60% e diminuí faltas em 70%. Singulare virou parte do time.',
    metric: '70%',
    metricLabel: 'menos faltas',
  },
  {
    name: 'Mariana Costa',
    specialty: 'Nutrição',
    clinic: 'Nutri & Movimento',
    avatar:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    text: 'A melhor decisão que tomei pro consultório. ROI em menos de 30 dias. Atende melhor que eu.',
    metric: '< 30 dias',
    metricLabel: 'pra ROI',
  },
];

export function V2Testimonials() {
  return (
    <section style={{ padding: 'var(--v2-section-py) 0', background: '#fff', position: 'relative' }}>
      <div className="v2-container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 'clamp(3rem, 4vw, 4rem)', maxWidth: 720 }}
        >
          <span className="v2-eyebrow">Quem usa, fala</span>
          <h2 className="v2-display" style={{ marginTop: '0.875rem' }}>
            +5.247 profissionais.{' '}
            <span className="v2-italic">Uma única IA.</span>
          </h2>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {TESTIMONIALS.map((t, i) => (
            <motion.article
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
              style={{
                background: '#fafaf7',
                borderRadius: 'var(--v2-radius-card)',
                padding: 'clamp(1.5rem, 2vw, 2rem)',
                border: '1px solid rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', gap: 2 }}>
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={14} fill="#fbbf24" color="#fbbf24" strokeWidth={0} />
                ))}
              </div>

              <p
                style={{
                  fontSize: 'clamp(1rem, 0.95rem + 0.3vw, 1.125rem)',
                  lineHeight: 1.5,
                  color: '#27272a',
                  letterSpacing: '-0.01em',
                  flex: 1,
                }}
              >
                "{t.text}"
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.avatar}
                  alt={t.name}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      color: '#18181b',
                      lineHeight: 1.2,
                    }}
                  >
                    {t.name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#71717a', marginTop: 2 }}>
                    {t.specialty} · {t.clinic}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: '#6E56CF',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                    }}
                  >
                    {t.metric}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#71717a', marginTop: 2 }}>
                    {t.metricLabel}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
