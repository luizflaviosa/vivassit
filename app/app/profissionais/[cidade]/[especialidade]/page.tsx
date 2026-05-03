// app/app/profissionais/[cidade]/[especialidade]/page.tsx

import { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedVitrineProfiles } from '@/lib/marketing-queries';
import { PROFESSIONAL_TYPES } from '@/lib/types';

interface Props {
  params: { cidade: string; especialidade: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = decodeURIComponent(params.cidade).replace(/-/g, ' ');
  const specKey = params.especialidade;
  const specLabel = PROFESSIONAL_TYPES[specKey as keyof typeof PROFESSIONAL_TYPES] ?? specKey;

  const title = `${specLabel} em ${city} — Agende sua consulta | Singulare`;
  const description = `Encontre os melhores profissionais de ${specLabel.toLowerCase()} em ${city}. Avaliações verificadas e agendamento via WhatsApp.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function CitySpecialtyPage({ params }: Props) {
  const city = decodeURIComponent(params.cidade).replace(/-/g, ' ');
  const specKey = params.especialidade;
  const specLabel = PROFESSIONAL_TYPES[specKey as keyof typeof PROFESSIONAL_TYPES] ?? specKey;

  const profiles = await getPublishedVitrineProfiles(city, specKey);

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">
          {specLabel} em {city}
        </h1>
        <p className="text-zinc-500 mt-2 mb-8">
          {profiles.length} profissional{profiles.length !== 1 ? 'is' : ''} encontrado{profiles.length !== 1 ? 's' : ''}
        </p>

        <div className="space-y-4">
          {profiles.map((p) => (
            <Link
              key={p.slug}
              href={`/p/${p.slug}`}
              className="block bg-white rounded-2xl border border-black/[0.06] p-6 hover:border-[#6E56CF]/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.display_name} className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-xl font-medium text-[#6E56CF]">
                    {p.display_name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-medium text-zinc-900">{p.display_name}</h2>
                  <p className="text-sm text-zinc-500">{p.specialty}</p>
                </div>
                <div className="text-right">
                  {p.avg_nps && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                      {p.avg_nps.toFixed(1)}
                    </span>
                  )}
                  {p.consultation_value && (
                    <p className="text-xs text-zinc-400 mt-1">a partir de R$ {p.consultation_value}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {profiles.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              Nenhum profissional cadastrado nesta região ainda.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
