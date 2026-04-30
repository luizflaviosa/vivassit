'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  Calendar,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

/**
 * Dashboard mockup CSS-only com tilt 3D no mouse.
 * Mostra o painel da clínica em uso real.
 */
export function DashboardMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rX = useSpring(useTransform(my, [0, 1], [4, -4]), { stiffness: 200, damping: 22 });
  const rY = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 22 });

  return (
    <motion.div
      ref={ref}
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
      {/* Glow embaixo do laptop */}
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
        {/* Screen */}
        <div
          style={{
            background: '#fafaf7',
            borderRadius: 8,
            overflow: 'hidden',
            aspectRatio: '16 / 10',
            position: 'relative',
          }}
        >
          <DashboardUI />
        </div>

        {/* Notch / camera */}
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

function DashboardUI() {
  return (
    <div style={{ height: '100%', display: 'flex', fontSize: 11, color: '#18181b' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 60,
          background: '#fff',
          borderRight: '1px solid rgba(0,0,0,0.06)',
          padding: '12px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6E56CF, #5746AF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          S
        </div>
        <div style={{ width: '60%', height: 1, background: 'rgba(0,0,0,0.06)' }} />
        {[
          { icon: Calendar, active: true },
          { icon: MessageSquare },
          { icon: TrendingUp },
        ].map((Item, i) => (
          <div
            key={i}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: Item.active ? 'rgba(110,86,207,0.1)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: Item.active ? '#6E56CF' : '#71717a',
            }}
          >
            <Item.icon size={14} strokeWidth={1.75} />
          </div>
        ))}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '16px 20px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9, color: '#71717a', fontWeight: 500, marginBottom: 2 }}>
              SEXTA, 30 ABR
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>
              Bom dia, Dra. Paula
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(34,197,94,0.1)',
              fontSize: 9,
              fontWeight: 600,
              color: '#16a34a',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
            IA ativa
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Hoje', value: '8', sub: 'consultas', color: '#6E56CF' },
            { label: 'Confirmadas', value: '7', sub: '87%', color: '#16a34a' },
            { label: 'Receita', value: 'R$ 2.240', sub: '+12%', color: '#18181b' },
            { label: 'No-show', value: '1', sub: 'reagendado', color: '#f59e0b' },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                borderRadius: 8,
                padding: '8px 10px',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ fontSize: 8, color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {s.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: s.color, letterSpacing: '-0.02em', marginTop: 2 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 8, color: '#71717a', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
          {/* Agenda hoje */}
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '10px 12px',
              border: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8 }}>Agenda de hoje</div>
            {[
              { time: '09:00', name: 'Mariana Costa', status: 'confirmada' },
              { time: '10:30', name: 'Carlos Almeida', status: 'confirmada' },
              { time: '14:00', name: 'Beatriz Souza', status: 'pendente' },
              { time: '15:30', name: 'Pedro Ribeiro', status: 'confirmada' },
            ].map((apt, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 0',
                  borderBottom: i < 3 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: '#71717a', minWidth: 36 }}>
                  {apt.time}
                </span>
                <span style={{ flex: 1, fontSize: 10, color: '#27272a' }}>{apt.name}</span>
                {apt.status === 'confirmada' ? (
                  <CheckCircle2 size={11} color="#16a34a" />
                ) : (
                  <AlertCircle size={11} color="#f59e0b" />
                )}
              </div>
            ))}
          </div>

          {/* IA atividade recente */}
          <div
            style={{
              background: 'linear-gradient(180deg, #f5f3ff, #fff)',
              borderRadius: 8,
              padding: '10px 12px',
              border: '1px solid rgba(110,86,207,0.15)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: '#5746AF' }}>
              IA · últimas ações
            </div>
            {[
              'Confirmou consulta de Mariana',
              'Emitiu NFS-e de R$ 280,00',
              'Reagendou Beatriz pra 14h',
              'Respondeu áudio em 3.2s',
            ].map((act, i) => (
              <div
                key={i}
                style={{
                  fontSize: 10,
                  color: '#52525b',
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#6E56CF',
                    flexShrink: 0,
                  }}
                />
                {act}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
