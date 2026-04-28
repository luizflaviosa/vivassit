'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, ArrowUp, Mic, MicOff, Bot, Sparkles, Loader2, Trash2 } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

const STORAGE_KEY = 'vivassit_chat_history_v1';
const MAX_HISTORY = 30;

interface Msg {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

const SUGGESTIONS = [
  'Minha agenda hoje',
  'Faturamento do mês',
  'Próximo paciente',
  'Reagendar última',
];

interface SpeechRecognitionResultLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionResultLike) => void;
  onend: () => void;
  onerror: (e: { error?: string }) => void;
  start: () => void;
  stop: () => void;
}

export default function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [unread, setUnread] = useState(0);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [capabilities, setCapabilities] = useState<string>('');
  const [clinicName, setClinicName] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Restore historico
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Msg[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_HISTORY));
      }
    } catch {
      // ignore
    }
  }, []);

  // Listen pra evento global (cmd+K → "Falar com IA interna" abre o chat)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('singulare:open-chat', handler);
    return () => window.removeEventListener('singulare:open-chat', handler);
  }, []);

  // Carrega capacidades do agente (single source of truth no BD)
  useEffect(() => {
    fetch('/api/interno/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setCapabilities(j.capabilities ?? '');
          setClinicName(j.clinic_name ?? '');
        }
      })
      .catch(() => {});
  }, []);

  // Persist historico
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {
      // quota exceeded - ignore
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, keyboardOffset]);

  // Foco no input ao abrir (desktop apenas — mobile não força foco pra evitar
  // teclado abrindo na hora errada)
  useEffect(() => {
    if (open) {
      setUnread(0);
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      if (isDesktop) {
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    }
  }, [open]);

  // iOS Safari: visualViewport encolhe quando o teclado abre. Calcula offset
  // pra empurrar a barra de composição acima do teclado (iOS < 16.4 não
  // respeita interactive-widget=resizes-content).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // Lock body scroll quando drawer abre no mobile (evita rubber-band atrás)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: Msg = {
        id: 'u-' + Date.now(),
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
      };

      const aiPlaceholder: Msg = {
        id: 'a-' + Date.now(),
        role: 'ai',
        text: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, aiPlaceholder]);
      setInput('');
      setStreaming(true);

      try {
        const res = await fetch('/api/interno/comando', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          }),
          keepalive: true,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '');
          updateAiMsg(aiPlaceholder.id, `Tive um problema (${res.status}). ${errText.slice(0, 80)}`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          updateAiMsg(aiPlaceholder.id, acc);
        }
      } catch (e) {
        updateAiMsg(
          aiPlaceholder.id,
          'Sem conexão agora. Tenta de novo em alguns segundos.'
        );
        console.error('[chat] erro:', e);
      } finally {
        setStreaming(false);
        if (!open) setUnread((u) => u + 1);
      }
    },
    [streaming, messages, open]
  );

  const updateAiMsg = (id: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text } : m))
    );
  };

  const toggleVoice = () => {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert('Seu navegador não suporta voz. Use Chrome ou Safari recente.');
      return;
    }

    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setInput(transcript);
        setTimeout(() => send(transcript), 200);
      }
    };
    rec.onerror = (e) => {
      console.warn('[voice]', e.error);
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    rec.start();
    setRecording(true);
    recognitionRef.current = rec;
  };

  const clear = () => {
    if (confirm('Apagar este histórico?')) {
      setMessages([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  // Auto-grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (sem shift) envia. Em mobile, enterKeyHint=send mostra a tecla certa.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Bolha flutuante mobile */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab-m"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            onClick={() => setOpen(true)}
            className="md:hidden fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full text-white inline-flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(110,86,207,0.6)]"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
            aria-label="Abrir conversa"
          >
            <MessageCircle className="w-6 h-6" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-semibold flex items-center justify-center">
                {unread}
              </span>
            )}
          </motion.button>
        )}
        {!open && (
          <motion.button
            key="fab-d"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            onClick={() => setOpen(true)}
            className="hidden md:inline-flex fixed bottom-6 right-6 z-40 h-14 px-5 rounded-full text-white items-center gap-2 shadow-[0_8px_24px_-8px_rgba(110,86,207,0.6)] hover:brightness-110 transition-all"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[14px] font-semibold">Falar com a IA</span>
            {unread > 0 && (
              <span className="ml-1 h-5 min-w-[20px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-semibold flex items-center justify-center">
                {unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop só no desktop (mobile vira full-screen) */}
            <motion.div
              key="bd"
              className="hidden md:block fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              key="dr"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-50 bg-[#FAFAF7] flex flex-col
                         inset-0 h-[100dvh]
                         md:inset-auto md:bottom-6 md:right-6 md:w-[420px] md:h-[640px]
                         md:rounded-2xl md:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.25)] md:max-h-[80vh] md:bg-white"
            >
              {/* Header sticky com blur — fica fixo mesmo com teclado aberto */}
              <header
                className="flex-shrink-0 sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-white/85 backdrop-blur-xl border-b border-black/[0.06]"
                style={{ paddingTop: `max(12px, env(safe-area-inset-top))` }}
              >
                <button
                  onClick={() => setOpen(false)}
                  className="md:hidden h-10 w-10 -ml-2 rounded-full hover:bg-black/[0.04] inline-flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5 text-zinc-700" />
                </button>

                <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-initial">
                  <div className="relative h-9 w-9 flex-shrink-0">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white"
                      style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                    >
                      <Bot className="w-4 h-4" />
                    </div>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-zinc-900 truncate leading-tight">Sua IA</p>
                    <p className="text-[11.5px] text-zinc-500 leading-tight">
                      {streaming ? 'digitando…' : 'online · responde em segundos'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {messages.length > 0 && (
                    <button
                      onClick={clear}
                      className="h-10 w-10 rounded-full hover:bg-black/[0.04] inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900"
                      aria-label="Apagar histórico"
                      title="Apagar histórico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="hidden md:inline-flex h-10 w-10 rounded-full hover:bg-black/[0.04] items-center justify-center"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              </header>

              {/* Mensagens — scroll só aqui */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {messages.length === 0 ? (
                  <EmptyChat
                    onSuggestion={(s) => send(s)}
                    capabilities={capabilities}
                    clinicName={clinicName}
                  />
                ) : (
                  messages.map((m, i) => (
                    <Bubble
                      key={m.id}
                      msg={m}
                      isFirst={i === 0 || messages[i - 1].role !== m.role}
                    />
                  ))
                )}
                {streaming && messages[messages.length - 1]?.text === '' && (
                  <TypingDots />
                )}
              </div>

              {/* Sugestões rápidas — só quando há 1-2 mensagens */}
              {messages.length > 0 && messages.length < 3 && (
                <div className="flex-shrink-0 px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={streaming}
                      className="flex-shrink-0 h-8 px-3 rounded-full bg-white border border-black/[0.08] text-[12px] font-medium text-zinc-700 hover:border-black/20 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Composer — fixo no fim, empurra acima do teclado em iOS antigo */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                style={{
                  paddingBottom: `max(12px, env(safe-area-inset-bottom))`,
                  marginBottom: keyboardOffset,
                  transition: 'margin-bottom 150ms ease',
                }}
                className="flex-shrink-0 px-3 pt-2 bg-white/95 backdrop-blur-xl border-t border-black/[0.05]"
              >
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={toggleVoice}
                    disabled={streaming}
                    className={`h-10 w-10 flex-shrink-0 rounded-full inline-flex items-center justify-center transition-colors ${
                      recording
                        ? 'bg-rose-500 text-white'
                        : 'bg-white border border-black/[0.10] text-zinc-700 hover:bg-zinc-50'
                    } disabled:opacity-50`}
                    aria-label={recording ? 'Parar gravação' : 'Falar'}
                  >
                    {recording ? (
                      <span className="relative inline-flex">
                        <MicOff className="w-4 h-4" />
                        <span className="absolute inset-0 -m-2 rounded-full border-2 border-rose-300 animate-ping" />
                      </span>
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 relative">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={recording ? 'Ouvindo…' : 'Mensagem'}
                      disabled={streaming || recording}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="sentences"
                      spellCheck={false}
                      className="w-full resize-none px-4 py-2.5 bg-zinc-100/80 text-[16px] sm:text-[14px] leading-snug text-zinc-900 placeholder:text-zinc-400 rounded-3xl border-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50 transition-colors max-h-[120px]"
                      style={{ minHeight: 40 }}
                      {...({ enterKeyHint: 'send' } as Record<string, string>)}
                    />
                  </div>

                  {/* Send: aparece em desktop sempre, e em mobile só quando há texto */}
                  <button
                    type="submit"
                    disabled={!input.trim() || streaming}
                    className={`h-10 w-10 flex-shrink-0 rounded-full text-white inline-flex items-center justify-center transition-all ${
                      input.trim() ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none md:opacity-30 md:scale-100 md:pointer-events-auto'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                    aria-label="Enviar"
                  >
                    {streaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ msg, isFirst }: { msg: Msg; isFirst: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[82%] px-3.5 py-2 text-[15px] sm:text-[14px] leading-[1.4] whitespace-pre-wrap break-words ${
          isUser
            ? `text-white rounded-[20px] ${isFirst ? '' : 'rounded-tr-md'} rounded-br-md`
            : `bg-white border border-black/[0.05] text-zinc-900 rounded-[20px] ${isFirst ? '' : 'rounded-tl-md'} rounded-bl-md shadow-[0_1px_2px_rgba(0,0,0,0.03)]`
        }`}
        style={isUser ? { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` } : undefined}
      >
        {msg.text || <span className="opacity-40">…</span>}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="bg-white border border-black/[0.05] rounded-[20px] rounded-bl-md px-4 py-3 inline-flex gap-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 bg-zinc-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function EmptyChat({
  onSuggestion,
  capabilities,
  clinicName,
}: {
  onSuggestion: (s: string) => void;
  capabilities: string;
  clinicName: string;
}) {
  return (
    <div className="flex flex-col items-center text-center pt-10 pb-6 px-5">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
      >
        <Sparkles className="w-6 h-6" strokeWidth={1.75} />
      </motion.div>

      {/* Saudação dinâmica vinda do BD (tenants.internal_agent_capabilities) */}
      {capabilities ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="w-full max-w-[320px] text-left bg-white border border-black/[0.05] rounded-2xl px-4 py-3.5 mb-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <CapabilitiesMarkdown text={capabilities} />
        </motion.div>
      ) : (
        <>
          <p className="text-[18px] font-medium text-zinc-900 tracking-tight">
            {clinicName ? `Olá, ${clinicName}` : 'Como posso ajudar?'}
          </p>
          <p className="text-[13.5px] text-zinc-500 mt-1.5 mb-6 max-w-[260px] leading-relaxed">
            Pergunte sobre agenda, pacientes, faturamento ou peça pra reagendar uma consulta.
          </p>
        </>
      )}

      <div className="flex flex-col gap-2 w-full max-w-[280px]">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.04, duration: 0.3 }}
            onClick={() => onSuggestion(s)}
            className="h-11 px-4 text-left text-[14px] font-medium text-zinc-800 bg-white border border-black/[0.07] rounded-xl hover:border-black/20 hover:bg-zinc-50 transition-colors"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Renderiza markdown leve (negrito **txt**, lista com bullet •) em parágrafos.
// Não usa lib externa pra manter o bundle leve.
function CapabilitiesMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-[14px] leading-[1.5] text-zinc-800">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-');
        const content = isBullet ? trimmed.slice(1).trim() : trimmed;
        const parts = content.split(/(\*\*[^*]+\*\*)/);
        return (
          <p key={i} className={isBullet ? 'pl-3.5 relative' : ''}>
            {isBullet && <span className="absolute left-0 text-zinc-400">•</span>}
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={j} className="font-semibold text-zinc-900">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}
