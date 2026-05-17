// Server Component — fetch inicial do tenant no servidor.
// ConfigView (Client) recebe initialTenant e ja monta o form pre-populado
// no first paint. UX preservada: motion, type-ahead Google Place, save,
// subscription card, danger zone, prompt preview.

import { headers, cookies } from 'next/headers';
import ConfigView from './ConfigView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchInitialTenant(): Promise<any | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}/api/painel/tenant`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? json.tenant : null;
  } catch {
    return null;
  }
}

export default async function ConfigPage() {
  const initialTenant = await fetchInitialTenant();
  return <ConfigView initialTenant={initialTenant} />;
}
