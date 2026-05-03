// app/app/profissionais/page.tsx

import { Metadata } from 'next';
import Link from 'next/link';
import { PROFESSIONAL_TYPES } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Encontre seu profissional de saúde | Singulare',
  description: 'Diretório de profissionais de saúde com avaliações verificadas e agendamento via WhatsApp.',
};

export default function ProfissionaisRootPage() {
  const types = Object.entries(PROFESSIONAL_TYPES);

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">
          Encontre seu profissional de saúde
        </h1>
        <p className="text-zinc-500 mt-2 mb-8">
          Avaliações verificadas. Agendamento via WhatsApp.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {types.filter(([k]) => k !== 'outro').map(([key, label]) => (
            <Link
              key={key}
              href={`/profissionais/sao-paulo/${key}`}
              className="bg-white rounded-xl border border-black/[0.06] p-4 text-center hover:border-[#6E56CF]/20 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-700">{label as string}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
