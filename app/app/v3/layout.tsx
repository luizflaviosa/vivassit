// Layout v3 — paginas paralelas com brand Luxury Modular Intelligence v1.0.
// Background sand, fontes Poppins + Space Grotesk via next/font.
// robots noindex: enquanto o /v3 estiver em preview interno, evita indexar.

import type { Metadata, Viewport } from 'next';
import { Poppins, Space_Grotesk } from 'next/font/google';
import { BRAND_COLORS } from './_components/tokens';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Singulare — Conexoes que transformam',
    template: '%s · Singulare',
  },
  description:
    'IA atende seus pacientes no WhatsApp, agenda consultas, organiza pagamentos e mantem seu CRM em dia. Para qualquer profissional de saude.',
  robots: {
    index: false,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: BRAND_COLORS.navy,
};

export default function V3Layout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${poppins.variable} ${spaceGrotesk.variable}`}
      style={{
        background: BRAND_COLORS.sand,
        color: BRAND_COLORS.graphite,
        fontFamily: 'var(--font-space-grotesk), -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        minHeight: '100vh',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {children}
    </div>
  );
}
