'use client';

import { Suspense } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

function AgendaInner() {
  const me = useMe();
  if (!me?.tenant_id) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Agendamentos
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Agenda
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Sua agenda é sincronizada diretamente com o Google Calendar — onde o agente IA
          marca as consultas dos seus pacientes.
        </p>
      </div>

      <div className="rounded-2xl border border-black/[0.07] bg-white p-6 sm:p-10 text-center">
        <div
          className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-5"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-[18px] font-semibold text-zinc-900 mb-2">
          Sua agenda vive no Google Calendar
        </h2>
        <p className="text-[14px] text-zinc-500 max-w-md mx-auto mb-6 leading-relaxed">
          Acesse pelo seu Google Calendar habitual ou pelo aplicativo do celular. O agente IA
          cria, confirma e cancela eventos automaticamente.
        </p>
        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-lg text-white text-[14px] font-semibold transition-all hover:brightness-110"
          style={{
            background: `linear-gradient(180deg, ${ACCENT_DEEP}, ${ACCENT_DEEP})`,
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.18) inset, 0 6px 18px -6px rgba(110,86,207,0.55)',
          }}
        >
          Abrir Google Calendar
          <ExternalLink className="w-4 h-4" />
        </a>

        <p className="text-[12px] text-zinc-400 mt-6">
          Em breve: visualização de agenda integrada aqui no painel.
        </p>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <AgendaInner />
    </Suspense>
  );
}
