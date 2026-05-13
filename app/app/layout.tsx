
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// singulare.org = brand canônica no Google. app.singulare.org segue funcionando
// (mesmo deployment Vercel) mas redireciona/canonicaliza pra apex.
const SITE_URL = 'https://singulare.org';
// PNG (não SVG) — Facebook/Linkedin/WhatsApp/iMessage não renderizam SVG em
// preview. og-singulare.png já existe em /public, formato 1200×630.
const OG_IMAGE = `${SITE_URL}/og-singulare.png`;
const ICON = `${SITE_URL}/logos/icon.svg`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Singulare · Atendimento automatizado para profissionais de saúde',
    template: '%s · Singulare',
  },
  description:
    'IA atende seus pacientes no WhatsApp, agenda consultas, organiza pagamentos e mantém seu CRM em dia. Para dentistas, médicos, psicólogos, fisios, nutris e mais.',
  keywords: [
    'singulare', 'agente IA medico', 'WhatsApp medico',
    'gestão de clínica', 'agenda online', 'consulta online',
    'CRM saúde', 'cobranca via WhatsApp', 'NPS clinica',
    'dentista', 'fisioterapeuta', 'psicólogo', 'nutricionista',
  ],
  authors: [{ name: 'Singulare' }],
  creator: 'Singulare',
  publisher: 'Singulare',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Singulare',
    title: 'Singulare · Seu consultório, no piloto automático',
    description:
      'IA atende, agenda, cobra e organiza tudo via WhatsApp. Para qualquer profissional de saúde.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Singulare' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Singulare · Seu consultório, no piloto automático',
    description:
      'IA atende, agenda, cobra e organiza tudo via WhatsApp. Para qualquer profissional de saúde.',
    images: [OG_IMAGE],
  },
  icons: {
    icon: [
      { url: ICON, type: 'image/svg+xml' },
    ],
    apple: ICON,
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Singulare',
    statusBarStyle: 'default',
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: 'Health',
  applicationName: 'Singulare',
  // Verificação Google Search Console — redundante com TXT DNS, mas o
  // Google aceita ambos e não há custo em ter as duas formas.
  verification: {
    google: 'gl8TV6ZTjSPMRt6j1Nqhe1KdzSH8giuYRplknNmRQiY',
  },
};

// Schema.org JSON-LD: ajuda Google a entender o que é a Singulare.
// Cobertura: Organization (autoridade do brand) + SoftwareApplication
// (categoria correta no Google) + ContactPoint (sinaliza suporte real).
const SCHEMA_ORG = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Singulare',
      legalName: 'MEDICAL SAO PAULO SERVICOS MEDICOS LTDA',
      taxID: '20.247.908/0001-01',
      url: SITE_URL,
      logo: `${SITE_URL}/logos/singulare-a.png`,
      description:
        'Plataforma SaaS que automatiza atendimento de clínicas e consultórios via WhatsApp + IA.',
      foundingDate: '2014',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Rua Capitão Cassiano Ricardo de Toledo, 191, Sala 306',
        addressLocality: 'Jundiaí',
        addressRegion: 'SP',
        postalCode: '13201-840',
        addressCountry: 'BR',
      },
      telephone: '+55-17-3305-9030',
      email: 'contato@singulare.org',
      sameAs: [
        // Adicionar quando publicar perfis sociais oficiais:
        // 'https://www.instagram.com/singulareapp',
        // 'https://www.linkedin.com/company/singulare',
      ],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          areaServed: 'BR',
          availableLanguage: ['Portuguese'],
          email: 'contato@singulare.org',
          telephone: '+55-17-3305-9030',
        },
      ],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#software`,
      name: 'Singulare',
      operatingSystem: 'Web',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Healthcare Practice Management',
      url: SITE_URL,
      description:
        'IA atende pacientes no WhatsApp, agenda consultas, organiza pagamentos e mantém o CRM em dia.',
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BRL',
        price: '197',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
      },
      provider: { '@id': `${SITE_URL}/#organization` },
    },
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#5746AF' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA_ORG) }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          <main>{children}</main>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{ duration: 6000 }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
