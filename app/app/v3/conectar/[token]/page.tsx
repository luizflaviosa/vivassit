// /v3/conectar/[token] — pagina de pareamento WhatsApp no brand Luxury Modular.
// Polling em /api/conectar/[token]/status (a API e independente deste UI).
// Estado conectado: celebracao gold + redirect /painel. Estado QR: card sand
// com QR centralizado + 3 passos numerados em gold.

import { BrandHeader } from '../../_components/BrandHeader';
import { BrandFooter } from '../../_components/BrandFooter';
import { ConnectClientV3 } from './ConnectClientV3';

interface Props {
  params: { token: string };
}

export default function V3ConectarPage({ params }: Props) {
  return (
    <>
      <BrandHeader showNav={false} showCTA={false} />
      <ConnectClientV3 token={params.token} />
      <BrandFooter />
    </>
  );
}

export const metadata = {
  title: 'Conectar WhatsApp · Singulare',
  description:
    'Escaneie o QR Code ou use o codigo de pareamento pra conectar o WhatsApp da clinica ao agente IA da Singulare.',
};
