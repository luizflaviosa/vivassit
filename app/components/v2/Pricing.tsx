'use client';

import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter',
    price: 97,
    tagline: 'Consultório solo, começo de jornada',
    features: [
      'Até 100 pacientes',
      'Agenda inteligente',
      'WhatsApp + IA básica',
      'Suporte por email',
    ],
    popular: false,
  },
  {
    name: 'Professional',
    price: 197,
    tagline: 'O mais escolhido pelos profissionais',
    features: [
      'Pacientes ilimitados',
      'IA completa + assistente humana',
      'WhatsApp Business',
      'Marketplace de cobranças',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 397,
    tagline: 'Clínica até 5 profissionais',
    features: [
      'Multi-profissional',
      'CRM completo',
      'NF automática',
      'API personalizada',
      'Treinamento exclusivo',
      'Suporte 24/7',
    ],
    popular: false,
  },
  {
    name: 'Clínica+',
    price: 597,
    tagline: 'Clínica com 6+ profissionais',
    features: [
      'Profissionais ilimitados',
      'Multi-unidades',
      'Painel BI dedicado',
      'Gerente de conta dedicado',
      'SLA garantido',
      'Onboarding white-glove',
    ],
    popular: false,
  },
];

export function V2Pricing() {
  return (
    <section
      id="pricing"
      style={{
        padding: 'var(--v2-section-py) 0',
        background: 'linear-gradient(180deg, #fafaf7 0%, #f5f3ff 100%)',
        position: 'relative',
      }}
    >
      <div className="v2-container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            textAlign: 'center',
            marginBottom: 'clamp(3rem, 4vw, 4rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.875rem',
          }}
        >
          <span className="v2-eyebrow">Preços simples</span>
          <h2 className="v2-display" style={{ maxWidth: '20ch' }}>
            Comece grátis.{' '}
            <span className="v2-italic">Cresça quando quiser.</span>
          </h2>
          <p className="v2-lead" style={{ maxWidth: 540 }}>
            7 dias grátis em qualquer plano. Sem cartão, sem letra miúda. Cancele quando quiser.
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            alignItems: 'stretch',
          }}
        >
          {PLANS.map((p, i) => (
            <motion.article
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              style={{
                background: p.popular ? 'linear-gradient(180deg, #fff, #fff)' : '#fff',
                borderRadius: 'var(--v2-radius-card)',
                padding: '1.75rem 1.5rem',
                border: p.popular ? '2px solid #6E56CF' : '1px solid rgba(0,0,0,0.06)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                boxShadow: p.popular
                  ? '0 12px 40px -12px rgba(110,86,207,0.4), 0 4px 12px rgba(0,0,0,0.04)'
                  : '0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03)',
                transform: p.popular ? 'scale(1.02)' : 'none',
              }}
            >
              {p.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(90deg, #6E56CF, #5746AF)',
                    color: '#fff',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '0.375rem 0.875rem',
                    borderRadius: 9999,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 12px rgba(110,86,207,0.4)',
                  }}
                >
                  Mais escolhido
                </div>
              )}

              <div>
                <h3 className="v2-h3" style={{ marginBottom: 4 }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#71717a', margin: 0 }}>{p.tagline}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '0.875rem', color: '#71717a', fontWeight: 500 }}>R$</span>
                <span
                  style={{
                    fontSize: '2.75rem',
                    fontWeight: 600,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    color: '#18181b',
                  }}
                >
                  {p.price}
                </span>
                <span style={{ fontSize: '0.875rem', color: '#71717a' }}>/mês</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1 }}>
                {p.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: '0.875rem',
                      color: '#3f3f46',
                      lineHeight: 1.4,
                    }}
                  >
                    <Check size={15} strokeWidth={2.5} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={`/onboarding?plan=${p.name.toLowerCase()}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0.75rem 1rem',
                  background: p.popular ? 'linear-gradient(180deg, #6E56CF, #5746AF)' : '#fff',
                  color: p.popular ? '#fff' : '#18181b',
                  border: p.popular ? 'none' : '1px solid rgba(0,0,0,0.12)',
                  borderRadius: '0.625rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: p.popular ? '0 4px 12px rgba(110,86,207,0.3)' : 'none',
                }}
              >
                Começar 7 dias grátis
                <ArrowRight size={14} />
              </a>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
