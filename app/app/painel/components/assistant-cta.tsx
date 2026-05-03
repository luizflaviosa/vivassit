'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Sparkles } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const STORAGE_KEY = 'singulare_assistant_cta_dismissed_v1';

export default function AssistantCTA() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ts = localStorage.getItem(STORAGE_KEY);
    if (!ts || (Date.now() - Number(ts) > 60 * 86_400_000)) {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    setDismissed(true);
  };

  const openChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('singulare:open-chat'));
    }
    dismiss();
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="rounded-xl overflow-hidden mb-5 relative"
        style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DEEP} 100%)` }}
      >
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />

        <div className="relative px-4 py-3 flex items-center gap-3 text-white">
          <div className="flex-shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <Sparkles className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium leading-snug truncate">
              <span className="opacity-90 font-semibold">Assistente Singulare</span>
              <span className="opacity-60 mx-1.5">·</span>
              <span className="opacity-75 text-[12.5px]">Pergunte, peça e gerencie pelo chat — sem navegar pelo painel.</span>
            </p>
          </div>

          <div className="flex-shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={openChat}
              className="h-7 px-3 rounded-md bg-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-white/95 transition-all"
              style={{ color: ACCENT_DEEP }}
            >
              <MessageCircle className="w-3 h-3" />
              Abrir chat
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
