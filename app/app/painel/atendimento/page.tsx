'use client';

import { Suspense, useMemo, useState } from 'react';
import { ExternalLink, Headphones, MessageCircle, Minimize2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMe } from '@/lib/painel-context';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

function buildChatwootUrl(rawUrl?: string | null, accountId?: string | number | null): string | null {
  if (!rawUrl || accountId === null || accountId === undefined || accountId === '') return null;
  const base = String(rawUrl).replace(/\/+$/, '');
  return `${base}/app/accounts/${accountId}/conversations`;
}

function AtendimentoInner() {
  const me = useMe();
  const [fullscreen, setFullscreen] = useState(false);

  const chatwootUrl = useMemo(
    () => buildChatwootUrl(me?.chatwoot_url, me?.chatwoot_account_id),
    [me?.chatwoot_url, me?.chatwoot_account_id],
  );

  if (!me) return null;

  return (
    <>
      {/* Normal layout */}
      <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-4">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
              Atendimento
            </p>
            <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
              Atendimento
            </h1>
            <p className="text-[14px] text-zinc-500 mt-1.5">
              Conversas WhatsApp em tempo real.
            </p>
          </div>

          {chatwootUrl && (
            <a
              href={chatwootUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium border border-black/[0.08] bg-white text-zinc-700 hover:text-zinc-900 hover:border-black/[0.18] transition-colors self-start sm:self-end"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Nova aba
            </a>
          )}
        </div>

        {chatwootUrl ? (
          <motion.div
            layoutId="chatwoot-frame"
            className="flex-1 min-h-0 overflow-hidden rounded-xl border border-black/[0.07] bg-white relative"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          >
            <iframe
              src={chatwootUrl}
              title="Atendimento Chatwoot"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
            {/* Overlay intercepts clicks to trigger fullscreen */}
            <motion.div
              className="absolute inset-0 cursor-pointer flex items-center justify-center"
              onClick={() => setFullscreen(true)}
              whileHover={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium text-zinc-500"
                style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <Maximize2 className="w-3 h-3" />
                Clique para expandir
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {fullscreen && chatwootUrl && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            <motion.div
              layoutId="chatwoot-frame"
              className="fixed z-50 overflow-hidden bg-white"
              style={{
                inset: '12px',
                borderRadius: '16px',
                boxShadow: '0 32px 80px -20px rgba(0,0,0,0.35)',
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            >
              <iframe
                src={chatwootUrl}
                title="Atendimento Chatwoot"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />

              <motion.button
                type="button"
                onClick={() => setFullscreen(false)}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium text-zinc-700 transition-colors"
                style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 8px rgba(0,0,0,0.12)' }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: 0.18 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Minimizar
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.10] bg-white p-12 text-center">
      <div
        className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
      >
        <Headphones className="w-5 h-5" />
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 mb-1.5">
        Atendimento ainda não configurado
      </p>
      <p className="text-[13px] text-zinc-500 max-w-md mx-auto leading-relaxed">
        O Chatwoot não está configurado para este tenant. Fale com a equipe Singulare para
        habilitar o atendimento WhatsApp em tempo real.
      </p>
      <div className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
        <MessageCircle className="w-3.5 h-3.5" />
        <span>Enquanto isso, o agente IA continua respondendo automaticamente.</span>
      </div>
    </div>
  );
}

export default function AtendimentoPage() {
  return (
    <Suspense
      fallback={
        <div className="h-8 w-8 rounded-full border-2 border-zinc-200 animate-spin" style={{ borderTopColor: ACCENT }} />
      }
    >
      <AtendimentoInner />
    </Suspense>
  );
}
