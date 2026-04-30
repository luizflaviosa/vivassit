'use client';

import { motion } from 'framer-motion';
import { Sparkles, Brain, Heart, Zap } from 'lucide-react';

const AI_FEATURES = [
  {
    icon: Brain,
    title: 'Memória cross-agent',
    description:
      'Lembra do histórico do paciente entre todas as conversas e agentes. "Como foi a última sessão?" tem resposta certa.',
  },
  {
    icon: Heart,
    title: 'Tom adaptativo',
    description:
      'Detecta urgência, ansiedade ou pedido de empatia. Adapta a resposta ao momento — ou escala pra humano.',
  },
  {
    icon: Zap,
    title: 'Reflexão antes de agir',
    description:
      'Antes de criar/cancelar evento, a IA usa thinking-mode pra validar dia da semana, conflito de horário, prazo de retorno. Zero erro de agendamento.',
  },
];

export function V2AISection() {
  return (
    <section
      id="ai"
      className="v2-section"
      style={{
        background:
          'linear-gradient(180deg, #fff 0%, #faf8ff 50%, #fff 100%)',
        position: 'relative',
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
            textAlign: 'center',
            marginBottom: 'clamp(3rem, 5vw, 5rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <motion.div
            animate={{
              rotate: [0, 6, 0, -6, 0],
              scale: [1, 1.05, 1, 1.05, 1],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #6E56CF, #b39dff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 40px rgba(110,86,207,0.4)',
            }}
          >
            <Sparkles size={28} color="#fff" strokeWidth={1.75} />
          </motion.div>

          <span className="v2-eyebrow">Singulare Intelligence</span>
          <h2 className="v2-display" style={{ maxWidth: '20ch' }}>
            Memória que entende.
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg, #6E56CF, #b39dff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Decisão que respeita.
            </span>
          </h2>
          <p className="v2-lead" style={{ maxWidth: '54ch' }}>
            Construída desde o zero pra saúde brasileira. Conversa em português natural,
            lembra do histórico de cada paciente entre conversas, e LGPD por design.
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {AI_FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: i * 0.15,
              }}
              whileHover={{ y: -6 }}
              style={{
                background: '#fff',
                borderRadius: 'var(--v2-radius-card)',
                padding: 'clamp(1.5rem, 2vw, 2rem)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 24px rgba(110,86,207,0.06)',
                border: '1px solid rgba(110,86,207,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background:
                    'linear-gradient(135deg, rgba(110,86,207,0.12), rgba(110,86,207,0.04))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6E56CF',
                }}
              >
                <f.icon size={22} strokeWidth={1.75} />
              </div>
              <h3 className="v2-h3">{f.title}</h3>
              <p className="v2-lead" style={{ fontSize: '0.9375rem' }}>
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
