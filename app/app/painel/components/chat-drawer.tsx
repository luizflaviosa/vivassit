'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Mic, MicOff, Bot, User, Sparkles, Loader2 } from 'lucide-react';

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
  'Cancelar última consulta',
];

// Web Speech API minimo type
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
  }, [messages, open]);

  // Foco no input ao abrir
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 200);
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

      // Optimistic UI: mensagem do user aparece IMEDIATAMENTE
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
          updateAiMsg(aiPlaceholder.id, `⚠️ ${errText || 'Sem resposta'}`);
          return;
        }

        // Stream chunks
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
          '⚠️ Sem conexão. Tenta de novo ou usa o Telegram por enquanto.'
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

  // ── Voz ──────────────────────────────────────────────────────────────────
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
      alert('Seu navegador não suporta voz. Usa Chrome ou Safari recente.');
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
        // Auto-send se o transcript for uma frase completa
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
    if (confirm('Limpar histórico desta conversa?')) {
      setMessages([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  return (
    <>
      {/* Bolha flutuante */}
      <AnimatePresence>
        {!open && (
          <motion.button
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
            {/* Backdrop mobile */}
            <motion.div
              className="md:hidden fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed z-50 bg-white shadow-[0_24px_64px_-16px_rgba(0,0,0,0.25)] flex flex-col
                         inset-x-0 bottom-0 top-16 rounded-t-2xl
                         md:inset-auto md:bottom-6 md:right-6 md:top-auto md:w-[420px] md:h-[640px] md:rounded-2xl md:max-h-[80vh]"
            >
              {/* Header */}
              <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.06]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                  >
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-zinc-900 truncate">Sua IA</p>
                    <p className="text-[11px] text-zinc-500">Online · responde em segundos</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={clear}
                    className="h-8 px-2 rounded-md text-[11px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04]"
                    title="Limpar histórico"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="h-9 w-9 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              </header>

              {/* Mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <EmptyChat onSuggestion={(s) => send(s)} />
                ) : (
                  messages.map((m) => <Bubble key={m.id} msg={m} />)
                )}
                {streaming && messages[messages.length - 1]?.text === '' && (
                  <TypingDots />
                )}
              </div>

              {/* Sugestões rápidas (só quando vazio ou poucas mensagens) */}
              {messages.length < 3 && messages.length > 0 && (
                <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={streaming}
                      className="flex-shrink-0 h-7 px-2.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[11px] font-medium text-zinc-700 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 px-4 py-3 border-t border-black/[0.06] bg-zinc-50/40"
              >
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={streaming}
                  className={`h-11 w-11 flex-shrink-0 rounded-full inline-flex items-center justify-center transition-all ${
                    recording
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-white border border-black/[0.10] text-zinc-700 hover:bg-zinc-50'
                  } disabled:opacity-50`}
                  aria-label={recording ? 'Parar gravação' : 'Falar'}
                >
                  {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={recording ? 'Ouvindo…' : 'Digite ou fale…'}
                  disabled={streaming || recording}
                  className="flex-1 min-w-0 h-11 px-4 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-full border border-black/10 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/[0.06] disabled:bg-zinc-50"
                />

                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  className="h-11 w-11 flex-shrink-0 rounded-full text-white inline-flex items-center justify-center transition-all hover:brightness-110 disabled:opacity-30"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                  aria-label="Enviar"
                >
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-zinc-200 text-zinc-600' : 'text-white'
        }`}
        style={!isUser ? { background: ACCENT_DEEP } : undefined}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={`max-w-[80%] px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
          isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm bg-zinc-100 text-zinc-900'
        }`}
        style={isUser ? { background: ACCENT_DEEP, color: 'white' } : undefined}
      >
        {msg.text || <span className="opacity-50">…</span>}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-white"
        style={{ background: ACCENT_DEEP }}
      >
        <Bot className="w-3.5 h-3.5" />
      </div>
      <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-3.5 py-3 inline-flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 bg-zinc-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyChat({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="text-center py-6">
      <div
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-3"
        style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
      >
        <Sparkles className="w-5 h-5" />
      </div>
      <p className="text-[15px] font-semibold text-zinc-900">Conversa direta com a IA</p>
      <p className="text-[12px] text-zinc-500 mt-1 mb-4 max-w-xs mx-auto">
        Pergunte qualquer coisa do seu negócio. Texto ou voz.
      </p>
      <div className="flex flex-wrap gap-1.5 justify-center px-4">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="h-8 px-3 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[12px] font-medium text-zinc-700 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
