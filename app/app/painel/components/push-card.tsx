'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check, Loader2, Send } from 'lucide-react';
import { detectPushStatus, subscribePush, unsubscribePush, type PushStatus } from '@/lib/push-client';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

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

  if (status === 'unsupported') {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-100 inline-flex items-center justify-center text-zinc-500 flex-shrink-0">
            <BellOff className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-zinc-900">Notificações</h3>
            <p className="text-[13px] text-zinc-500 mt-0.5">
              Este navegador não suporta push. Use Chrome, Edge, Safari (iOS 16.4+) ou instale o app pela tela inicial.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-rose-100 inline-flex items-center justify-center text-rose-600 flex-shrink-0">
            <BellOff className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-rose-900">Notificações bloqueadas</h3>
            <p className="text-[13px] text-rose-700/80 mt-0.5">
              Você bloqueou notificações deste site no navegador. Libere pelo cadeado ao lado da URL → Notificações → Permitir.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOn = status === 'granted-subbed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/40 via-white to-white p-5"
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-white flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
        >
          <Bell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-zinc-900">Notificações</h3>
          <p className="text-[13px] text-zinc-500 mt-0.5 leading-relaxed">
            Receba alertas no celular ou desktop quando algo importante acontecer: novo paciente,
            confirmação de pagamento, IA pedindo sua intervenção e mais.
          </p>
        </div>
      </div>

      {/* Tipos de notificação que vai receber */}
      <ul className="space-y-1.5 mb-4 text-[12.5px] text-zinc-700">
        {[
          { icon: '👤', label: 'Novo paciente entrou no WhatsApp' },
          { icon: '📅', label: 'Consulta agendada ou cancelada pela IA' },
          { icon: '💸', label: 'Pagamento confirmado ou atrasado' },
          { icon: '⭐', label: 'NPS ou avaliação recebida' },
          { icon: '🆘', label: 'IA pediu sua intervenção' },
          { icon: '🌅', label: 'Resumo da agenda do dia (manhã)' },
        ].map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            <span className="w-5 text-center">{it.icon}</span>
            {it.label}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        {isOn ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-semibold"
              style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
            >
              <Check className="w-3.5 h-3.5" /> Ativadas
            </span>
            <button
              type="button"
              onClick={test}
              disabled={loading}
              className="h-9 px-3 rounded-lg text-[12.5px] font-medium text-zinc-700 border border-black/[0.10] hover:bg-zinc-50 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {sentTest ? (
                <><Check className="w-3.5 h-3.5" /> Enviada</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Testar</>
              )}
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={loading}
              className="h-9 px-3 rounded-lg text-[12.5px] font-medium text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60 ml-auto"
            >
              Desativar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={loading || !vapid}
            className="h-10 px-5 rounded-lg text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Ativar notificações
          </button>
        )}
      </div>
      {!vapid && (
        <p className="text-[11px] text-zinc-400 mt-2">
          Push ainda não está configurado no servidor — fale com o admin.
        </p>
      )}
    </motion.div>
  );
}
