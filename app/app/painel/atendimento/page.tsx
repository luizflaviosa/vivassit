'use client';

import { Suspense, useMemo } from 'react';
import { ExternalLink, Headphones, MessageCircle } from 'lucide-react';
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

  const chatwootUrl = useMemo(
    () => buildChatwootUrl(me?.chatwoot_url, me?.chatwoot_account_id),
    [me?.chatwoot_url, me?.chatwoot_account_id],
  );

  if (!me) return null;

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
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
            Abrir em nova aba
          </a>
        )}
      </header>

      {chatwootUrl ? (
        <div
          className="overflow-hidden rounded-xl border border-black/[0.07] bg-white"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(15,15,30,0.08)' }}
        >
          <iframe
            src={chatwootUrl}
            title="Atendimento Chatwoot"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
            style={{
              width: '100%',
              height: 'calc(100vh - 200px)',
              minHeight: '560px',
              border: 'none',
              display: 'block',
            }}
          />
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
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
