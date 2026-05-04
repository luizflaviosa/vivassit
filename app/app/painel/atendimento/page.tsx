'use client';

import { Suspense, useMemo, useEffect } from 'react';
import { ExternalLink, Headphones, MessageCircle, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();

  useEffect(() => {
    const handler = () => {}; // já está na página, não precisa fazer nada
    window.addEventListener('singulare:atendimento-focus', handler);
    return () => window.removeEventListener('singulare:atendimento-focus', handler);
  }, []);

  const minimize = () => router.push('/painel');

  const chatwootUrl = useMemo(
    () => buildChatwootUrl(me?.chatwoot_url, me?.chatwoot_account_id),
    [me?.chatwoot_url, me?.chatwoot_account_id],
  );

  if (!me) return null;

  if (!chatwootUrl) return <EmptyState />;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
      />

      <motion.div
        className="fixed z-50 overflow-hidden bg-white"
        style={{
          inset: '12px',
          borderRadius: '16px',
          boxShadow: '0 32px 80px -20px rgba(0,0,0,0.35)',
        }}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <iframe
          src={chatwootUrl}
          title="Atendimento Chatwoot"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />

        <div className="absolute inset-0 pointer-events-none flex items-end justify-end pb-16 pr-5">
          <motion.button
            type="button"
            onClick={minimize}
            className="pointer-events-auto inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-[12px] font-medium text-zinc-700"
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 16px rgba(0,0,0,0.14)' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Minimizar
          </motion.button>
        </div>

        <a
          href={chatwootUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 pointer-events-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11.5px] font-medium text-zinc-600"
          style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 8px rgba(0,0,0,0.10)' }}
        >
          <ExternalLink className="w-3 h-3" />
          Nova aba
        </a>
      </motion.div>
    </AnimatePresence>
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
