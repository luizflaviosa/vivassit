'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Sparkles, ArrowRight } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const STORAGE_KEY = 'singulare_assistant_cta_dismissed_v1';

/**
 * Banner promovendo a IA assistente do painel como ferramenta principal
 * de operação. Atalho: clica → abre o chat-drawer.
 *
 * Aparece nos primeiros usos. Dismiss persiste 60 dias.
 */
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
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="rounded-2xl overflow-hidden mb-6 relative"
        style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DEEP} 100%)` }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative p-5 sm:p-6 flex items-start gap-4 text-white">
          <div className="flex-shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold opacity-80 mb-1">
              Assistente Singulare
            </p>
            <h2 className="text-[18px] sm:text-[20px] font-medium tracking-[-0.01em] leading-tight mb-1.5">
              Pergunte, peça, gerencie — converse com sua IA
            </h2>
            <p className="text-[13.5px] opacity-90 leading-relaxed max-w-xl mb-4">
              No dia-a-dia você não precisa navegar pelo painel. Abre o chat e fala
              com a sua assistente: <em>&quot;como tá minha agenda hoje?&quot;</em>,{' '}
              <em>&quot;cancela a próxima da Maria&quot;</em>, <em>&quot;manda cobrança pro João&quot;</em>.
              Ela faz tudo.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openChat}
                className="h-10 px-4 rounded-lg bg-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-white/95 transition-all"
                style={{ color: ACCENT_DEEP }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Abrir chat agora
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="h-10 px-3 text-[12.5px] font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Já entendi
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
