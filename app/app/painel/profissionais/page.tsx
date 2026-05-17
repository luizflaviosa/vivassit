// Server Component — fetch inicial da lista de profissionais no servidor.
// ProfissionaisView (Client) recebe initialDoctors e preserva 100% da UX
// original (motion, form de criar/editar, modal, calendar manager, working
// hours editor, business_rules editor).

import { headers, cookies } from 'next/headers';
import ProfissionaisView from './ProfissionaisView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchInitialDoctors(): Promise<any[] | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}/api/painel/profissionais`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json.doctors as any[]) : null;
  } catch {
    return null;
  }
}

export default async function ProfissionaisPage() {
  const initialDoctors = await fetchInitialDoctors();
  return <ProfissionaisView initialDoctors={initialDoctors} />;
}
