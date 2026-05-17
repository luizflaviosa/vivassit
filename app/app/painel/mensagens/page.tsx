// Server Component — fetch inicial das mensagens (lista geral, limit=50).
// MensagensView (Client) recebe initialMessages + initialSummary, ja
// renderiza lista no first paint. Trocas de sessao continuam disparando
// refetch via useEffect (preserva interatividade).

import { headers, cookies } from 'next/headers';
import MensagensView from './MensagensView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchInitialMensagens(): Promise<any | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}/api/painel/mensagens?limit=50`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function MensagensPage() {
  const data = await fetchInitialMensagens();
  const initialMessages = data?.success ? (data.messages as any[]) : null;
  const initialSummary = data?.success ? data.summary : null;
  return (
    <MensagensView
      initialMessages={initialMessages as any}
      initialSummary={initialSummary}
    />
  );
}
