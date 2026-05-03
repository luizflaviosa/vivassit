// app/app/p/[slug]/page.tsx

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getVitrineBySlug } from '@/lib/marketing-queries';
import { logMarketingEvent } from '@/lib/marketing-queries';
import { PROFESSIONAL_TYPES } from '@/lib/types';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getVitrineBySlug(params.slug);
  if (!profile) return { title: 'Profissional não encontrado' };

  const profLabel = PROFESSIONAL_TYPES[profile.professional_type as keyof typeof PROFESSIONAL_TYPES] ?? profile.professional_type;
  const title = `${profile.display_name} — ${profLabel} em ${profile.city}`;
  const description = profile.bio
    ?? `${profLabel} em ${profile.city}. Agende sua consulta via WhatsApp.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(profile.photo_url ? { images: [profile.photo_url] } : {}),
    },
  };
}

export default async function VitrineProfilePage({ params }: Props) {
  const profile = await getVitrineBySlug(params.slug);
  if (!profile) notFound();

  // Log view event (fire-and-forget)
  logMarketingEvent(profile.tenant_id, 'vitrine_view', { slug: params.slug });

  const profLabel = PROFESSIONAL_TYPES[profile.professional_type as keyof typeof PROFESSIONAL_TYPES] ?? profile.professional_type;
  const npsDisplay = profile.avg_nps ? profile.avg_nps.toFixed(1) : null;

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: profile.display_name,
    medicalSpecialty: profile.specialty,
    address: {
      '@type': 'PostalAddress',
      addressLocality: profile.city,
      addressRegion: profile.state,
      addressCountry: 'BR',
    },
    ...(profile.avg_nps ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: profile.avg_nps,
        reviewCount: profile.review_count,
        bestRating: 10,
      },
    } : {}),
    ...(profile.photo_url ? { image: profile.photo_url } : {}),
  };

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-black/[0.06] p-8 mb-6">
          <div className="flex items-start gap-6">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.display_name}
                className="w-24 h-24 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[#F5F3FF] flex items-center justify-center text-3xl font-medium text-[#6E56CF]">
                {profile.display_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
                {profile.display_name}
              </h1>
              <p className="text-base text-zinc-500 mt-1">
                {profLabel} · {profile.specialty}
              </p>
              <p className="text-sm text-zinc-400 mt-0.5">
                {profile.city}, {profile.state}
              </p>
              {npsDisplay && (
                <p className="text-sm mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                    {npsDisplay} ({profile.review_count} avaliações)
                  </span>
                </p>
              )}
            </div>
          </div>

          {profile.bio && (
            <p className="mt-6 text-zinc-600 text-[15px] leading-relaxed">
              {profile.bio}
            </p>
          )}

          {profile.consultation_value && (
            <p className="mt-4 text-sm text-zinc-500">
              Consulta a partir de <span className="font-medium text-zinc-700">R$ {profile.consultation_value}</span>
            </p>
          )}
        </div>

        {/* CTA */}
        {profile.whatsapp_link && (
          <a
            href={profile.whatsapp_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-4 px-6 rounded-2xl text-white font-medium text-base"
            style={{ background: '#6E56CF' }}
          >
            Agendar via WhatsApp
          </a>
        )}

        <p className="text-center text-xs text-zinc-400 mt-8">
          Perfil verificado por <a href="https://singulare.org" className="underline">Singulare</a>
        </p>
      </div>
    </main>
  );
}
