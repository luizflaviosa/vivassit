'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const ACCENT_DEEP = '#5746AF';

// Renderiza banner "← voltar pro checklist" se a URL veio com ?from=checklist.
// Use no topo das páginas que aparecem no SetupChecklist.
export default function BackToChecklist() {
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');

  if (from !== 'checklist') return null;

  return (
    <Link
      href="/painel"
      className="inline-flex items-center gap-1.5 mb-4 px-3 py-2 rounded-lg text-[13px] font-medium text-white shadow-[0_4px_14px_-4px_rgba(110,86,207,0.45)] hover:brightness-110 transition-all"
      style={{ background: `linear-gradient(135deg, #6E56CF, ${ACCENT_DEEP})` }}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Voltar para o checklist
    </Link>
  );
}
