'use client';

import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import Image from 'next/image';

export function V2Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (v) => {
    setScrolled(v > 80);
  });

  return (
    <motion.nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 60,
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        background: scrolled ? 'rgba(250, 250, 247, 0.78)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        transition: 'all 320ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 clamp(1rem, 0.5rem + 2vw, 2.5rem)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <a
          href="#hero"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
          aria-label="Singulare"
        >
          <Image
            src="/logos/singulare-a.svg"
            alt="Singulare"
            width={140}
            height={40}
            priority
            style={{ height: 28, width: 'auto' }}
          />
        </a>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
            fontSize: '0.875rem',
            color: '#18181b',
          }}
        >
          <a href="#highlights" style={navLink} className="v2-nav-link">
            Diferenciais
          </a>
          <a href="#performance" style={navLink} className="v2-nav-link">
            Resultados
          </a>
          <a href="#pricing" style={navLink} className="v2-nav-link">
            Preços
          </a>
          <a
            href="#cta"
            className="v2-btn-primary"
            style={{ padding: '0.5rem 1.125rem', fontSize: '0.875rem', borderRadius: '0.5rem' }}
          >
            Começar grátis
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

const navLink = {
  color: '#18181b',
  textDecoration: 'none',
  fontWeight: 500,
  transition: 'opacity 200ms',
} as const;
