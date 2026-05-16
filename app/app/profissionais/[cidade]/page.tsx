// app/app/profissionais/[cidade]/page.tsx
//
// Hub de cidade: lista todas as especialidades com profissionais ativos.
// Corrige 404 que o sitemap reportava em /profissionais/{cidade} e dá ponto
// de aterrissagem pra busca tipo "profissionais saúde em São Paulo".
//
// Estrutura: BreadcrumbList + ItemList (cada especialidade) + Place schema.
// Links pra /profissionais/{cidade}/{especialidade} e CTA pra /onboarding.

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase';
import { PROFESSIONAL_TYPES, type ProfessionalTypeKey } from '@/lib/types';

interface Props {
  params: { cidade: string };
}

const SITE_URL = 'https://singulare.org';
const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

function humanizeCity(slug: string): string {
  return decodeURIComponent(slug)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function toCitySlug(city: string): string {
  return city
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getCityData(citySlug: string) {
  const sb = supabaseAdmin();

  const { data: tenants } = await sb
    .from('tenants')
    .select('id, professional_type, city')
    .eq('status', 'active')
    .not('professional_type', 'is', null)
    .not('city', 'is', null);

  if (!tenants || tenants.length === 0) return null;

  const matching = tenants.filter(
    (t) => t.city && toCitySlug(t.city as string) === citySlug,
  );

  if (matching.length === 0) return null;

  const cityHuman = (matching[0].city as string).trim();

  const specialtyCounts = new Map<string, number>();
  for (const t of matching) {
    const key = (t.professional_type as string).trim();
    specialtyCounts.set(key, (specialtyCounts.get(key) ?? 0) + 1);
  }

  const specialties = Array.from(specialtyCounts.entries())
    .map(([key, count]) => ({
      key,
      label:
        PROFESSIONAL_TYPES[key as ProfessionalTypeKey] ??
        key.charAt(0).toUpperCase() + key.slice(1),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return { cityHuman, specialties, total: matching.length };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = humanizeCity(params.cidade);
  const title = `Profissionais de saúde em ${city} — Singulare`;
  const description = `Profissionais de saúde com agendamento via WhatsApp em ${city}. Médicos, dentistas, psicólogos, fisioterapeutas e mais. Avaliações reais, perfis verificados.`;
  const canonical = `${SITE_URL}/profissionais/${params.cidade}`;

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
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CityHubPage({ params }: Props) {
  const data = await getCityData(params.cidade);
  if (!data) notFound();
  const { cityHuman, specialties, total } = data;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Profissionais', item: `${SITE_URL}/profissionais` },
      {
        '@type': 'ListItem',
        position: 3,
        name: cityHuman,
        item: `${SITE_URL}/profissionais/${params.cidade}`,
      },
    ],
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Especialidades de saúde em ${cityHuman}`,
    itemListElement: specialties.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/profissionais/${params.cidade}/${s.key}`,
      name: `${s.label} em ${cityHuman}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      <div className="min-h-screen bg-[#FAFAF7] text-zinc-900">
        <header className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-10 pb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-[14px]"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
            >
              S
            </div>
            <span className="text-[13px] font-medium tracking-tight">Singulare</span>
          </Link>
          <Link
            href="/onboarding"
            className="text-[13px] font-medium hover:text-zinc-700 transition"
          >
            Sou profissional
          </Link>
        </header>

        <main className="max-w-[1100px] mx-auto px-6 sm:px-10 pb-24">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-zinc-500 mb-8">
            <Link href="/" className="hover:text-zinc-900">Início</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/profissionais" className="hover:text-zinc-900">Profissionais</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-900">{cityHuman}</span>
          </nav>

          <section className="max-w-[820px] mb-14">
            <p
              className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4"
              style={{ color: ACCENT_DEEP }}
            >
              Profissionais de saúde
            </p>
            <h1 className="text-[44px] sm:text-[56px] leading-[1.02] tracking-[-0.03em] font-medium mb-6">
              {cityHuman}
            </h1>
            <p className="text-[18px] leading-[1.55] text-zinc-600 max-w-[620px]">
              {total} profissionais ativos em {specialties.length}{' '}
              {specialties.length === 1 ? 'especialidade' : 'especialidades'}. Agendamento via
              WhatsApp em minutos, perfis verificados, avaliações reais.
            </p>
          </section>

          <section aria-labelledby="especialidades-title">
            <h2
              id="especialidades-title"
              className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-5 text-zinc-500"
            >
              Especialidades disponíveis em {cityHuman}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {specialties.map((s) => (
                <Link
                  key={s.key}
                  href={`/profissionais/${params.cidade}/${s.key}`}
                  className="group rounded-xl border border-black/[0.07] bg-white p-5 transition-all hover:border-black/[0.18] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.10)]"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-[16px] font-semibold tracking-tight">{s.label}</h3>
                    <ArrowRight
                      className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition shrink-0 mt-0.5"
                      strokeWidth={2}
                    />
                  </div>
                  <p className="text-[12px] text-zinc-500">
                    {s.count} {s.count === 1 ? 'profissional' : 'profissionais'} em {cityHuman}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section
            className="mt-16 rounded-2xl p-8 sm:p-10 border relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="absolute -top-20 -right-20 h-[280px] w-[280px] rounded-full blur-3xl opacity-50"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(110,86,207,0.5), rgba(110,86,207,0) 60%)',
              }}
            />
            <div className="relative">
              <p
                className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4"
                style={{ color: '#a78bfa' }}
              >
                Profissional de saúde em {cityHuman}?
              </p>
              <h3 className="text-[26px] sm:text-[30px] leading-[1.1] tracking-[-0.02em] font-medium text-white mb-3 max-w-[560px]">
                Apareça aqui no topo da busca local com agendamento via WhatsApp.
              </h3>
              <p className="text-[14px] leading-relaxed text-zinc-400 mb-6 max-w-[520px]">
                Cadastro em quatro minutos, perfil verificado, agenda integrada. Pacientes em{' '}
                {cityHuman} encontram você no Google e marcam direto pelo WhatsApp.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 px-6 h-12 rounded-xl text-[14px] font-medium text-white transition-all hover:brightness-110"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                  boxShadow: '0 8px 24px -8px rgba(110,86,207,0.7)',
                }}
              >
                Começar cadastro gratuito
              </Link>
            </div>
          </section>

          {/* Link contextual pro guia */}
          <section
            className="mt-10 rounded-xl border p-5"
            style={{ background: ACCENT_SOFT, borderColor: 'rgba(110,86,207,0.18)' }}
          >
            <p className="text-[13px] leading-relaxed" style={{ color: ACCENT_DEEP }}>
              <span className="font-semibold">Leia também: </span>
              <Link
                href="/guias/visibilidade-digital-clinicas"
                className="underline underline-offset-2 hover:no-underline"
              >
                Visibilidade digital para clínicas — o guia completo com dados
              </Link>
              . Como construir presença online sem violar a ética profissional.
            </p>
          </section>
        </main>

        <footer className="border-t border-black/[0.07] py-10 px-6 text-[12px] text-zinc-500">
          <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-6 flex-wrap">
            <span>Singulare · Profissionais em {cityHuman} · 2026</span>
            <div className="flex items-center gap-5">
              <Link href="/profissionais" className="hover:text-zinc-900">Outras cidades</Link>
              <Link href="/guias/visibilidade-digital-clinicas" className="hover:text-zinc-900">Guia</Link>
              <Link href="/" className="hover:text-zinc-900">singulare.org</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
