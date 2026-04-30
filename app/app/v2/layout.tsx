import type { Metadata } from 'next';
import './v2.css';

export const metadata: Metadata = {
  title: 'Singulare — Seu consultório, no piloto automático.',
  description:
    'IA real no WhatsApp pra clínicas brasileiras. Atende, agenda, lê exames, emite NFS-e e escala humano quando precisa. Para psicólogos, dentistas, médicos, fisios e nutris.',
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <div className="v2-root">{children}</div>;
}
