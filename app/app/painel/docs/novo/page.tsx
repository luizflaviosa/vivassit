// Server Component pra /painel/docs/novo (wizard de criacao de documento).
// Paraleliza 2 fetches no Server (pacientes + profissionais) e passa
// initialPatients + initialDoctors pro Client. UX wizard intacta:
// step 1=type, step 2=patient (com search + clinical-on-select), step 3=form.

import { headers, cookies } from 'next/headers';
import NovoDocView from './NovoDocView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchInternal(path: string): Promise<any | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}${path}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function NovoDocPage() {
  const [pJson, dJson] = await Promise.all([
    fetchInternal('/api/painel/pacientes'),
    fetchInternal('/api/painel/profissionais'),
  ]);

  const initialPatients = pJson?.success ? (pJson.patients as any[]) : null;
  const initialDoctors = dJson?.success ? (dJson.doctors as any[]) : null;

  return (
    <NovoDocView
      initialPatients={initialPatients as any}
      initialDoctors={initialDoctors as any}
    />
  );
}
