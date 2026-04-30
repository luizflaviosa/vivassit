'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Image from 'next/image';

/**
 * Variante do DashboardMockup que usa screenshot REAL do painel.
 * Mantém o frame de laptop + tilt 3D no mouse + glow.
 *
 * Pré-requisito: rodar scripts/seed-demo.sql + npm run screenshot:painel
 * (gera public/v2/painel/home.png)
 */
export function RealDashboardMockup({
  src = '/v2/painel/home.png',
  alt = 'Painel Singulare em uso',
}: {
  src?: string;
  alt?: string;
}) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rX = useSpring(useTransform(my, [0, 1], [4, -4]), { stiffness: 200, damping: 22 });
  const rY = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 22 });

  return (
    <motion.div
      onMouseMove={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        mx.set((e.clientX - rect.left) / rect.width);
        my.set((e.clientY - rect.top) / rect.height);
      }}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      style={{
        rotateX: rX,
        rotateY: rY,
        transformStyle: 'preserve-3d',
        transformPerspective: 1400,
        position: 'relative',
        width: '100%',
        maxWidth: 920,
        margin: '0 auto',
      }}
    >
      {/* Glow embaixo */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '20% -10% -30% -10%',
          background: 'radial-gradient(50% 50% at 50% 80%, rgba(110,86,207,0.25), transparent 70%)',
          filter: 'blur(40px)',
          zIndex: -1,
        }}
      />

      {/* Laptop body */}
      <div
        style={{
          background: 'linear-gradient(180deg, #2a2a2c, #1d1d1f)',
          borderRadius: 14,
          padding: 14,
          paddingBottom: 18,
          boxShadow:
            '0 50px 120px -20px rgba(0,0,0,0.35), 0 30px 60px -30px rgba(110,86,207,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
          position: 'relative',
        }}
      >
        {/* Screen com PNG real */}
        <div
          style={{
            background: '#fafaf7',
            borderRadius: 8,
            overflow: 'hidden',
            aspectRatio: '16 / 10',
            position: 'relative',
          }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 920px) 100vw, 920px"
            style={{ objectFit: 'cover', objectPosition: 'top' }}
            priority
          />
        </div>

        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 40,
            height: 4,
            background: '#000',
            borderRadius: 2,
          }}
        />
      </div>

      {/* Laptop base */}
      <div
        style={{
          height: 12,
          background: 'linear-gradient(180deg, #1a1a1c, #0a0a0a)',
          borderRadius: '0 0 16px 16px',
          margin: '0 -2%',
          width: '104%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      />
    </motion.div>
  );
}
