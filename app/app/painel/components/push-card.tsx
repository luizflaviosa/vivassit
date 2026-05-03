'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check, Loader2, Send, Share, Plus, Smartphone } from 'lucide-react';
import { detectPushStatus, subscribePush, unsubscribePush, type PushStatus } from '@/lib/push-client';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
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
      <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/40 via-white to-white p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}>
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-zinc-900">Instale o app pra receber notificações</h3>
            <p className="text-[13px] text-zinc-500 mt-0.5 leading-relaxed">
              No iPhone, o Safari só envia notificações quando o Singulare está instalado na Tela de Início.
            </p>
            <ol className="mt-3 space-y-2 text-[12.5px] text-zinc-700">
              {[
                <span key="1">Toque em <span className="inline-flex items-center gap-1 font-medium text-zinc-900"><Share className="w-3.5 h-3.5" />Compartilhar</span> na barra do Safari.</span>,
                <span key="2">Toque em <span className="inline-flex items-center gap-1 font-medium text-zinc-900"><Plus className="w-3.5 h-3.5" />Adicionar à Tela de Início</span>.</span>,
                <span key="3">Abra pelo ícone e ative as notificações aqui.</span>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-semibold text-[11px]">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="text-[11.5px] text-zinc-400 mt-3">Requer iOS/iPadOS 16.4 ou superior.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unsupported') {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-zinc-100 inline-flex items-center justify-center text-zinc-400 flex-shrink-0">
          <BellOff className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-900">Notificações não suportadas</h3>
          <p className="text-[13px] text-zinc-500 mt-0.5">Abra o Singulare no Chrome, Edge, Firefox ou Safari para ativar.</p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-rose-100 inline-flex items-center justify-center text-rose-500 flex-shrink-0">
          <BellOff className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-rose-900">Notificações bloqueadas</h3>
          <p className="text-[13px] text-rose-700/80 mt-0.5">Libere pelo cadeado ao lado da URL → Notificações → Permitir.</p>
        </div>
      </div>
    );
  }

  const isOn = status === 'granted-subbed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}>
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-zinc-900 leading-tight">Notificações</p>
            <p className="text-[12px] text-zinc-400 leading-tight">Alertas no celular ou desktop</p>
          </div>
        </div>

        {/* Toggle on/off */}
        <button
          type="button"
          onClick={isOn ? disable : enable}
          disabled={loading || (!isOn && !vapid)}
          className="relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 disabled:opacity-50 focus:outline-none"
          style={{ background: isOn ? ACCENT : '#E4E4E7' }}
          aria-label={isOn ? 'Desativar notificações' : 'Ativar notificações'}
        >
          <span
            className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: isOn ? 'translateX(20px)' : 'translateX(0)' }}
          />
          {loading && <Loader2 className="absolute inset-0 m-auto w-3 h-3 text-white animate-spin" />}
        </button>
      </div>

      {/* Tipos em grid 2 colunas */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {NOTIF_TYPES.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-[12.5px] text-zinc-600">
            <span className="text-[15px] leading-none flex-shrink-0">{it.icon}</span>
            <span className="leading-snug">{it.label}</span>
          </div>
        ))}
      </div>

      {/* Footer com status + botão testar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-black/[0.05] bg-zinc-50/60">
        {isOn ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: ACCENT_DEEP }}>
            <Check className="w-3.5 h-3.5" /> Ativadas
          </span>
        ) : (
          <span className="text-[12px] text-zinc-400">Desativadas</span>
        )}

        {isOn && (
          <button
            type="button"
            onClick={test}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-medium text-zinc-600 border border-black/[0.08] bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {sentTest ? <><Check className="w-3 h-3 text-emerald-500" /> Enviada</> : <><Send className="w-3 h-3" /> Testar</>}
          </button>
        )}

        {!vapid && (
          <span className="text-[11px] text-zinc-400">Push não configurado no servidor.</span>
        )}
      </div>
    </motion.div>
  );
}
