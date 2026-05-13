// app/app/sitemap.ts

import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

const BASE_URL = 'https://singulare.org';

// "São Paulo" → "sao-paulo" (slug seguro pra URL)
function toCitySlug(city: string): string {
  return city
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Páginas estáticas (priority em ordem decrescente)
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    // /v2 e /v6.html tornaram-se legacy — / é a landing oficial agora.
    // Mantidos no sitemap com priority baixa enquanto a transição de SEO acontece.
    { url: `${BASE_URL}/landing`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/onboarding`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/empresa`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/profissionais`, lastModified, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/termos`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/privacidade`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Páginas dinâmicas — sitemap nunca pode quebrar o build
  let dynamicPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = supabaseAdmin();

    // 1) Vitrines publicadas → /p/[slug]
    const { data: profiles } = await supabase
      .from('vitrine_profiles')
      .select('slug, updated_at')
      .eq('published', true);

    const profilePages: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
      url: `${BASE_URL}/p/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    // 2) Páginas por cidade → /profissionais/[cidade]
    //    Long-tail SEO local: 1 URL por cidade que tem profissional ativo.
    const { data: tenants } = await supabase
      .from('tenants')
      .select('city')
      .eq('status', 'active')
      .not('city', 'is', null);

    const cities = Array.from(
      new Set(
        (tenants ?? [])
          .map((t) => (t.city as string | null)?.trim())
          .filter((c): c is string => !!c),
      ),
    );

    const cityPages: MetadataRoute.Sitemap = cities.map((city) => ({
      url: `${BASE_URL}/profissionais/${toCitySlug(city)}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    dynamicPages = [...profilePages, ...cityPages];
  } catch {
    // Falha silenciosa — sitemap continua com static pages
  }

  return [...staticPages, ...dynamicPages];
}
