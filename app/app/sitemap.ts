// app/app/sitemap.ts

import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

const BASE_URL = 'https://app.singulare.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/v6.html`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/landing`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/onboarding`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/profissionais`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/login`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE_URL}/termos`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacidade`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Dynamic vitrine profile pages
  let profilePages: MetadataRoute.Sitemap = [];
  try {
    const { data: profiles } = await supabaseAdmin()
      .from('vitrine_profiles')
      .select('slug, updated_at')
      .eq('published', true);

    profilePages = (profiles ?? []).map((p) => ({
      url: `${BASE_URL}/p/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    // Sitemap generation should not fail the build
  }

  return [...staticPages, ...profilePages];
}
