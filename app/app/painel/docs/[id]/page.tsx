// Server Component pra rota dinamica /painel/docs/[id].
// Recebe docId via params, fetch /api/painel/docs/[id] no Server,
// passa initialData + docId pro Client. DocDetailView mantem 100%
// da UX (modais sign/edit/reject/send/cancel, motion, BirdID OTP).

import { headers, cookies } from 'next/headers';
import DocDetailView from './DocDetailView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchDocDetail(docId: string): Promise<any | null> {
  const cookieStore = cookies();
  const headersList = headers();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const host = headersList.get('host') ?? 'singulare.org';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  try {
    const res = await fetch(`${proto}://${host}/api/painel/docs/${docId}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    return {
      document: json.document,
      patient: json.patient,
      doctor: json.doctor,
    };
  } catch {
    return null;
  }
}

export default async function DocDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const docId = params.id;
  const initialData = await fetchDocDetail(docId);
  return <DocDetailView docId={docId} initialData={initialData as any} />;
}
