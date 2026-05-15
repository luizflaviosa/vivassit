import type { MetadataRoute } from 'next';

const BASE_URL = 'https://singulare.org';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Crawlers tradicionais (Google, Bing, DuckDuckGo)
      {
        userAgent: '*',
        allow: [
          '/',
          '/landing',
          '/onboarding',
          '/termos',
          '/privacidade',
          '/profissionais', // hub de cidades
          '/profissionais/', // cidades dinâmicas
          '/p/', // vitrines de profissionais
          '/secretaria-ia/', // paginas SEO programaticas por especialidade x cidade
          '/bem-vindo', // guia publico Q&A
        ],
        disallow: [
          '/painel', // dashboard logado
          '/api', // endpoints internos
          '/auth', // callbacks OAuth
          '/checkout', // fluxo de pagamento
          '/admin', // painel administrativo
          '/login', // login não tem valor SEO
        ],
      },
      // Bloqueio de crawlers de IA — protege dados das vitrines de pacientes/
      // profissionais de scraping pra modelos. Remova se quiser opt-in.
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot'],
        disallow: '/',
      },
      {
        userAgent: ['anthropic-ai', 'Claude-Web', 'ClaudeBot'],
        disallow: '/',
      },
      {
        userAgent: ['CCBot', 'Bytespider', 'PerplexityBot', 'Google-Extended'],
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
