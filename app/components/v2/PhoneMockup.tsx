'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';

type Msg = {
  side: 'in' | 'out';
  text: string;
  highlight?: boolean;
  reaction?: string;
};

// Conversa real Singulare — psicóloga + paciente
const SCRIPT: Msg[] = [
  { side: 'in', text: 'Oi! Queria marcar consulta com a Dra. Paula 🙂' },
  { side: 'out', text: 'Olá! Claro, vou ajudar. Pode me passar nome completo e data de nascimento?' },
  { side: 'in', text: 'Mariana Costa, 14/05/1992' },
  { side: 'out', text: 'Perfeito Mariana! Tenho quinta às 15h ou sexta às 14h. Qual prefere?' },
  { side: 'in', text: 'Quinta às 15h 👍' },
  { side: 'out', text: 'Confirmado ✓\nQuinta, 02/05 às 15h00\nR$ 280,00 — Pix gerado, link no próximo aviso.', highlight: true },
];

const TYPING_MS = 1100;
const READING_MS = 800;
const FINAL_PAUSE_MS = 3500;

export function PhoneMockup({ scale = 1 }: { scale?: number }) {
  const [visible, setVisible] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<'in' | 'out' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let canceled = false;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const run = async () => {
      while (!canceled) {
        setVisible([]);
        await wait(600);
        for (const msg of SCRIPT) {
          if (canceled) return;
          setTyping(msg.side);
          await wait(TYPING_MS);
          if (canceled) return;
          setTyping(null);
          setVisible((v) => [...v, msg]);
          await wait(READING_MS);
        }
        await wait(FINAL_PAUSE_MS);
      }
    };

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        const t = setTimeout(() => resolve(), ms);
        timers.push(t);
      });
    }

    run();
    return () => {
      canceled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  // Auto-scroll dentro do telefone quando nova mensagem aparece
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [visible.length, typing]);

  return (
    <div
      style={{
        width: 320 * scale,
        height: 660 * scale,
        background: 'linear-gradient(180deg, #2a2a2c 0%, #1d1d1f 100%)',
        borderRadius: 52 * scale,
        padding: 12 * scale,
        boxShadow:
          '0 60px 120px -20px rgba(110,86,207,0.25), 0 30px 60px -30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(0,0,0,0.05)',
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: 'absolute',
          top: 22 * scale,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 110 * scale,
          height: 32 * scale,
          background: '#000',
          borderRadius: 999,
          zIndex: 5,
        }}
      />

      {/* Screen */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ECE5DD',
          borderRadius: 40 * scale,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ height: 56 * scale, background: '#075E54', flexShrink: 0 }} />

        {/* Header */}
        <div
          style={{
            background: '#075E54',
            padding: `${10 * scale}px ${16 * scale}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 12 * scale,
            color: '#fff',
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 36 * scale,
              height: 36 * scale,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6E56CF, #5746AF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14 * scale,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            S
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 * scale, fontWeight: 600 }}>Singulare</div>
            <div style={{ fontSize: 11 * scale, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#34D399',
                  boxShadow: '0 0 6px #34D399',
                }}
              />
              respondendo agora
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            padding: `${16 * scale}px ${12 * scale}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8 * scale,
            overflowY: 'auto',
            scrollBehavior: 'smooth',
          }}
        >
          <AnimatePresence initial={false}>
            {visible.map((msg, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', justifyContent: msg.side === 'out' ? 'flex-end' : 'flex-start' }}
              >
                <Bubble msg={msg} scale={scale} />
              </motion.div>
            ))}
            {typing && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', justifyContent: typing === 'out' ? 'flex-end' : 'flex-start' }}
              >
                <TypingDots scale={scale} side={typing} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div
          style={{
            background: '#F0F0F0',
            padding: `${10 * scale}px ${12 * scale}px`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8 * scale,
            zIndex: 2,
          }}
        >
          <div
            style={{
              flex: 1,
              background: '#fff',
              borderRadius: 999,
              padding: `${8 * scale}px ${14 * scale}px`,
              fontSize: 13 * scale,
              color: '#999',
            }}
          >
            Mensagem
          </div>
          <div
            style={{
              width: 36 * scale,
              height: 36 * scale,
              borderRadius: '50%',
              background: '#075E54',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, scale }: { msg: Msg; scale: number }) {
  const isOut = msg.side === 'out';
  return (
    <div
      style={{
        maxWidth: '78%',
        background: isOut ? '#DCF8C6' : '#fff',
        padding: `${8 * scale}px ${12 * scale}px`,
        borderRadius: 12 * scale,
        borderTopRightRadius: isOut ? 4 * scale : 12 * scale,
        borderTopLeftRadius: isOut ? 12 * scale : 4 * scale,
        fontSize: 13 * scale,
        lineHeight: 1.4,
        color: '#1d1d1f',
        boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
        whiteSpace: 'pre-line',
        ...(msg.highlight && {
          borderLeft: '3px solid #6E56CF',
          background: 'linear-gradient(135deg, #DCF8C6, #c4ecaa)',
        }),
      }}
    >
      {msg.text}
    </div>
  );
}

function TypingDots({ scale, side }: { scale: number; side: 'in' | 'out' }) {
  const isOut = side === 'out';
  return (
    <div
      style={{
        background: isOut ? '#DCF8C6' : '#fff',
        padding: `${10 * scale}px ${14 * scale}px`,
        borderRadius: 12 * scale,
        borderTopRightRadius: isOut ? 4 * scale : 12 * scale,
        borderTopLeftRadius: isOut ? 12 * scale : 4 * scale,
        boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
        display: 'flex',
        gap: 4 * scale,
        alignItems: 'center',
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
          style={{
            width: 6 * scale,
            height: 6 * scale,
            borderRadius: '50%',
            background: '#6E56CF',
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  );
}
