// Server Component — fetch inicial da lista de documentos.
// DocsView (Client) recebe initialDocs, renderiza imediatamente.
// Filtros por status disparam refetch normal.

import { headers, cookies } from 'next/headers';
import DocsView from './DocsView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchInitialDocs(): Promise<any[] | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}/api/painel/docs`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json.documents as any[]) : null;
  } catch {
    return null;
  }
}

export default async function DocsPage() {
  const initialDocs = await fetchInitialDocs();
  return <DocsView initialDocs={initialDocs as any} />;
}
