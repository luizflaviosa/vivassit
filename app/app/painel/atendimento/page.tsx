'use client';

import { Suspense, useMemo, useState, useRef, useEffect } from 'react';
import { ExternalLink, Headphones, MessageCircle, AlertTriangle, RefreshCw } from 'lucide-react';
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
  const [iframeState, setIframeState] = useState<'loading' | 'ok' | 'blocked'>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatwootUrl = useMemo(
    () => buildChatwootUrl(me?.chatwoot_url, me?.chatwoot_account_id),
    [me?.chatwoot_url, me?.chatwoot_account_id],
  );

  // Reset state when URL changes
  useEffect(() => {
    if (!chatwootUrl) return;
    setIframeState('loading');
    // If the iframe loads but content is blocked (X-Frame-Options), the onLoad still fires
    // but the document is inaccessible. We detect this via a short timeout check.
    timeoutRef.current = setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;
        // Accessing contentDocument throws SecurityError if X-Frame-Options blocked cross-origin
        const doc = iframe.contentDocument;
        // If doc is null and we're still "loading", it may be blocked
        if (doc === null) setIframeState('blocked');
      } catch {
        setIframeState('blocked');
      }
    }, 5000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [chatwootUrl]);

  function handleLoad() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      const doc = iframeRef.current?.contentDocument;
      // Same-origin: doc is accessible → loaded ok
      // Cross-origin success: doc exists but we can't read it → that's normal for cross-origin OK loads
      // Cross-origin blocked: doc is null
      if (doc === null) {
        setIframeState('blocked');
      } else {
        setIframeState('ok');
      }
    } catch {
      // SecurityError = cross-origin but loaded (not blocked by X-Frame-Options, just CORS)
      setIframeState('ok');
    }
  }

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
          {iframeState === 'blocked' ? (
            <BlockedState url={chatwootUrl} onRetry={() => setIframeState('loading')} />
          ) : (
            <iframe
              ref={iframeRef}
              key={chatwootUrl}
              src={chatwootUrl}
              title="Atendimento Chatwoot"
              onLoad={handleLoad}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
              style={{
                width: '100%',
                height: 'calc(100vh - 200px)',
                minHeight: '560px',
                border: 'none',
                display: 'block',
                opacity: iframeState === 'loading' ? 0 : 1,
                transition: 'opacity 0.3s ease',
              }}
            />
          )}
          {iframeState === 'loading' && (
            <div
              className="flex flex-col items-center justify-center gap-3 text-zinc-400"
              style={{ height: 'calc(100vh - 200px)', minHeight: '560px', marginTop: 'calc(-100vh + 200px)' }}
            >
              <div className="h-6 w-6 rounded-full border-2 border-zinc-200 animate-spin" style={{ borderTopColor: ACCENT }} />
              <span className="text-[13px]">Carregando Chatwoot…</span>
            </div>
          )}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function BlockedState({ url, onRetry }: { url: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center" style={{ minHeight: '400px' }}>
      <div
        className="inline-flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: '#FEF3C7', color: '#D97706' }}
      >
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-zinc-900 mb-1.5">
          Chatwoot bloqueado pelo navegador
        </p>
        <p className="text-[13px] text-zinc-500 max-w-md leading-relaxed">
          O servidor do Chatwoot não permite ser exibido em iframe. Para resolver, adicione{' '}
          <code className="bg-zinc-100 rounded px-1 py-0.5 font-mono text-[12px] text-zinc-700">
            ALLOW_IFRAME_EMBEDDING=true
          </code>{' '}
          no <code className="bg-zinc-100 rounded px-1 py-0.5 font-mono text-[12px] text-zinc-700">.env</code> do Chatwoot e reinicie o serviço.
        </p>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-medium text-white transition-colors"
          style={{ background: ACCENT }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir Chatwoot em nova aba
        </a>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium border border-black/[0.08] text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </button>
      </div>
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
