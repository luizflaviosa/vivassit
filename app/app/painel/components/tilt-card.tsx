'use client';

import { useRef, useState, useCallback, type CSSProperties } from 'react';

// TiltCard: efeito 3D Apple-style sem dep externa.
// Calcula tilt baseado na posição do mouse, aplica via transform CSS.
// Sutil por padrão (max 8°) — ideal pra cards de stats e features.

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;       // graus, default 8
  scale?: number;         // 1 = sem escala, 1.02 sutil
  glare?: boolean;        // overlay de luz no canto
  perspective?: number;   // px, lower = more dramatic. default 1000
  disableOnMobile?: boolean; // tilt em mobile é estranho — default true
  as?: 'div' | 'a' | 'button';
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

export default function TiltCard({
  children,
  className = '',
  maxTilt = 8,
  scale = 1.02,
  glare = false,
  perspective = 1000,
  disableOnMobile = true,
  as = 'div',
  href,
  onClick,
  style,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      if (disableOnMobile && isMobile()) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateY = ((x - cx) / cx) * maxTilt;
      const rotateX = -((y - cy) / cy) * maxTilt;
      setTransform(
        `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(${scale})`
      );
      if (glare) {
        setGlarePos({
          x: (x / rect.width) * 100,
          y: (y / rect.height) * 100,
          opacity: 0.4,
        });
      }
    },
    [maxTilt, scale, perspective, disableOnMobile, glare]
  );

  const handleLeave = useCallback(() => {
    setTransform('');
    if (glare) setGlarePos((p) => ({ ...p, opacity: 0 }));
  }, [glare]);

  const Component = as as 'div';
  const componentProps = as === 'a' ? { href } : as === 'button' ? { type: 'button' as const, onClick } : { onClick };

  return (
    <Component
      ref={ref as never}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden ${className}`}
      style={{
        transform,
        transformStyle: 'preserve-3d',
        transition: transform ? 'transform 80ms cubic-bezier(0.16, 1, 0.3, 1)' : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
        ...style,
      }}
      {...(componentProps as Record<string, unknown>)}
    >
      {children}
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%)`,
            opacity: glarePos.opacity,
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </Component>
  );
}
