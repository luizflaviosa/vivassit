import type { Metadata } from 'next';
import { V2Nav } from '@/components/v2/Nav';
import { V2Hero } from '@/components/v2/Hero';
import { V2Highlights } from '@/components/v2/Highlights';
import { V2DashboardSection } from '@/components/v2/DashboardSection';
import { V2AISection } from '@/components/v2/AISection';
import { V2Performance } from '@/components/v2/Performance';
import { V2ColorTheme } from '@/components/v2/ColorTheme';
import { V2Testimonials } from '@/components/v2/Testimonials';
import { V2Pricing } from '@/components/v2/Pricing';
import { V2CTAFooter } from '@/components/v2/CTAFooter';
import './v2/v2.css';

export const metadata: Metadata = {
  title: 'Singulare — Seu consultório, no piloto automático.',
  description:
    'IA real no WhatsApp pra clínicas brasileiras. Atende, agenda, lê exames, emite NFS-e e escala humano quando precisa. Para psicólogos, dentistas, médicos, fisios e nutris.',
  alternates: {
    canonical: 'https://singulare.org/',
  },
};

export default function HomePage() {
  return (
    <div className="v2-root">
      <V2Nav />
      <main>
        <V2Hero />
        <V2Highlights />
        <V2DashboardSection />
        <V2AISection />
        <V2Performance />
        <V2ColorTheme />
        <V2Testimonials />
        <V2Pricing />
        <V2CTAFooter />
      </main>
    </div>
  );
}
