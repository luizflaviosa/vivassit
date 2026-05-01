
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const SITE_URL = 'https://app.singulare.org';
const OG_IMAGE = `${SITE_URL}/logos/singulare-a.svg`;
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
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* iOS 16.4+: encolhe a viewport quando o teclado abre, mantendo inputs visíveis */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, interactive-widget=resizes-content"
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <main>{children}</main>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 6000 }}
        />
      </body>
    </html>
  );
}
