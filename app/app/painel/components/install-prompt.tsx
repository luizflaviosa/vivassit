'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X, Share, Plus } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const STORAGE_KEY = 'singulare_install_dismissed_v1';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS Safari extension
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const ts = Number(dismissed);
      // Reaparece após 7 dias
      if (!isNaN(ts) && Date.now() - ts < 7 * 86_400_000) return;
    }

    const onBefore = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      // Atrasa exibição
      setTimeout(() => setShow(true), 30_000);
    };
    window.addEventListener('beforeinstallprompt', onBefore);

    // iOS não dispara beforeinstallprompt — fluxo manual
    if (isIOS()) {
      setIosMode(true);
      const t = setTimeout(() => setShow(true), 30_000);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBefore);
        clearTimeout(t);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBefore);
  }, []);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    setShow(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setShow(false);
    else dismiss();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-40"
        >
          <div className="rounded-2xl border border-violet-200/60 bg-white shadow-[0_18px_50px_-12px_rgba(110,86,207,0.32)] overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                >
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-zinc-900 leading-tight">
                    Instalar Singulare no celular
                  </h3>
                  <p className="text-[12.5px] text-zinc-500 mt-1 leading-relaxed">
                    {iosMode
                      ? 'Toque no ícone de compartilhar e em "Adicionar à Tela de Início" pra usar como app.'
                      : 'Abra mais rápido e receba notificações de novas consultas direto na tela inicial.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="h-7 w-7 -mr-1 -mt-1 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {iosMode ? (
                <div className="mt-4 flex items-center gap-3 text-[12px] text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2.5">
                  <span className="inline-flex items-center gap-1">
                    <Share className="w-3.5 h-3.5" /> Compartilhar
                  </span>
                  <span className="text-zinc-300">→</span>
                  <span className="inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Tela de Início
                  </span>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={install}
                    className="flex-1 h-10 rounded-lg text-white text-[13px] font-semibold transition-all hover:brightness-110"
                    style={{
                      background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
                      boxShadow:
                        '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 18px -6px rgba(110,86,207,0.55)',
                    }}
                  >
                    Instalar agora
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="h-10 px-4 rounded-lg text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  >
                    Depois
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
