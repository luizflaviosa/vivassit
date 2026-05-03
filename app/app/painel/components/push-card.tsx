'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check, Loader2, Send, Share, Plus, Smartphone } from 'lucide-react';
import { detectPushStatus, subscribePush, unsubscribePush, type PushStatus } from '@/lib/push-client';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

const NOTIF_TYPES = [
  { icon: '👤', label: 'Novo paciente' },
  { icon: '📅', label: 'Agenda' },
  { icon: '💸', label: 'Pagamento' },
  { icon: '⭐', label: 'NPS' },
  { icon: '🆘', label: 'Intervenção IA' },
  { icon: '🌅', label: 'Resumo diário' },
];

export default function PushCard() {
  const [status, setStatus] = useState<PushStatus>('default');
  const [vapid, setVapid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTest, setSentTest] = useState(false);

  useEffect(() => {
    detectPushStatus().then(setStatus);
    fetch('/api/push/vapid')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.publicKey && setVapid(j.publicKey))
      .catch(() => {});
  }, []);

  const enable = async () => {
    if (!vapid) return;
    setLoading(true);
    const ok = await subscribePush(vapid);
    if (ok) setStatus('granted-subbed');
    setLoading(false);
  };

  const disable = async () => {
    setLoading(true);
    await unsubscribePush();
    setStatus('granted-no-sub');
    setLoading(false);
  };

  const test = async () => {
    setLoading(true);
    await fetch('/api/push/test', { method: 'POST' }).catch(() => {});
    setSentTest(true);
    setTimeout(() => setSentTest(false), 3000);
    setLoading(false);
  };

  if (status === 'ios-needs-pwa') {
    return (
      <div className="rounded-xl border border-violet-200/60 bg-violet-50/30 p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}>
          <Smartphone className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900">Instale o app para notificações</p>
          <ol className="mt-2 space-y-1.5 text-[12px] text-zinc-600">
            {[
              <span key="1">Toque em <Share className="w-3 h-3 inline" /> <b>Compartilhar</b> no Safari</span>,
              <span key="2">Toque em <Plus className="w-3 h-3 inline" /> <b>Adicionar à Tela de Início</b></span>,
              <span key="3">Abra pelo ícone e ative aqui</span>,
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-bold text-[10px] mt-0.5">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-zinc-400 mt-2">Requer iOS 16.4+</p>
        </div>
      </div>
    );
  }

  if (status === 'unsupported') {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-white p-4 flex items-center gap-3">
        <BellOff className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        <p className="text-[12.5px] text-zinc-500">Navegador não suporta notificações. Use Chrome, Edge ou Safari.</p>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 flex items-center gap-3">
        <BellOff className="w-4 h-4 text-rose-400 flex-shrink-0" />
        <p className="text-[12.5px] text-rose-700">Notificações bloqueadas. Libere pelo cadeado na barra de URL.</p>
      </div>
    );
  }

  const isOn = status === 'granted-subbed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-black/[0.07] bg-white"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {/* Header linha única */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.05]">
        <div className="h-7 w-7 rounded-md inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}>
          <Bell className="w-3.5 h-3.5" />
        </div>
        <p className="flex-1 text-[13.5px] font-semibold text-zinc-900">Notificações</p>

        {/* Toggle */}
        <button
          type="button"
          onClick={isOn ? disable : enable}
          disabled={loading || (!isOn && !vapid)}
          className="relative h-5 w-9 rounded-full transition-colors duration-200 disabled:opacity-40 flex-shrink-0"
          style={{ background: isOn ? ACCENT : '#D4D4D8' }}
          aria-label={isOn ? 'Desativar' : 'Ativar'}
        >
          <span
            className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: isOn ? 'translateX(16px)' : 'translateX(0)' }}
          />
          {loading && <Loader2 className="absolute inset-0 m-auto w-2.5 h-2.5 text-white animate-spin" />}
        </button>
      </div>

      {/* Tipos em linha — chips compactos */}
      <div className="px-4 py-3 flex flex-wrap gap-1.5">
        {NOTIF_TYPES.map((it) => (
          <span
            key={it.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] text-zinc-600 border border-black/[0.07] bg-zinc-50"
          >
            <span className="text-[12px]">{it.icon}</span>
            {it.label}
          </span>
        ))}
      </div>

      {/* Footer */}
      {isOn && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-black/[0.05] bg-zinc-50/60">
          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: ACCENT_DEEP }}>
            <Check className="w-3 h-3" /> Ativas
          </span>
          <button
            type="button"
            onClick={test}
            disabled={loading}
            className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md text-[11.5px] font-medium text-zinc-600 border border-black/[0.08] bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {sentTest ? <><Check className="w-3 h-3 text-emerald-500" /> Enviada</> : <><Send className="w-3 h-3" /> Testar</>}
          </button>
        </div>
      )}
    </motion.div>
  );
}
