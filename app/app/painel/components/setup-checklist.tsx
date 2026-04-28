'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, Check, ChevronRight, X, AlertCircle } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';
const STORAGE_KEY = 'singulare_setup_dismissed_v1';

interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  done: boolean;
  desc?: string;
}

interface ChecklistData {
  has_doctor: boolean;
  has_calendar: boolean;
  has_payment: boolean;
  has_ai_prompt: boolean;
  has_clinic_data: boolean;
}

export default function SetupChecklist() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
    }
    fetch('/api/painel/setup-status')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.status);
      })
      .catch(() => {});
  }, []);

  if (!data || dismissed) return null;

  // Deeplinks: cada link aterrissa exatamente onde o user precisa agir.
  // - ?action=new abre o modal de novo profissional automaticamente
  // - #ai-prompt / #clinica usa scroll-to-anchor nas configurações
  const items: ChecklistItem[] = [
    {
      key: 'doctor',
      label: 'Cadastrar profissional',
      desc: 'Quem atende, valor da consulta, especialidade',
      href: '/painel/profissionais?action=new',
      done: data.has_doctor,
    },
    {
      key: 'calendar',
      label: 'Conectar agenda Google',
      desc: 'A IA cria uma agenda dedicada automaticamente — só precisa abrir o profissional',
      href: '/painel/profissionais',
      done: data.has_calendar,
    },
    {
      key: 'ai',
      label: 'Personalizar a IA',
      desc: 'Tom de voz, regras, o que oferecer aos pacientes',
      href: '/painel/configuracoes#ai-prompt',
      done: data.has_ai_prompt,
    },
    {
      key: 'clinic',
      label: 'Dados da clínica',
      desc: 'Nome, endereço, telefone administrativo',
      href: '/painel/configuracoes#clinica',
      done: data.has_clinic_data,
    },
    {
      key: 'payment',
      label: 'Ativar pagamentos',
      desc: 'Receber via PIX, cartão ou boleto direto na sua conta',
      href: '/painel/pagamentos/ativar',
      done: data.has_payment,
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;
  if (allDone) return null;

  const pct = Math.round((completed / total) * 100);

  const closeAndRemember = () => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/60 via-white to-white p-5 sm:p-6 mb-6"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-0.5" style={{ color: ACCENT_DEEP }}>
                Configuração · {completed} de {total}
              </p>
              <h2 className="text-[18px] font-medium tracking-[-0.01em] text-zinc-900">
                Termine de configurar sua clínica
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[12px] font-semibold text-zinc-600 hover:text-zinc-900 px-2.5 h-8 rounded-md hover:bg-black/[0.04]"
            >
              {expanded ? 'Ocultar' : 'Ver lista'}
            </button>
            <button
              type="button"
              onClick={closeAndRemember}
              className="h-7 w-7 -mr-1 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              aria-label="Dispensar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden mb-1">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})` }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <p className="text-[11px] text-zinc-400">
          {pct === 0
            ? 'Comece pelo primeiro item.'
            : pct === 100
              ? 'Tudo pronto!'
              : `Faltam ${total - completed} ${total - completed === 1 ? 'configuração' : 'configurações'}.`}
        </p>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-1 border-t border-violet-100 pt-3">
                {items.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all ${
                      item.done ? 'opacity-50' : 'hover:bg-white'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-full inline-flex items-center justify-center ${
                        item.done ? 'bg-emerald-500 text-white' : 'border-2'
                      }`}
                      style={!item.done ? { borderColor: ACCENT, background: 'white' } : undefined}
                    >
                      {item.done ? <Check className="w-3 h-3" strokeWidth={3} /> : <AlertCircle className="w-3 h-3" style={{ color: ACCENT }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13.5px] font-semibold ${item.done ? 'line-through text-zinc-500' : 'text-zinc-900'}`}>
                        {item.label}
                      </p>
                      {item.desc && !item.done && (
                        <p className="text-[12px] text-zinc-500 mt-0.5">{item.desc}</p>
                      )}
                    </div>
                    {!item.done && (
                      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-violet-500 mt-0.5 transition-colors" />
                    )}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

void ACCENT_SOFT;
