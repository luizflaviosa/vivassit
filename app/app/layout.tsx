
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const SITE_URL = 'https://app.singulare.org';
const OG_IMAGE = 'https://cdn.abacus.ai/images/904c7894-74de-41eb-a89d-950fb291aeda.png';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Vivassit · Atendimento automatizado para profissionais de saúde',
    template: '%s · Vivassit',
  },
  description:
    'IA atende seus pacientes no WhatsApp, agenda consultas, organiza pagamentos e mantém seu CRM em dia. Para dentistas, médicos, psicólogos, fisios, nutris e mais.',
  keywords: [
    'vivassit', 'singulare', 'agente IA medico', 'WhatsApp medico',
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
    siteName: 'Vivassit',
    title: 'Vivassit · Seu consultório, no piloto automático',
    description:
      'IA atende, agenda, cobra e organiza tudo via WhatsApp. Para qualquer profissional de saúde.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Vivassit' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vivassit · Seu consultório, no piloto automático',
    description:
      'IA atende, agenda, cobra e organiza tudo via WhatsApp. Para qualquer profissional de saúde.',
    images: [OG_IMAGE],
  },
  icons: {
    icon: [
      { url: OG_IMAGE, type: 'image/png' },
    ],
    apple: OG_IMAGE,
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: 'Health',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6D4EFF',
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
      </head>
      <body className={`${inter.className} antialiased`}>
        <main>{children}</main>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ duration: 6000 }}
        />
      </body>
    </html>
  );
}
