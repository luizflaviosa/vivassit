'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

export default function AssistantCTA() {
  const openChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('singulare:open-chat'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
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

        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={openChat}
            className="h-7 px-3 rounded-md bg-white text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-white/95 transition-all"
            style={{ color: ACCENT_DEEP }}
          >
            <MessageCircle className="w-3 h-3" />
            Abrir chat
          </button>
        </div>
      </div>
    </motion.div>
  );
}
