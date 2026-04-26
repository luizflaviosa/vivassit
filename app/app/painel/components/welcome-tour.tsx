'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

const STORAGE_KEY = 'vivassit_tour_done_v1';

interface TourStep {
  title: string;
  body: string;
  emoji: string;
}

const STEPS: TourStep[] = [
  {
    emoji: '👋',
    title: 'Bem-vindo ao Vivassit',
    body: 'Aqui é o cockpit do seu negócio. Em 4 telas você vê tudo o que importa do dia-a-dia.',
  },
  {
    emoji: '🤖',
    title: 'Personalize sua IA',
    body: 'Em Configurações você escreve em linguagem natural como o agente IA deve atender. Mudou? Já vale na próxima conversa do WhatsApp.',
  },
  {
    emoji: '👥',
    title: 'Cadastre profissionais',
    body: 'Cada profissional cadastrado recebe agenda própria. A IA respeita os horários e valores que você definir.',
  },
  {
    emoji: '💳',
    title: 'Ative pagamentos (marketplace)',
    body: 'Em Pagamentos, ative recebimento via WhatsApp. Asaas cria sua subconta e o dinheiro cai direto na sua conta bancária — sem intermediários.',
  },
  {
    emoji: '✨',
    title: 'Explore quando quiser',
    body: 'Cobranças, NPS, NF, mensagens — tudo no menu lateral. Volte aqui sempre que precisar.',
  },
];

export default function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setOpen(true);
    }
  }, []);

  const close = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    setOpen(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else close();
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  if (!open) return null;
  const current = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      >
        <motion.div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-black/[0.06]">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.1em] font-semibold"
                style={{ color: ACCENT_DEEP }}
              >
                Tour rápido · {step + 1}/{STEPS.length}
              </span>
            </div>
            <button
              onClick={close}
              className="h-8 w-8 -mr-2 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          {/* Conteudo */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="p-6 sm:p-8 text-center"
            >
              <div className="text-[64px] mb-4 leading-none">{current.emoji}</div>
              <h2 className="text-[22px] sm:text-[24px] leading-[1.15] tracking-[-0.02em] font-medium text-zinc-900 mb-2">
                {current.title}
              </h2>
              <p className="text-[15px] text-zinc-500 leading-relaxed max-w-sm mx-auto">
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Progress + nav */}
          <div className="px-5 sm:px-6 py-4 border-t border-black/[0.06] bg-zinc-50/60 flex items-center justify-between gap-3">
            <button
              onClick={back}
              disabled={step === 0}
              className="h-9 px-3 rounded-md text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] inline-flex items-center gap-1.5 transition-all disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Voltar
            </button>

            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === step ? 20 : 6,
                    background: i <= step ? ACCENT_DEEP : '#E4E4E7',
                  }}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="h-9 px-4 rounded-md text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110"
              style={{
                background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
              }}
            >
              {step === STEPS.length - 1 ? 'Vamos lá' : 'Próximo'}
              {step < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Reset helper para devs
export function resetWelcomeTour() {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}

// Suprime warning se ACCENT_SOFT nao for usado
void ACCENT_SOFT;
