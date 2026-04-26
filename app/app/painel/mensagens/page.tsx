'use client';

import { useEffect, useState, Suspense } from 'react';
import { Loader2, MessageCircle, Bot, User } from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface MessageRow {
  id: number;
  session_id: string;
  message: {
    type?: string;
    content?: string;
    data?: { content?: string };
    text?: string;
  };
  created_at: string;
}

function extractText(m: MessageRow['message']): string {
  if (!m) return '';
  return m.content ?? m.data?.content ?? m.text ?? '';
}
function extractRole(m: MessageRow['message']): 'human' | 'ai' | 'system' {
  const t = (m?.type ?? '').toLowerCase();
  if (t.includes('human') || t === 'user') return 'human';
  if (t.includes('ai') || t === 'assistant') return 'ai';
  return 'system';
}

function MensagensInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; unique_sessions: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const url = selectedSession
          ? `/api/painel/mensagens?session=${encodeURIComponent(selectedSession)}&limit=200`
          : '/api/painel/mensagens?limit=50';
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
          setMessages(json.messages);
          setSummary(json.summary);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, selectedSession]);

  if (!tenantId) return null;

  // Agrupa por sessão (conversa)
  const sessions = Array.from(new Set(messages.map((m) => m.session_id)));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Conversas
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Mensagens
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Histórico de conversas do agente IA com pacientes via WhatsApp.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-black/[0.07] bg-white p-4">
            <div className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 leading-none">{summary.total}</div>
            <div className="text-[12px] text-zinc-500 mt-1.5">Mensagens (últimas 50)</div>
          </div>
          <div className="rounded-xl border border-black/[0.07] bg-white p-4">
            <div className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 leading-none">{summary.unique_sessions}</div>
            <div className="text-[12px] text-zinc-500 mt-1.5">Conversas distintas</div>
          </div>
        </div>
      )}

      {selectedSession && (
        <button
          onClick={() => setSelectedSession(null)}
          className="text-[13px] font-semibold text-zinc-700 hover:text-zinc-900 inline-flex items-center gap-1.5"
          style={{ color: ACCENT_DEEP }}
        >
          ← Voltar pra todas as conversas
        </button>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState />
      ) : selectedSession ? (
        // Vista de uma conversa
        <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6 space-y-3">
          {messages
            .slice()
            .reverse()
            .map((m) => {
              const role = extractRole(m.message);
              const text = extractText(m.message);
              const isAi = role === 'ai';
              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${isAi ? '' : 'flex-row-reverse'}`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isAi ? '' : 'bg-zinc-100 text-zinc-700'
                    }`}
                    style={isAi ? { background: ACCENT_SOFT, color: ACCENT_DEEP } : undefined}
                  >
                    {isAi ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                      isAi ? 'bg-zinc-100 text-zinc-900 rounded-tl-sm' : 'text-white rounded-tr-sm'
                    }`}
                    style={!isAi ? { background: ACCENT_DEEP } : undefined}
                  >
                    {text || <em className="opacity-50">[mensagem vazia]</em>}
                  </div>
                </div>
              );
            })}
          <p className="text-[11px] text-zinc-400 text-center pt-2">
            Sessão {selectedSession.slice(0, 12)}…
          </p>
        </div>
      ) : (
        // Lista de conversas (sessions)
        <div className="space-y-2">
          {sessions.map((sid) => {
            const sessionMsgs = messages.filter((m) => m.session_id === sid);
            const last = sessionMsgs[0];
            return (
              <button
                key={sid}
                onClick={() => setSelectedSession(sid)}
                className="w-full text-left rounded-xl border border-black/[0.07] bg-white p-4 hover:border-black/[0.15] transition-colors flex items-center gap-3"
              >
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
                >
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900 truncate">{sid}</p>
                  <p className="text-[12px] text-zinc-500 truncate mt-0.5">{extractText(last.message)}</p>
                </div>
                <span className="text-[11px] text-zinc-400 flex-shrink-0">
                  {sessionMsgs.length} msgs
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
        <MessageCircle className="w-5 h-5 text-zinc-400" />
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 mb-1">Nenhuma mensagem</p>
      <p className="text-[13px] text-zinc-500 max-w-md mx-auto">
        Conversas do agente IA com seus pacientes vão aparecer aqui assim que ele começar a
        responder no WhatsApp.
      </p>
    </div>
  );
}

export default function MensagensPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <MensagensInner />
    </Suspense>
  );
}
