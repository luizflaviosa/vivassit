// app/app/profissionais/[cidade]/[especialidade]/page.tsx
//
// SEO local pra busca tipo "reumatologista jundiaí". A página combina:
// - title/description targeting `[especialidade] em [cidade]`
// - JSON-LD schema MedicalBusiness/Physician + ItemList dos profissionais
// - Breadcrumb estruturado
// - Copy on-page com keyword principal + variações
// - Lista de vitrines publicadas

import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { getPublishedVitrineProfiles } from '@/lib/marketing-queries';
import { PROFESSIONAL_TYPES } from '@/lib/types';

interface Props {
  params: { cidade: string; especialidade: string };
}

const SITE_URL = 'https://singulare.org';

// "sao-paulo" → "São Paulo" (capitalize palavras)
function humanizeCity(slug: string): string {
  return decodeURIComponent(slug)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = humanizeCity(params.cidade);
  const specKey = params.especialidade;
  const specLabel = PROFESSIONAL_TYPES[specKey as keyof typeof PROFESSIONAL_TYPES] ?? specKey;

  const title = `${specLabel} em ${city} — Agende sua consulta | Singulare`;
  const description = `Encontre os melhores profissionais de ${specLabel.toLowerCase()} em ${city}. Avaliações verificadas, agendamento via WhatsApp em minutos.`;
  const canonical = `${SITE_URL}/profissionais/${params.cidade}/${specKey}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CitySpecialtyPage({ params }: Props) {
  const city = humanizeCity(params.cidade);
  const specKey = params.especialidade;
  const specLabel = PROFESSIONAL_TYPES[specKey as keyof typeof PROFESSIONAL_TYPES] ?? specKey;
  const specLower = specLabel.toLowerCase();

  const profiles = await getPublishedVitrineProfiles(city, specKey);

  // Schema.org: BreadcrumbList + ItemList de Physicians + WebPage
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Profissionais', item: `${SITE_URL}/profissionais` },
      { '@type': 'ListItem', position: 3, name: city, item: `${SITE_URL}/profissionais/${params.cidade}` },
      {
        '@type': 'ListItem',
        position: 4,
        name: specLabel,
        item: `${SITE_URL}/profissionais/${params.cidade}/${specKey}`,
      },
    ],
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${specLabel} em ${city}`,
    numberOfItems: profiles.length,
    itemListElement: profiles.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Physician',
        name: p.display_name,
        medicalSpecialty: p.specialty,
        url: `${SITE_URL}/p/${p.slug}`,
        ...(p.photo_url ? { image: p.photo_url } : {}),
        ...(p.avg_nps
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: p.avg_nps,
                bestRating: 10,
                worstRating: 0,
                ratingCount: 1,
              },
            }
          : {}),
      },
    })),
  };

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Breadcrumb visual */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-zinc-500 mb-6">
          <Link href="/" className="hover:text-zinc-900">Início</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/profissionais" className="hover:text-zinc-900">Profissionais</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-700">{city}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-900 font-medium">{specLabel}</span>
        </nav>

        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">
          {specLabel} em {city}
        </h1>
        <p className="text-zinc-500 mt-2 mb-6">
          {profiles.length} profissional{profiles.length !== 1 ? 'is' : ''} encontrado{profiles.length !== 1 ? 's' : ''}
        </p>

        {/* Copy on-page targetando a keyword + variações */}
        <div className="prose prose-zinc max-w-none mb-10">
          <p className="text-[15px] leading-relaxed text-zinc-700">
            Procurando {specLower} em {city}? Aqui você encontra profissionais
            disponíveis para consulta presencial e online, com agendamento direto via WhatsApp,
            confirmação automática e atendimento de retorno em até 30 dias.
          </p>
          <p className="text-[15px] leading-relaxed text-zinc-700 mt-3">
            Cada profissional tem um perfil verificado, NPS dos pacientes e valor de consulta
            transparente. Escolha o que faz mais sentido pra você.
          </p>
        </div>

        <div className="space-y-4">
          {profiles.map((p) => (
            <Link
              key={p.slug}
              href={`/p/${p.slug}`}
              className="block bg-white rounded-2xl border border-black/[0.06] p-6 hover:border-[#6E56CF]/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                {p.photo_url ? (
                  <Image
                    src={p.photo_url}
                    alt={`Foto de ${p.display_name}, ${p.specialty}`}
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-xl object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-xl font-medium text-[#6E56CF]" aria-hidden="true">
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
              Nenhum {specLower} cadastrado em {city} ainda. Seja o primeiro:{' '}
              <Link href="/onboarding" className="text-violet-700 hover:underline">
                cadastre seu consultório
              </Link>.
            </div>
          )}
        </div>

        {/* Sub-rodapé com keywords longas (ajuda SEO long-tail) */}
        <div className="mt-12 pt-8 border-t border-black/[0.06] text-[13px] text-zinc-400 leading-relaxed">
          <p>
            Buscas relacionadas: {specLower} {city.toLowerCase()} unimed,
            {' '}{specLower} {city.toLowerCase()} convênio,
            {' '}consulta {specLower} valor,
            {' '}{specLower} perto de mim,
            {' '}clínica {specLower} {city.toLowerCase()}.
          </p>
        </div>
      </div>
    </main>
  );
}
