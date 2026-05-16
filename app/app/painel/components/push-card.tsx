'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check, Loader2, Send, Share, Plus, Smartphone } from 'lucide-react';
import { detectPushStatus, subscribePush, unsubscribePush, type PushStatus } from '@/lib/push-client';

const ACCENT = '#0F1B33';
const ACCENT_DEEP = '#0F1B33';
const ACCENT_SOFT = '#F5F3FF';

const NOTIF_TYPES = [
  { icon: '👤', label: 'Novo paciente no WhatsApp' },
  { icon: '📅', label: 'Consulta agendada ou cancelada' },
  { icon: '💸', label: 'Pagamento confirmado ou atrasado' },
  { icon: '⭐', label: 'NPS ou avaliação recebida' },
  { icon: '🆘', label: 'IA pediu sua intervenção' },
  { icon: '🌅', label: 'Resumo da agenda (manhã)' },
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
      <div className="rounded-xl border border-slate-200/60 bg-slate-50/30 p-4 flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}>
          <Smartphone className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900 mb-2">Instale o app para notificações</p>
          <ol className="space-y-1.5 text-[12px] text-zinc-600">
            {[
              <span key="1">Toque em <Share className="w-3 h-3 inline" /> <b>Compartilhar</b> no Safari</span>,
              <span key="2">Toque em <Plus className="w-3 h-3 inline" /> <b>Adicionar à Tela de Início</b></span>,
              <span key="3">Abra pelo ícone e ative aqui</span>,
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] mt-0.5">{i + 1}</span>
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
        <p className="text-[12.5px] text-rose-700">Bloqueadas pelo navegador. Libere pelo cadeado na barra de URL.</p>
      </div>
    );
  }

  const isOn = status === 'granted-subbed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200/50 overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #F9F7FF, #ffffff)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}>
          <Bell className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-zinc-900 leading-tight">Notificações</p>
          <p className="text-[12px] text-zinc-500 leading-tight">Alertas no celular ou desktop em tempo real</p>
        </div>
        {/* Toggle */}
        <button
          type="button"
          onClick={isOn ? disable : enable}
          disabled={loading || (!isOn && !vapid)}
          className="relative h-6 w-11 rounded-full transition-colors duration-200 disabled:opacity-40 flex-shrink-0"
          style={{ background: isOn ? ACCENT : '#D4D4D8' }}
          aria-label={isOn ? 'Desativar' : 'Ativar'}
        >
          <span
            className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: isOn ? 'translateX(20px)' : 'translateX(0)' }}
          />
          {loading && <Loader2 className="absolute inset-0 m-auto w-3 h-3 text-white animate-spin" />}
        </button>
      </div>

      {/* Lista 2 colunas */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-y-2 gap-x-3 border-t border-slate-100/60 pt-3">
        {NOTIF_TYPES.map((it) => (
          <div key={it.label} className="flex items-center gap-2">
            <span className="text-[14px] flex-shrink-0">{it.icon}</span>
            <span className="text-[12px] text-zinc-600 leading-snug">{it.label}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100/60" style={{ background: 'rgba(109,86,207,0.03)' }}>
        {isOn ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: ACCENT_DEEP }}>
              <Check className="w-3.5 h-3.5" /> Ativadas
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={test}
                disabled={loading}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-medium border border-black/[0.08] bg-white text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                {sentTest ? <><Check className="w-3 h-3 text-emerald-500" /> Enviada</> : <><Send className="w-3 h-3" /> Testar</>}
              </button>
              <button type="button" onClick={disable} disabled={loading} className="text-[11.5px] text-zinc-400 hover:text-rose-500 transition-colors disabled:opacity-50">
                Desativar
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={loading || !vapid}
            className="h-8 px-4 rounded-lg text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:brightness-110 transition-all disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            Ativar notificações
          </button>
        )}
        {!vapid && <span className="text-[11px] text-zinc-400">Push não configurado no servidor.</span>}
      </div>
    </motion.div>
  );
}
