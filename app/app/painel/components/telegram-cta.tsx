'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ExternalLink, Sparkles } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const STORAGE_KEY = 'singulare_tg_cta_dismissed_v1';

interface Props {
  telegramBotLink: string | null;
  hasChatId: boolean;
}

/**
 * Banner promovendo Telegram como canal principal de operação.
 * Aparece se: telegram_bot_link existe E telegram_chat_id NÃO existe (não vinculou ainda)
 * Esconde: dismiss persistido em localStorage por 30 dias
 */
export default function TelegramCTA({ telegramBotLink, hasChatId }: Props) {
  const [dismissed, setDismissed] = useState(true); // SSR-safe default

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ts = localStorage.getItem(STORAGE_KEY);
    if (!ts || (Date.now() - Number(ts) > 30 * 86_400_000)) {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    setDismissed(true);
  };

  // Não mostra se: já vinculou OR sem link OR dismissed
  if (hasChatId || !telegramBotLink || dismissed) return null;

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
            <Send className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold opacity-80 mb-1">
              <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" />
              Seu cockpit móvel
            </p>
            <h2 className="text-[18px] sm:text-[20px] font-medium tracking-[-0.01em] leading-tight mb-1.5">
              Abra seu Telegram pra começar
            </h2>
            <p className="text-[13.5px] opacity-90 leading-relaxed max-w-xl mb-4">
              Tudo que você precisa fazer no dia-a-dia (ver agenda, criar paciente,
              gerar cobrança, marcar consulta) você pede pro seu agente Singulare
              direto no Telegram. O painel é pra configurar e visualizar.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={telegramBotLink}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-4 rounded-lg bg-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-white/95 transition-all"
                style={{ color: ACCENT_DEEP }}
              >
                <Send className="w-3.5 h-3.5" />
                Abrir no Telegram
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
              <button
                type="button"
                onClick={dismiss}
                className="h-10 px-3 text-[12.5px] font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Lembrar depois
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
