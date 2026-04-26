import type { MetadataRoute } from 'next';

const BASE_URL = 'https://app.singulare.org';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/landing', '/onboarding', '/termos', '/privacidade', '/login'],
        disallow: ['/painel', '/api', '/auth', '/checkout'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
