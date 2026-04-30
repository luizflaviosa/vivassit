'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const VARIANTS = [
  {
    name: 'Violeta',
    color: '#6E56CF',
    bg: 'linear-gradient(180deg, #faf8ff 0%, #f0ebff 100%)',
    image:
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1400&auto=format&fit=crop&q=80',
    caption: 'Para psicólogos e terapeutas — calmo e acolhedor.',
  },
  {
    name: 'Carbono',
    color: '#1d1d1f',
    bg: 'linear-gradient(180deg, #f5f5f7 0%, #e5e5e7 100%)',
    image:
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1400&auto=format&fit=crop&q=80',
    caption: 'Para clínicas premium — minimalista e direto.',
  },
  {
    name: 'Coral',
    color: '#ff6b6b',
    bg: 'linear-gradient(180deg, #fff5f5 0%, #ffe5e5 100%)',
    image:
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1400&auto=format&fit=crop&q=80',
    caption: 'Para nutricionistas e wellness — energético e vibrante.',
  },
  {
    name: 'Floresta',
    color: '#3a8a5e',
    bg: 'linear-gradient(180deg, #f0fdf4 0%, #d4f4dd 100%)',
    image:
      'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=1400&auto=format&fit=crop&q=80',
    caption: 'Para fisios e práticas integrativas — natural e equilibrado.',
  },
];

export function V2ProductShowcase() {
  const [active, setActive] = useState(0);
  const v = VARIANTS[active];

  return (
    <section className="v2-section" style={{ background: v.bg, transition: 'background 600ms ease' }}>
      <div className="v2-container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            textAlign: 'center',
            marginBottom: 'clamp(2.5rem, 4vw, 4rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span className="v2-eyebrow">Personalize a sua</span>
          <h2 className="v2-display" style={{ maxWidth: '22ch' }}>
            Quatro temas. Uma identidade.
            <br />
            <span style={{ color: 'var(--v2-fg-muted)' }}>A sua.</span>
          </h2>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '3rem',
            alignItems: 'center',
          }}
        >
          {/* Image area */}
          <div
            style={{
              position: 'relative',
              aspectRatio: '16 / 10',
              maxWidth: 960,
              margin: '0 auto',
              width: '100%',
              borderRadius: 'var(--v2-radius-card)',
              overflow: 'hidden',
              boxShadow: '0 30px 60px rgba(0,0,0,0.1)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={active}
                src={v.image}
                alt={v.caption}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </AnimatePresence>

            {/* Color tint overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${v.color}25 0%, transparent 60%)`,
                mixBlendMode: 'multiply',
                transition: 'background 600ms ease',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Caption + swatches */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                className="v2-lead"
                style={{ textAlign: 'center', maxWidth: '38ch' }}
              >
                {v.caption}
              </motion.p>
            </AnimatePresence>

            <div style={{ display: 'flex', gap: '1rem' }}>
              {VARIANTS.map((variant, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Tema ${variant.name}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: variant.color,
                    border:
                      active === i
                        ? `2px solid ${variant.color}`
                        : '2px solid transparent',
                    outline:
                      active === i
                        ? `2px solid #fff`
                        : 'none',
                    outlineOffset: -4,
                    cursor: 'pointer',
                    transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
                    transform: active === i ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: active === i ? `0 4px 16px ${variant.color}66` : 'none',
                  }}
                />
              ))}
            </div>

            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--v2-fg-muted)',
                fontWeight: 500,
              }}
            >
              Tema atual: <strong style={{ color: 'var(--v2-fg)' }}>{v.name}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
