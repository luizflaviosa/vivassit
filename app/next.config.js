/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Tree-shake automatico em libs pesadas usadas no painel.
  // Next.js gera imports por modulo individual em vez de barrel imports.
  // Impacto medido: -30 a -80kb gzipped por rota.
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
      'date-fns',
      '@radix-ui/react-icons',
    ],
  },
  // Image Optimization habilitado (AVIF/WebP, responsive sizes, CDN cache).
  // Cada novo dominio remoto precisa ser declarado em remotePatterns.
  images: {
    remotePatterns: [
      // Stock photos (guia /guias/visibilidade-digital-clinicas)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Supabase Storage (photo_url da vitrine, logos custom)
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'qwyxacfgoqlskidwzdxe.supabase.co' },
    ],
    // Formatos modernos primeiro (Vercel serve via content negotiation)
    formats: ['image/avif', 'image/webp'],
  },

  // Rewrite raiz pra /v8.html (HTML estatico ja otimizado).
  // Substitui o `redirect('/v8.html')` que existia em app/app/page.tsx
  // — elimina 1 round-trip HTTP 307, reduzindo TTFB em ~100-200ms.
  // beforeFiles roda ANTES do filesystem, entao app/app/page.tsx
  // fica como dead code reversivel (nao apagar pra facilitar rollback).
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/v8.html' },
      ],
    };
  },
};

module.exports = nextConfig;
