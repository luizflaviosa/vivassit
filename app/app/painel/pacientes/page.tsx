// Server Component — fetch inicial da lista de pacientes no servidor.
// First paint do /painel/pacientes chega com a lista ja renderizada.
// PacientesView (Client) recebe initialPatients e preserva 100% da UX
// original (motion, search, detail drawer, generate token, rook invite).

import { headers, cookies } from 'next/headers';
import PacientesView from './PacientesView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchInitialPatients(): Promise<any[] | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}/api/painel/pacientes`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json.patients as any[]) : null;
  } catch {
    return null;
  }
}

export default async function PacientesPage() {
  const initialPatients = await fetchInitialPatients();
  return <PacientesView initialPatients={initialPatients} />;
}
