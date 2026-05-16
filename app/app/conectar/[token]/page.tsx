import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { ConnectClient } from './ConnectClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const metadata: Metadata = {
  title: 'Conecte seu WhatsApp · Singulare',
  description: 'Conecte o WhatsApp da sua clínica em segundos.',
  robots: { index: false, follow: false },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: { token: string };
}

export default async function ConectarPage({ params }: PageProps) {
  const token = params.token;

  if (!token || !UUID_REGEX.test(token)) {
    notFound();
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }) },
    },
  );

  const { data, error } = await supabase
    .from('tenants')
    .select(
      'tenant_id, clinic_name, doctor_name, evolution_status, evolution_qr_code, evolution_pairing_code, evolution_phone_number',
    )
    .eq('connect_token', token)
    .maybeSingle();

  // Falha silenciosa pra nao expor existencia/forma do token.
  if (error || !data) {
    notFound();
  }

  return (
    <ConnectClient
      token={token}
      clinicName={data.clinic_name ?? null}
      doctorName={data.doctor_name ?? null}
      initialStatus={data.evolution_status ?? 'unknown'}
      initialQrCode={data.evolution_qr_code ?? null}
      initialPairingCode={data.evolution_pairing_code ?? null}
      phoneNumber={data.evolution_phone_number ?? null}
    />
  );
}
